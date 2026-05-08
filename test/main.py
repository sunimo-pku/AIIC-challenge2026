import os
import uuid
import base64
import json
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from openai import OpenAI
import httpx

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


class TtsReq(BaseModel):
    text: str
    speaker: str = "zh_female_qingchezizi_moon_bigtts"


@app.post("/tts")
async def tts(req: TtsReq):
    """豆包语音合成：文本 -> MP3音频(base64)"""
    api_key = os.getenv("VOLC_API_KEY")
    if not api_key or api_key == "your_volc_api_key_here":
        return {"error": "⚠️ VOLC_API_KEY 未配置"}

    url = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
    headers = {
        "Content-Type": "application/json",
        "X-Api-Key": api_key,
        "X-Api-Resource-Id": "volc.service_type.10029",
    }
    payload = {
        "user": {"uid": "test_user"},
        "req_params": {
            "text": req.text,
            "speaker": req.speaker,
            "audio": {
                "encoding": "mp3",
                "speed_ratio": 1.0
            }
        }
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            text = resp.text

        # V3 HTTP Chunked 返回多行 JSON，每行一个分块，需要拼接 data
        audio_b64_parts = []
        lines = [l.strip() for l in text.strip().split("\n") if l.strip()]
        for chunk_str in lines:
            chunk = json.loads(chunk_str)
            code = chunk.get("code")
            # V3 接口最后一个分块可能返回 code=20000000, message="OK" 表示流结束
            if code not in (0, 20000000):
                return {"error": chunk.get("message", "语音合成失败")}
            if chunk.get("data"):
                audio_b64_parts.append(chunk["data"])

        audio_b64 = "".join(audio_b64_parts)
        return {
            "audio_base64": audio_b64,
            "format": "mp3",
            "text": req.text
        }
    except Exception as e:
        return {"error": f"请求异常: {str(e)}"}
