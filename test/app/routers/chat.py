from fastapi import APIRouter
from pydantic import BaseModel
from app.services.kimi import chat as kimi_chat

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatReq(BaseModel):
    message: str


@router.post("")
async def chat(req: ChatReq):
    reply = kimi_chat(req.message)
    return {"reply": reply}
