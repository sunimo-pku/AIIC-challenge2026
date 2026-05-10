"""
Session management router: CRUD for chat sessions.
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db, ChatSession
from app.dependencies import get_current_user

router = APIRouter()


@router.get("")
def list_sessions(user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    sessions = db.query(ChatSession).filter(ChatSession.user_id == user_id).order_by(ChatSession.updated_at.desc()).all()
    return [{"id": s.id, "title": s.title, "created_at": s.created_at, "updated_at": s.updated_at} for s in sessions]


@router.post("")
def create_session(user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    session = ChatSession(user_id=user_id, title="New Interview")
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "title": session.title}


@router.get("/{session_id}")
def get_session(session_id: int, user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"id": s.id, "title": s.title, "messages": json.loads(s.messages)}


@router.put("/{session_id}")
def update_session(session_id: int, title: str, messages: str, user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    s.title = title
    s.messages = messages
    db.commit()
    return {"id": s.id, "title": s.title}


@router.delete("/{session_id}")
def delete_session(session_id: int, user_id: int = Depends(get_current_user), db: Session = Depends(get_db)):
    s = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == user_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(s)
    db.commit()
    return {"ok": True}
