from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.kimi import chat as kimi_chat, chat_stream

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatReq(BaseModel):
    message: str


@router.post("")
async def chat(req: ChatReq):
    reply = kimi_chat(req.message)
    return {"reply": reply}


@router.post("/stream")
async def chat_stream_endpoint(req: ChatReq):
    return StreamingResponse(
        chat_stream(req.message),
        media_type="text/event-stream",
    )
