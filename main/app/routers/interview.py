import json
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from app.db import get_db, InterviewSession
from app.middleware.auth import require_user, User
from app.services.kimi import chat_stream
from app.services.prompts import render_prompt, STAGE_PROMPTS

router = APIRouter(prefix="/interview", tags=["Interview"])


class CreateSessionReq(BaseModel):
    company: str
    position: str


class StageChatReq(BaseModel):
    session_id: int
    stage: int
    message: str
    history: list[dict] | None = None
    model: str | None = None
    response_format: dict | None = None


class UpdateStageReq(BaseModel):
    stage: int
    intel_report: Optional[str] = None
    resume_text: Optional[str] = None
    resume_tags: Optional[list[str]] = None
    resume_risks: Optional[list[str]] = None
    target_projects: Optional[list[str]] = None
    scores: Optional[dict] = None
    weaknesses: Optional[dict] = None


@router.post("/sessions")
def create_session(req: CreateSessionReq, user: User = Depends(require_user), db=Depends(get_db)):
    session = InterviewSession(
        user_id=user.id,
        company=req.company,
        position=req.position,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "company": session.company, "position": session.position}


@router.get("/sessions")
def list_sessions(user: User = Depends(require_user), db=Depends(get_db)):
    sessions = db.query(InterviewSession).filter(InterviewSession.user_id == user.id).order_by(InterviewSession.updated_at.desc()).all()
    return [{"id": s.id, "company": s.company, "position": s.position, "current_stage": s.current_stage} for s in sessions]


@router.get("/sessions/{session_id}")
def get_session(session_id: int, user: User = Depends(require_user), db=Depends(get_db)):
    s = db.query(InterviewSession).filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id).first()
    if not s:
        return {"error": "Not found"}
    return {
        "id": s.id,
        "company": s.company,
        "position": s.position,
        "current_stage": s.current_stage,
        "intel_report": json.loads(s.intel_report),
        "resume_text": s.resume_text,
        "resume_tags": json.loads(s.resume_tags),
        "resume_risks": json.loads(s.resume_risks),
        "target_projects": json.loads(s.target_projects),
        "stage_histories": json.loads(s.stage_histories),
        "scores": json.loads(s.scores),
        "weaknesses": json.loads(s.weaknesses),
    }


@router.put("/sessions/{session_id}")
def update_session(session_id: int, req: UpdateStageReq, user: User = Depends(require_user), db=Depends(get_db)):
    s = db.query(InterviewSession).filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id).first()
    if not s:
        return {"error": "Not found"}
    s.current_stage = req.stage
    if req.intel_report is not None:
        s.intel_report = req.intel_report
    if req.resume_text is not None:
        s.resume_text = req.resume_text
    if req.resume_tags is not None:
        s.resume_tags = json.dumps(req.resume_tags, ensure_ascii=False)
    if req.resume_risks is not None:
        s.resume_risks = json.dumps(req.resume_risks, ensure_ascii=False)
    if req.target_projects is not None:
        s.target_projects = json.dumps(req.target_projects, ensure_ascii=False)
    if req.scores is not None:
        s.scores = json.dumps(req.scores, ensure_ascii=False)
    if req.weaknesses is not None:
        s.weaknesses = json.dumps(req.weaknesses, ensure_ascii=False)
    db.commit()
    return {"ok": True}


@router.post("/chat")
def stage_chat(req: StageChatReq, user: User = Depends(require_user), db=Depends(get_db)):
    s = db.query(InterviewSession).filter(InterviewSession.id == req.session_id, InterviewSession.user_id == user.id).first()
    if not s:
        return {"error": "Not found"}

    # Build cross-stage context
    weaknesses = json.loads(s.weaknesses) if s.weaknesses else {}
    scores = json.loads(s.scores) if s.scores else {}
    prev_stage = req.stage - 1
    prev_weaknesses = weaknesses.get(str(prev_stage), [])
    prev_scores = {k: v for k, v in scores.items() if k.startswith(f"stage_{prev_stage}_")}

    # Summarize all previous stages for final round
    all_scores_summary = ""
    if req.stage == 6 and scores:
        dims = ["基础知识掌握度", "系统设计与架构能力", "代码质量与工程素养", "抗压与应变能力", "沟通表达能力"]
        lines = []
        for dim in dims:
            vals = [v for k, v in scores.items() if dim in k]
            if vals:
                avg = sum(vals) / len(vals)
                lines.append(f"  - {dim}: 平均分 {avg:.0f}")
        all_scores_summary = "\n".join(lines)

    context = {
        "company": s.company,
        "position": s.position,
        "resume_tags": ", ".join(json.loads(s.resume_tags)) if s.resume_tags else "未提供",
        "target_projects": ", ".join(json.loads(s.target_projects)) if s.target_projects else "未提供",
        "prev_weaknesses": "、".join(prev_weaknesses) if prev_weaknesses else "无",
        "prev_scores": "\n".join([f"  - {k.replace(f'stage_{prev_stage}_', '')}: {v}" for k, v in prev_scores.items()]) if prev_scores else "无",
        "all_scores_summary": all_scores_summary or "无",
    }
    system_prompt = render_prompt(STAGE_PROMPTS.get(req.stage, ""), context)

    return StreamingResponse(
        chat_stream(
            req.message,
            [],
            req.history or [],
            model=req.model,
            system_prompt=system_prompt,
            web_search=(req.stage == 0),  # 第 0 关启用联网搜索
            response_format=req.response_format,
        ),
        media_type="text/event-stream",
    )
