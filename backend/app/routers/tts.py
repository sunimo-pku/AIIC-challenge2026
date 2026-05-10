"""
TTS router: text-to-speech via Volcano Engine (Doubao).
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

from app.config import settings

router = APIRouter()


class TTSRequest(BaseModel):
    text: str
    voice_id: str = "BV001_streaming"


@router.post("/synthesize")
async def tts_synthesize(req: TTSRequest):
    url = "https://openspeech.bytedance.com/api/v1/tts"
    headers = {
        "Authorization": f"Bearer;{settings.VOLC_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "app": {"appid": "", "token": "", "cluster": ""},
        "user": {"uid": "user"},
        "audio": {"voice_type": req.voice_id, "encoding": "mp3"},
        "request": {"reqid": "", "text": req.text, "operation": "query"},
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=payload, headers=headers)
    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail=resp.text)
    return resp.json()
