from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.services.volc_tts import synthesize
from app.middleware.auth import require_user, User

router = APIRouter(prefix="/tts", tags=["TTS"])


class TtsReq(BaseModel):
    text: str
    speaker: str = "zh_female_qingchezizi_moon_bigtts"


@router.post("")
async def tts(req: TtsReq, user: User = Depends(require_user)):
    """语音合成。必须登录：避免匿名调用消耗火山引擎 TTS 配额。"""
    return synthesize(req.text, req.speaker)
