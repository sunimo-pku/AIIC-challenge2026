#!/bin/bash
# deploy.sh - 正式项目一键部署脚本
#             （前端构建 + 后端重启 + 健康检查）
#
# 用法:
#   bash /root/workspace/deploy.sh
#   或先 chmod +x 后直接 ./deploy.sh
#
# 行为:
#   1) 在 FRONTEND_DIR 下执行 npm run build（首次会自动 npm install）
#   2) 杀掉旧 uvicorn 进程并以 nohup 方式重启
#   3) 轮询 HEALTH_URL，最多等 8 秒，有响应才算部署成功
#
# 退出码:
#   0     部署成功
#   非 0   任意一步失败（日志会打印到终端，并指向 uvicorn.log）

set -euo pipefail

# ============ 配置 ============
PROJECT_ROOT="/root/workspace"
BACKEND_DIR="$PROJECT_ROOT/main"
FRONTEND_DIR="$PROJECT_ROOT/main/frontend"
APP_MODULE="app.main:app"
HOST="127.0.0.1"
PORT="8000"
HEALTH_URL="http://127.0.0.1/health"
LOG_FILE="$BACKEND_DIR/logs/uvicorn.log"
# ===========================================================

START_TS=$(date +%s)
echo "[deploy] started at $(date '+%Y-%m-%d %H:%M:%S')"

# ---------- Step 1: 前端构建 ----------
echo "[1/3] building frontend in $FRONTEND_DIR ..."
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
  echo "       node_modules missing, running npm install (first build) ..."
  npm install
fi
npm run build
echo "       frontend built -> $FRONTEND_DIR/dist"

# 复制 Monaco Editor 静态资源到 dist，避免 CDN 加载失败导致自动补全不可用
MONACO_SRC="$FRONTEND_DIR/node_modules/monaco-editor/min/vs"
MONACO_DST="$FRONTEND_DIR/dist/monaco-editor/vs"
if [ -d "$MONACO_SRC" ]; then
  mkdir -p "$MONACO_DST"
  cp -r "$MONACO_SRC/"* "$MONACO_DST/"
  echo "       monaco-editor assets copied -> $MONACO_DST"
fi

# 同步静态资源到 nginx 可访问目录（避免 /root 目录权限导致 403）
# 注意：必须先删 assets/ 再 cp，否则 Vite 每次构建产生新 hash 文件名，
# 旧文件不会被覆盖也不会被删，目录会越积越多最终影响排错。
NGINX_WWW="/var/www/aiic"
mkdir -p "$NGINX_WWW"
rm -rf "$NGINX_WWW/assets"
cp -r "$FRONTEND_DIR/dist/"* "$NGINX_WWW/"
chown -R nginx:nginx "$NGINX_WWW"
echo "       static assets synced (assets/ purged) -> $NGINX_WWW"

# ---------- Step 2: 重启后端 ----------
echo "[2/3] restarting backend ..."
cd "$BACKEND_DIR"
mkdir -p logs

# 关键坑：本机已经跑着 systemd unit aiic.service（Restart=always）。
# 历史版本用 pkill+nohup 重启，会出现 systemd 在 pkill 之后立刻拉起一个新进程，
# 同时 nohup 又起一个 —— 两个 uvicorn 同时监听 8000，请求被 OS 随机分发到不同
# worker，行为不可预期（曾经导致 SSE 流式响应卡住、Profile 状态错乱）。
# 修复：优先用 systemctl restart，让 systemd 来管理生命周期；只有在没有该
# service 时才回退到 nohup。
# 注：不要用 `systemctl list-unit-files | grep -q ...` —— pipefail 模式下 grep 提前
# 关闭 stdin 会让 systemctl 收到 SIGPIPE (rc=141)，整个 pipeline 被标记失败，
# 导致永远进 else 分支。改用 `systemctl cat` 直接探测，存在则 rc=0、不存在 rc=1。
if systemctl cat aiic.service >/dev/null 2>&1; then
  echo "       systemd unit aiic.service detected"
  # 关键步骤：先 stop service + pkill 兜底所有 uvicorn（含历史 nohup 孤儿），
  # 端口完全空出来后 systemd 再启一个干净的。
  # 不能直接 systemctl restart——如果端口被 nohup 进程占着，systemd 拉新进程
  # 会因 EADDRINUSE 退出 1，触发 Restart=always 死循环；最坏情况下 health
  # check 通过的恰恰是 nohup 的旧代码进程，本次新发布的代码根本没生效。
  systemctl stop aiic 2>/dev/null || true
  if pkill -9 -f "uvicorn $APP_MODULE" 2>/dev/null; then
    echo "       legacy uvicorn process(es) killed (nohup orphans, etc.)"
    sleep 1
  fi
  # 再次确认端口已释放（pkill 后可能还在 TIME_WAIT，但端口本身可重 bind）
  systemctl start aiic
  sleep 2
  NEW_PID=$(systemctl show -p MainPID --value aiic 2>/dev/null || echo "?")
  echo "       restarted via systemd, MainPID=$NEW_PID, journalctl -u aiic for logs"
else
  if pkill -f "uvicorn $APP_MODULE" 2>/dev/null; then
    echo "       old uvicorn killed, waiting 1s ..."
    sleep 1
  else
    echo "       no running uvicorn found (first deploy?)"
  fi
  nohup uvicorn "$APP_MODULE" --host "$HOST" --port "$PORT" \
    >> "$LOG_FILE" 2>&1 &
  NEW_PID=$!
  disown || true
  echo "       new uvicorn pid=$NEW_PID, logs -> $LOG_FILE"
fi

# 启动后确认拓扑：恰好一个 uvicorn 进程，并且它就是监听 :8000 的那个。
ALL_UVICORN_PIDS=$(pgrep -f "uvicorn $APP_MODULE" 2>/dev/null || true)
PROC_COUNT=$(echo "$ALL_UVICORN_PIDS" | grep -c . || true)
LISTENING_PID=$(ss -ltnp 'sport = :8000' 2>/dev/null | awk -F'pid=' '/uvicorn/{print $2}' | awk -F',' '{print $1}' | head -1)
if [ "$PROC_COUNT" -gt 1 ]; then
  echo "       WARN: $PROC_COUNT uvicorn processes after restart, listener=$LISTENING_PID"
  for p in $ALL_UVICORN_PIDS; do
    if [ "$p" != "$LISTENING_PID" ]; then
      echo "       kill -9 non-listening pid=$p"
      kill -9 "$p" 2>/dev/null || true
    fi
  done
fi

# ---------- Step 3: 健康检查 ----------
echo "[3/3] health check $HEALTH_URL ..."
sleep 2
for i in 1 2 3 4 5 6; do
  if curl -fsS --max-time 2 "$HEALTH_URL" > /dev/null; then
    ELAPSED=$(( $(date +%s) - START_TS ))
    echo "[deploy] SUCCESS in ${ELAPSED}s -- $HEALTH_URL OK"
    exit 0
  fi
  echo "       retry $i/6 ..."
  sleep 1
done

echo "[deploy] FAILED -- $HEALTH_URL not responding within 8s"
echo "         tail $LOG_FILE for details:"
echo "         tail -n 30 $LOG_FILE"
exit 1
