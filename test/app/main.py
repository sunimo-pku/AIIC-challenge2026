import os
import logging
from datetime import datetime
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.routers import chat, tts, asr, auth, sessions
from app.middleware import error_handler

# 日志配置
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(f"logs/app_{datetime.now().strftime('%Y%m%d')}.log"),
        logging.StreamHandler(),
    ],
)

app = FastAPI(
    title="AIIC Challenge Test",
    description="Kimi + 豆包语音 集成测试服务",
    version="0.1.0",
)

# 注册中间件
error_handler.register(app)

# 注册路由
app.include_router(chat.router)
app.include_router(tts.router)
app.include_router(asr.router)
app.include_router(auth.router)
app.include_router(sessions.router)

# 静态文件（React 构建产物）
dist_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")


@app.get("/")
async def root():
    return FileResponse(os.path.join(dist_path, "index.html"))


@app.get("/chat")
async def chat_page():
    return FileResponse(os.path.join(dist_path, "index.html"))


@app.get("/tts")
async def tts_page():
    return FileResponse(os.path.join(dist_path, "index.html"))


@app.get("/login")
async def login_page():
    return FileResponse(os.path.join(dist_path, "index.html"))


@app.get("/register")
async def register_page():
    return FileResponse(os.path.join(dist_path, "index.html"))


@app.get("/diagnostics")
async def diagnostics_page():
    return FileResponse(os.path.join(dist_path, "index.html"))


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}
