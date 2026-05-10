from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.services.volc_asr import recognize
from app.middleware.auth import require_user, User

router = APIRouter(prefix="/asr", tags=["ASR"])


class AsrReq(BaseModel):
    audio: str  # base64 encoded audio data
    format: str = "wav"


@router.post("")
async def asr_endpoint(req: AsrReq, user: User = Depends(require_user)):
    """语音识别。必须登录：避免匿名调用消耗火山引擎 ASR 配额。"""
    result = recognize(req.audio, req.format)
    return result
