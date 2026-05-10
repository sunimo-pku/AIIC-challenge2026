"""
Chat / Interview router: SSE streaming chat endpoint.
"""
import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models.schemas import ChatRequest

router = APIRouter()


SYSTEM_PROMPT = (
    "You are an experienced technical interviewer. "
    "You conduct realistic mock interviews, ask follow-up questions, "
    "and provide specific, actionable feedback. "
    "Be professional but encouraging."
)


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


@router.post("/stream")
def chat_stream(req: ChatRequest, user_id: int = Depends(get_current_user)):
    from openai import OpenAI
    from app.config import settings

    client = OpenAI(api_key=settings.KIMI_API_KEY, base_url="https://api.moonshot.cn/v1")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if req.custom_instructions:
        messages[0]["content"] = req.custom_instructions + "\n" + messages[0]["content"]
    for h in req.history or []:
        messages.append({"role": h.role, "content": h.content})
    messages.append({"role": "user", "content": req.message})

    def event_generator():
        try:
            stream = client.chat.completions.create(
                model=req.model or "kimi-k2.6",
                messages=messages,
                stream=True,
                temperature=1.0,
                top_p=0.95,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta.content or ""
                if delta:
                    yield _sse({"delta": delta})
            yield _sse({"done": True})
        except Exception as e:
            yield _sse({"error": str(e)})

    return StreamingResponse(event_generator(), media_type="text/event-stream")
