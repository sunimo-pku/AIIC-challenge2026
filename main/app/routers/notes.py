"""复盘笔记 CRUD 路由。

设计原则：
1. 笔记永远是用户自己写的产物，AI 报告只能作为初始 content 模板被预填一次，
   之后所有编辑都是用户行为。后端不主动用 AI 改写笔记。
2. 关联字段（mode/stage/company/position/ref_*）允许全空——支持纯独立笔记。
3. 列表接口默认按 updated_at 倒序。前端要做筛选/搜索，先在内存里过滤足够；
   笔记规模在万级以前不需要后端 LIKE / 全文检索。
"""

import json
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_

from app.db import get_db, Note, User as UserModel
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
    is_published: Optional[bool] = None  # 用户主动发布到广场


def _serialize(n: Note, *, with_content: bool = True, author_username: Optional[str] = None) -> dict:
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
        "is_published": bool(n.is_published or 0),
        "published_at": n.published_at.isoformat() if n.published_at else None,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "updated_at": n.updated_at.isoformat() if n.updated_at else None,
    }
    if author_username is not None:
        base["author"] = author_username
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


@router.get("/feed")
def list_feed(
    company: Optional[str] = Query(None, description="精确匹配公司"),
    position: Optional[str] = Query(None, description="精确匹配岗位"),
    q: Optional[str] = Query(None, description="标题/内容关键字"),
    limit: int = Query(100, le=500),
    _: User = Depends(require_user),
    db=Depends(get_db),
):
    """所有用户的公开笔记。按 published_at 倒序。
    需要 join User 拿作者用户名。返回的 preview 不带 content 全文，避免广场页面拖慢。
    """
    query = (
        db.query(Note, UserModel.username)
        .join(UserModel, UserModel.id == Note.user_id)
        .filter(Note.is_published == 1)
    )
    if company:
        query = query.filter(Note.company == company)
    if position:
        query = query.filter(Note.position == position)
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Note.title.like(like), Note.content.like(like)))
    rows = query.order_by(Note.published_at.desc().nullslast()).limit(limit).all()
    return [_serialize(n, with_content=False, author_username=username) for n, username in rows]


@router.get("/feed/labels")
def feed_labels(
    _: User = Depends(require_user),
    db=Depends(get_db),
):
    """返回广场上出现过的 (company, position) 维度，用于前端筛选 chips。
    去重 + 按出现次数倒序，截断到前 20 个。
    """
    rows = (
        db.query(Note.company, Note.position)
        .filter(Note.is_published == 1)
        .all()
    )
    company_count: dict[str, int] = {}
    position_count: dict[str, int] = {}
    for c, p in rows:
        if c:
            company_count[c] = company_count.get(c, 0) + 1
        if p:
            position_count[p] = position_count.get(p, 0) + 1
    return {
        "companies": [{"label": k, "count": v} for k, v in sorted(company_count.items(), key=lambda kv: -kv[1])[:20]],
        "positions": [{"label": k, "count": v} for k, v in sorted(position_count.items(), key=lambda kv: -kv[1])[:20]],
    }


@router.get("/{note_id}")
def get_note(note_id: int, user: User = Depends(require_user), db=Depends(get_db)):
    """读单条笔记。
    - 如果是自己的笔记：直接返回
    - 如果是别人的笔记：必须是已发布的才能读，且返回的 author 字段告知作者
    """
    n = db.query(Note).filter(Note.id == note_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="笔记不存在")
    if n.user_id != user.id:
        if not n.is_published:
            raise HTTPException(status_code=404, detail="笔记不存在")
        author = db.query(UserModel).filter(UserModel.id == n.user_id).first()
        return _serialize(n, with_content=True, author_username=(author.username if author else "anonymous"))
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
    if req.is_published is not None:
        new_state = 1 if req.is_published else 0
        if new_state != (n.is_published or 0):
            n.is_published = new_state
            n.published_at = datetime.utcnow() if new_state else None
    db.commit()
    db.refresh(n)
    return _serialize(n, with_content=True)


@router.post("/{note_id}/publish")
def publish_note(note_id: int, user: User = Depends(require_user), db=Depends(get_db)):
    """快捷发布接口（等价于 PUT {is_published: true}）。"""
    n = db.query(Note).filter(Note.id == note_id, Note.user_id == user.id).first()
    if not n:
        raise HTTPException(status_code=404, detail="笔记不存在")
    if not (n.title or "").strip() and not (n.content or "").strip():
        raise HTTPException(status_code=400, detail="空白笔记不能发布")
    n.is_published = 1
    n.published_at = datetime.utcnow()
    db.commit()
    db.refresh(n)
    return _serialize(n, with_content=True)


@router.post("/{note_id}/unpublish")
def unpublish_note(note_id: int, user: User = Depends(require_user), db=Depends(get_db)):
    n = db.query(Note).filter(Note.id == note_id, Note.user_id == user.id).first()
    if not n:
        raise HTTPException(status_code=404, detail="笔记不存在")
    n.is_published = 0
    n.published_at = None
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
