#!/bin/bash
# test-deploy.sh - 准备阶段 test/ 目录的一键部署脚本
#                  （前端构建 + 后端重启 + 健康检查）
#
# 用途:
#   仅服务于当前 test/ 目录下的连通性测试服务。
#   比赛日题目公布后，请复制本文件为 deploy.sh，并修改下方「配置」段
#   指向正式项目的目录与启动模块。
#
# 用法:
#   bash /root/workspace/test-deploy.sh
#   或先 chmod +x 后直接 ./test-deploy.sh
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

# ============ 配置（题目公布后复制为 deploy.sh，改这一段即可） ============
PROJECT_ROOT="/root/workspace"
BACKEND_DIR="$PROJECT_ROOT/test"
FRONTEND_DIR="$PROJECT_ROOT/test/frontend"
APP_MODULE="app.main:app"          # uvicorn 加载的 ASGI 入口
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
