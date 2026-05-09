from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.services.kimi import chat as kimi_chat, chat_stream
from app.middleware.auth import require_user, User

router = APIRouter(prefix="/chat", tags=["Chat"])


class HistoryItem(BaseModel):
    role: str
    content: str
    images: list[str] | None = None


class ChatReq(BaseModel):
    message: str
    images: list[str] | None = None
    history: list[HistoryItem] | None = None
    model: str | None = None
    temperature: float | None = None
    top_p: float | None = None
    max_tokens: int | None = None


@router.post("")
async def chat(req: ChatReq, user: User = Depends(require_user)):
    history = [h.model_dump() for h in (req.history or [])]
    reply = kimi_chat(
        req.message,
        req.images or [],
        history,
        model=req.model,
        temperature=req.temperature,
        top_p=req.top_p,
        max_tokens=req.max_tokens,
    )
    return {"reply": reply}


@router.post("/stream")
async def chat_stream_endpoint(req: ChatReq, user: User = Depends(require_user)):
    history = [h.model_dump() for h in (req.history or [])]
    return StreamingResponse(
        chat_stream(
            req.message,
            req.images or [],
            history,
            model=req.model,
            temperature=req.temperature,
            top_p=req.top_p,
            max_tokens=req.max_tokens,
        ),
        media_type="text/event-stream",
    )
