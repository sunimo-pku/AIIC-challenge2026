from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from openai import OpenAI

# 加载项目根目录的 .env（因为本文件在 test/ 子目录下）
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(base_dir, '.env'))

app = FastAPI()

app.mount("/static", StaticFiles(directory="/root/workspace/test/static"), name="static")


@app.get("/")
async def root():
    return FileResponse("/root/workspace/test/static/index.html")


class ChatReq(BaseModel):
    message: str


@app.post("/chat")
async def chat(req: ChatReq):
    api_key = os.getenv("KIMI_API_KEY")
    if not api_key or api_key == "your_kimi_api_key_here":
        return {"reply": "⚠️ API Key 未配置，请在项目根目录的 .env 文件中设置 KIMI_API_KEY，然后重启服务。"}

    client = OpenAI(
        api_key=api_key,
        base_url="https://api.moonshot.cn/v1"
    )

    try:
        response = client.chat.completions.create(
            model="moonshot-v1-8k",
            messages=[{"role": "user", "content": req.message}]
        )
        return {"reply": response.choices[0].message.content}
    except Exception as e:
        return {"reply": f"调用失败: {str(e)}"}
