"""练习模式（高频专项对练）路由。

设计原则（与模拟模式 `interview.py` 的本质区别）：
1. 不创建 InterviewSession，全部数据走 PracticeProfile（target 单例）+ PracticeLog（历史留档）。
2. system prompt 中**不注入** prev_reviews / 真实 intel_report / 已提取的 resume_tags——
   保持练习模式"白板对练"的语义，避免被前序关卡的弱点反复点名。
3. Stage 0 仍可联网搜情报；Stage 1 仍可读 PDF；Stage 2/3 若 profile 中有 PDF 路径，
   每次 chat 都把简历正文动态注入 system_prompt（不持久化提取结果，符合"无记忆"语义）。
4. 对话历史不进数据库流，由前端内存维护；用户主动「保存留档」或切关卡时调 `/practice/logs`
   写入。
"""

import json
import os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from app.db import get_db, PracticeProfile, PracticeLog
from app.middleware.auth import require_user, User
from app.services.kimi import chat_stream, kimi_client
from app.services.prompts import render_prompt, STAGE_PROMPTS

router = APIRouter(prefix="/practice", tags=["Practice"])


# ─── Profile（target 单例） ───

class ProfileReq(BaseModel):
    company: Optional[str] = None
    position: Optional[str] = None
    resume_file_path: Optional[str] = None


@router.get("/profile")
def get_profile(user: User = Depends(require_user), db=Depends(get_db)):
    p = db.query(PracticeProfile).filter(PracticeProfile.user_id == user.id).first()
    if not p:
        return {"company": "", "position": "", "resume_file_path": "", "updated_at": None}
    return {
        "company": p.company or "",
        "position": p.position or "",
        "resume_file_path": p.resume_file_path or "",
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.put("/profile")
def update_profile(req: ProfileReq, user: User = Depends(require_user), db=Depends(get_db)):
    p = db.query(PracticeProfile).filter(PracticeProfile.user_id == user.id).first()
    if not p:
        p = PracticeProfile(user_id=user.id)
        db.add(p)
    if req.company is not None:
        p.company = req.company
    if req.position is not None:
        p.position = req.position
    if req.resume_file_path is not None:
        p.resume_file_path = req.resume_file_path
    db.commit()
    return {"ok": True}


# ─── Chat（流式，但不入库） ───

class PracticeChatReq(BaseModel):
    stage: int
    message: str
    history: list[dict] | None = None
    model: str | None = None
    audio_meta: dict | None = None


def _practice_system_prompt(stage: int, company: str, position: str) -> str:
    """构造练习模式 system_prompt：模板照常用，但把跨关字段全部改为"练习模式"提示词。
    模型读到这种 placeholder 时会自然进入"独立练习"语境，不会反复 reference 不存在的前序记录。
    """
    template = STAGE_PROMPTS.get(stage, "")
    if not template:
        return ""
    # Build audio meta text for Stage 3
    audio_meta_text = "暂无音频数据"
    if req.stage == 3 and req.audio_meta:
        dur = req.audio_meta.get("duration", 0)
        wc = req.audio_meta.get("word_count", 0)
        wpm = round(wc / dur * 60, 1) if dur > 0 else 0
        audio_meta_text = f"本轮录音时长 {dur} 秒，识别到 {wc} 字，平均语速约 {wpm} 字/分钟"

    context = {
        "company": company or "某互联网公司",
        "position": position or "技术岗位",
        "intel_report": "（练习模式 · 请基于公司与岗位自行合理假设）",
        "prev_reviews": "（练习模式 · 本轮独立练习，无前序面试记录）",
        "resume_tags": "（练习模式 · 若有简历附件请基于其内容判断；否则按通用候选人对待）",
        "target_projects": "（练习模式 · 若有简历附件请基于其内容判断；否则可让候选人自陈）",
        "all_scores_summary": "（练习模式 · 无前序评分汇总）",
        "audio_meta": audio_meta_text,
    }
    base = render_prompt(template, context)
    extra = (
        "\n\n【练习模式说明】"
        "\n- 用户处于专项练习场景，没有完整 5 关面试上下文。"
        "\n- 请直接进入本关角色出题，不要询问「前面表现如何」或「为什么先做这一关」。"
        "\n- 候选人随时可能切换到下一题或重练，不需要在每轮强行总结弱点。"
    )
    return base + extra


@router.post("/chat")
def practice_chat(req: PracticeChatReq, user: User = Depends(require_user), db=Depends(get_db)):
    p = db.query(PracticeProfile).filter(PracticeProfile.user_id == user.id).first()
    company = (p.company if p else "") or ""
    position = (p.position if p else "") or ""
    resume_path = (p.resume_file_path if p else "") or ""

    if not company or not position:
        raise HTTPException(status_code=400, detail="练习模式需要先填写目标公司与岗位")

    system_prompt = _practice_system_prompt(req.stage, company, position)

    # Stage 1 / 2 / 3 若 profile 中有简历，每次都动态注入简历正文
    # （不存提取结果，保持练习模式"无状态"语义）
    if req.stage in (1, 2, 3) and resume_path and os.path.exists(resume_path):
        try:
            with open(resume_path, "rb") as f:
                file_bytes = f.read()
            file_obj = kimi_client.files.create(
                file=(os.path.basename(resume_path), file_bytes, "application/pdf"),
                purpose="file-extract",
            )
            file_content = kimi_client.files.content(file_id=file_obj.id).text
            system_prompt += f"\n\n【候选人简历全文】\n{file_content[:12000]}"
        except Exception as e:
            print(f"[Practice] Failed to load PDF: {e}")

    return StreamingResponse(
        chat_stream(
            req.message,
            [],
            req.history or [],
            model=req.model,
            system_prompt=system_prompt,
            web_search=(req.stage == 0),
        ),
        media_type="text/event-stream",
    )


# ─── Logs（用户主动留档） ───

class PracticeLogReq(BaseModel):
    stage: int
    messages: list[dict]


@router.post("/logs")
def create_log(req: PracticeLogReq, user: User = Depends(require_user), db=Depends(get_db)):
    if not req.messages:
        raise HTTPException(status_code=400, detail="对话为空，无需留档")
    p = db.query(PracticeProfile).filter(PracticeProfile.user_id == user.id).first()
    log = PracticeLog(
        user_id=user.id,
        stage=req.stage,
        company=(p.company if p else "") or "",
        position=(p.position if p else "") or "",
        messages_json=json.dumps(req.messages, ensure_ascii=False),
        msg_count=len(req.messages),
        started_at=datetime.utcnow(),
        ended_at=datetime.utcnow(),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return {"id": log.id}


@router.get("/logs")
def list_logs(stage: Optional[int] = None, user: User = Depends(require_user), db=Depends(get_db)):
    q = db.query(PracticeLog).filter(PracticeLog.user_id == user.id)
    if stage is not None:
        q = q.filter(PracticeLog.stage == stage)
    logs = q.order_by(PracticeLog.ended_at.desc()).limit(50).all()
    return [
        {
            "id": l.id,
            "stage": l.stage,
            "company": l.company,
            "position": l.position,
            "msg_count": l.msg_count,
            "ended_at": l.ended_at.isoformat() if l.ended_at else None,
        }
        for l in logs
    ]


@router.get("/logs/{log_id}")
def get_log(log_id: int, user: User = Depends(require_user), db=Depends(get_db)):
    l = db.query(PracticeLog).filter(PracticeLog.id == log_id, PracticeLog.user_id == user.id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Log not found")
    return {
        "id": l.id,
        "stage": l.stage,
        "company": l.company,
        "position": l.position,
        "messages": json.loads(l.messages_json or "[]"),
        "ended_at": l.ended_at.isoformat() if l.ended_at else None,
    }


@router.delete("/logs/{log_id}")
def delete_log(log_id: int, user: User = Depends(require_user), db=Depends(get_db)):
    l = db.query(PracticeLog).filter(PracticeLog.id == log_id, PracticeLog.user_id == user.id).first()
    if not l:
        raise HTTPException(status_code=404, detail="Log not found")
    db.delete(l)
    db.commit()
    return {"ok": True}
