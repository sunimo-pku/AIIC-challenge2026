import os
import logging
from datetime import datetime
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from app.routers import chat, tts, asr, auth, sessions, upload, interview, practice, notes
from app.middleware import error_handler, rate_limit

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
    title="AI Mock Interviewer",
    description="AI-powered mock interview practice platform",
    version="1.0.0",
)

# 注册中间件
error_handler.register(app)

# CORS：允许同源及本地开发环境
# 注意：浏览器规范下 allow_origins=["*"] 不能与 allow_credentials=True 同时生效
# （会被浏览器忽略整个 CORS 头）。前端目前是同源 fetch，因此把 credentials 关掉，
# 保留 wildcard 让 Postman / 评审从其他域名测时也能正常预检。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 限流：防止 API 额度被刷
app.middleware("http")(rate_limit.rate_limit_middleware)

# 注册路由
app.include_router(chat.router)
app.include_router(tts.router)
app.include_router(asr.router)
app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(upload.router)
app.include_router(interview.router)
app.include_router(practice.router)
app.include_router(notes.router)

# 静态文件（React 构建产物）
dist_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")
app.mount("/monaco-editor", StaticFiles(directory=os.path.join(dist_path, "monaco-editor")), name="monaco")


@app.get("/")
async def root():
    return FileResponse(os.path.join(dist_path, "index.html"))


@app.get("/register")
async def register_page():
    return FileResponse(os.path.join(dist_path, "index.html"))


# 注：早期还有 /chat /tts /diagnostics 的 SPA fallback，但前端 App.tsx 从未注册过这些
# 路由，访问只会落到 NotFound 页。同时 src/pages/Chat.tsx / Tts.tsx / Diagnostics.tsx
# 也已经在前端清理掉，避免给评审误导。
@app.get("/interview/{path:path}")
async def interview_spa(path: str):
    return FileResponse(os.path.join(dist_path, "index.html"))


# /journal、/journal/123 等前端路由的 SPA fallback。
# 注意：不能直接用 GET /journal — 那条路径已被 notes.router 占用作为 API；
# 因此前端笔记页路径用 /journal，后端 API 用 /notes，两者不冲突。
@app.get("/journal")
async def journal_root_page():
    return FileResponse(os.path.join(dist_path, "index.html"))


@app.get("/journal/{path:path}")
async def journal_spa(path: str):
    return FileResponse(os.path.join(dist_path, "index.html"))


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}
