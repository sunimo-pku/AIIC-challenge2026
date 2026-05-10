"""
Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel
from typing import List, Optional, Literal


class UserCreate(BaseModel):
    username: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class HistoryItem(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[HistoryItem]] = []
    model: Optional[str] = "kimi-k2.6"
    custom_instructions: Optional[str] = ""


class ChatResponse(BaseModel):
    delta: str
    done: bool = False
