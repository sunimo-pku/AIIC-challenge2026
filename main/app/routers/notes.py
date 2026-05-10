"""复盘笔记 CRUD 路由。

设计原则：
1. 笔记永远是用户自己写的产物，AI 报告只能作为初始 content 模板被预填一次，
   之后所有编辑都是用户行为。后端不主动用 AI 改写笔记。
2. 关联字段（mode/stage/company/position/ref_*）允许全空——支持纯独立笔记。
3. 列表接口默认按 updated_at 倒序。前端要做筛选/搜索，先在内存里过滤足够；
   笔记规模在万级以前不需要后端 LIKE / 全文检索。
"""

import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_

from app.db import get_db, Note
from app.middleware.auth import require_user, User

router = APIRouter(prefix="/notes", tags=["Notes"])


class NoteReq(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    mode: Optional[str] = None
    stage: Optional[int] = None
    company: Optional[str] = None
    position: Optional[str] = None
    ref_session_id: Optional[int] = None
    ref_log_id: Optional[int] = None
    tags: Optional[list[str]] = None


def _serialize(n: Note, *, with_content: bool = True) -> dict:
    base = {
        "id": n.id,
        "title": n.title or "",
        "mode": n.mode or "",
        "stage": n.stage,
        "company": n.company or "",
        "position": n.position or "",
        "ref_session_id": n.ref_session_id,
        "ref_log_id": n.ref_log_id,
        "tags": json.loads(n.tags or "[]"),
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }
    if with_content:
        base["content"] = n.content or ""
    else:
        # 列表场景下给一段预览，避免把所有笔记内容都拉过去
        c = (n.content or "").strip()
        base["preview"] = c[:160] + ("…" if len(c) > 160 else "")
        base["char_count"] = len(c)
    return base


@router.get("")
def list_notes(
    mode: Optional[str] = Query(None),
    stage: Optional[int] = Query(None),
    q: Optional[str] = Query(None, description="标题/内容/公司模糊关键字"),
    limit: int = Query(100, le=500),
    user: User = Depends(require_user),
    db=Depends(get_db),
):
    query = db.query(Note).filter(Note.user_id == user.id)
    if mode:
        query = query.filter(Note.mode == mode)
    if stage is not None:
        query = query.filter(Note.stage == stage)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Note.title.like(like), Note.content.like(like), Note.company.like(like)))
    notes = query.order_by(Note.updated_at.desc()).limit(limit).all()
    return [_serialize(n, with_content=False) for n in notes]


@router.get("/{note_id}")
def get_note(note_id: int, user: User = Depends(require_user), db=Depends(get_db)):
    n = db.query(Note).filter(Note.id == note_id, Note.user_id == user.id).first()
    if not n:
        raise HTTPException(status_code=404, detail="笔记不存在")
    return _serialize(n, with_content=True)


@router.post("")
def create_note(req: NoteReq, user: User = Depends(require_user), db=Depends(get_db)):
    n = Note(
        user_id=user.id,
        title=(req.title or "").strip(),
        content=(req.content or "").strip(),
        mode=(req.mode or ""),
        stage=req.stage,
        company=(req.company or "").strip(),
        position=(req.position or "").strip(),
        ref_session_id=req.ref_session_id,
        ref_log_id=req.ref_log_id,
        tags=json.dumps(req.tags or [], ensure_ascii=False),
    )
    db.add(n)
    db.commit()
    db.refresh(n)
    return _serialize(n, with_content=True)


@router.put("/{note_id}")
def update_note(note_id: int, req: NoteReq, user: User = Depends(require_user), db=Depends(get_db)):
    n = db.query(Note).filter(Note.id == note_id, Note.user_id == user.id).first()
    if not n:
        raise HTTPException(status_code=404, detail="笔记不存在")
    # 仅显式传入的字段才覆盖，None 视为不修改
    if req.title is not None:
        n.title = req.title.strip()
    if req.content is not None:
        n.content = req.content.strip()
    if req.mode is not None:
        n.mode = req.mode
    if req.stage is not None:
        n.stage = req.stage
    if req.company is not None:
        n.company = req.company.strip()
    if req.position is not None:
        n.position = req.position.strip()
    if req.ref_session_id is not None:
        n.ref_session_id = req.ref_session_id
    if req.ref_log_id is not None:
        n.ref_log_id = req.ref_log_id
    if req.tags is not None:
        n.tags = json.dumps(req.tags, ensure_ascii=False)
    db.commit()
    db.refresh(n)
    return _serialize(n, with_content=True)


@router.delete("/{note_id}")
def delete_note(note_id: int, user: User = Depends(require_user), db=Depends(get_db)):
    n = db.query(Note).filter(Note.id == note_id, Note.user_id == user.id).first()
    if not n:
        raise HTTPException(status_code=404, detail="笔记不存在")
    db.delete(n)
    db.commit()
    return {"ok": True}
