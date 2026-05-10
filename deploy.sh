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

# 杀掉旧 uvicorn（pkill 找不到匹配会返回 1，这里允许）
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
