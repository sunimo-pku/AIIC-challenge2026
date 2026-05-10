import json
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from app.db import get_db, InterviewSession
from app.middleware.auth import require_user, User
from app.services.kimi import chat_stream, kimi_client
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
    stage: Optional[int] = None
    intel_report: Optional[str] = None
    resume_text: Optional[str] = None
    resume_tags: Optional[list[str]] = None
    resume_risks: Optional[list[str]] = None
    target_projects: Optional[list[str]] = None
    scores: Optional[dict] = None
    weaknesses: Optional[dict] = None
    stage_reviews: Optional[dict] = None
    stage_histories: Optional[dict] = None
    resume_file_path: Optional[str] = None


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
        raise HTTPException(status_code=404, detail="Session not found")
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
        "stage_reviews": json.loads(s.stage_reviews),
        "resume_file_path": s.resume_file_path or "",
    }


@router.put("/sessions/{session_id}")
def update_session(session_id: int, req: UpdateStageReq, user: User = Depends(require_user), db=Depends(get_db)):
    s = db.query(InterviewSession).filter(InterviewSession.id == session_id, InterviewSession.user_id == user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    if req.stage is not None:
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
    if req.stage_reviews is not None:
        s.stage_reviews = json.dumps(req.stage_reviews, ensure_ascii=False)
    if req.stage_histories is not None:
        s.stage_histories = json.dumps(req.stage_histories, ensure_ascii=False)
    if req.resume_file_path is not None:
        s.resume_file_path = req.resume_file_path
    db.commit()
    return {"ok": True}


def _build_reviews_text(stage_reviews: dict) -> str:
    """把所有已有关卡的面评报告格式化为文本注入 Prompt。"""
    if not stage_reviews:
        return "无"
    lines = []
    for stage_str, review in sorted(stage_reviews.items(), key=lambda x: int(x[0])):
        stage_names = ["情报局", "简历评估", "基础面", "深挖面", "交叉面", "HR面", "终面"]
        name = stage_names[int(stage_str)] if int(stage_str) < len(stage_names) else f"Stage {stage_str}"
        lines.append(f"\n【第 {stage_str} 关 - {name} 面评报告】")
        weaknesses = review.get("weaknesses", [])
        if weaknesses:
            lines.append("  弱点：" + "、".join(weaknesses))
        highlights = review.get("highlights", [])
        if highlights:
            lines.append("  亮点：" + "、".join(highlights))
        score = review.get("overall_score")
        if score is not None:
            lines.append(f"  总体评分：{score}/100")
        obs = review.get("key_observations", "")
        if obs:
            lines.append(f"  关键观察：{obs}")
        moments = review.get("critical_moments", [])
        if moments:
            lines.append("  关键对话摘录：")
            for m in moments:
                lines.append(f"    - {m}")
    return "\n".join(lines)


def _build_intel_text(intel_report: dict) -> str:
    """把情报报告格式化为文本注入 Prompt。"""
    if not intel_report:
        return "无"
    ir = intel_report if isinstance(intel_report, dict) else {}
    lines = []
    style = ir.get("interview_style", "")
    if style:
        lines.append(f"  面试风格：{style}")
    topics = ir.get("high_freq_topics", [])
    if topics:
        lines.append(f"  高频考点：" + "、".join(topics))
    diff = ir.get("difficulty", "")
    if diff:
        lines.append(f"  整体难度：{diff}")
    prep = ir.get("prep_priority", [])
    if prep:
        lines.append(f"  备考优先级：" + "、".join(prep))
    return "\n".join(lines) if lines else "无"


@router.post("/chat")
def stage_chat(req: StageChatReq, user: User = Depends(require_user), db=Depends(get_db)):
    s = db.query(InterviewSession).filter(InterviewSession.id == req.session_id, InterviewSession.user_id == user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    # Load cross-stage data
    stage_reviews = json.loads(s.stage_reviews) if s.stage_reviews else {}
    scores = json.loads(s.scores) if s.scores else {}
    intel_report = json.loads(s.intel_report) if s.intel_report else {}

    # Build accumulated reviews text (all previous stages)
    prev_reviews_text = _build_reviews_text({k: v for k, v in stage_reviews.items() if int(k) < req.stage})

    # Build intel report text
    intel_text = _build_intel_text(intel_report)

    # Build scores summary for final round
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
        "intel_report": intel_text,
        "prev_reviews": prev_reviews_text,
        "all_scores_summary": all_scores_summary or "无",
    }
    system_prompt = render_prompt(STAGE_PROMPTS.get(req.stage, ""), context)

    # Stage 1: upload PDF to Kimi
    file_ids = []
    if req.stage == 1 and s.resume_file_path and os.path.exists(s.resume_file_path):
        try:
            with open(s.resume_file_path, "rb") as f:
                file_bytes = f.read()
            file_obj = kimi_client.files.create(
                file=(os.path.basename(s.resume_file_path), file_bytes, "application/pdf"),
                purpose="file-extract",
            )
            file_ids.append(file_obj.id)
        except Exception as e:
            print(f"[Interview] Failed to upload PDF to Kimi: {e}")

    return StreamingResponse(
        chat_stream(
            req.message,
            [],
            req.history or [],
            model=req.model,
            system_prompt=system_prompt,
            web_search=(req.stage == 0),
            response_format=req.response_format,
            file_ids=file_ids if file_ids else None,
        ),
        media_type="text/event-stream",
    )


class StageReviewReq(BaseModel):
    session_id: int
    stage: int


@router.post("/stage-review")
def generate_stage_review(req: StageReviewReq, user: User = Depends(require_user), db=Depends(get_db)):
    """根据某关的完整对话历史，生成结构化面评报告。"""
    s = db.query(InterviewSession).filter(InterviewSession.id == req.session_id, InterviewSession.user_id == user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    histories = json.loads(s.stage_histories) if s.stage_histories else {}
    stage_msgs = histories.get(str(req.stage), [])
    if not stage_msgs:
        raise HTTPException(status_code=400, detail="该关卡暂无对话记录")

    # Format conversation for review
    convo_lines = []
    for msg in stage_msgs:
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "user":
            convo_lines.append(f"候选人：{content}")
        elif role == "assistant":
            convo_lines.append(f"面试官：{content}")
    conversation = "\n\n".join(convo_lines)

    # Build review prompt
    stage_names = ["情报局", "简历评估", "基础面", "深挖面", "交叉面", "HR面", "终面"]
    stage_name = stage_names[req.stage] if req.stage < len(stage_names) else f"Stage {req.stage}"

    review_prompt = f"""你是一位资深大厂面试官复盘专家。请根据以下第 {req.stage} 关（{stage_name}）的完整面试对话，生成一份结构化的面评报告。

【对话记录】
{conversation[:8000]}  # 截断避免超长

【输出要求】
仅输出一个 JSON 对象，不要包含任何 Markdown 或其他说明。字段如下：
- weaknesses: 字符串数组，候选人暴露的弱点/答错的点
- highlights: 字符串数组，候选人表现亮点的点
- overall_score: 数字 0-100，本关总体评分
- key_observations: 字符串，对候选人整体表现的观察（如抗压能力、沟通风格等）
- critical_moments: 字符串数组，关键对话摘录（如"追问Redis持久化时候选人答错"）

示例：
{{"weaknesses":["Redis持久化机制掌握不牢"],"highlights":["操作系统内存管理回答扎实"],"overall_score":68,"key_observations":"候选人在连续追问下表现出防御性","critical_moments":["追问Redis持久化时候选人答错","候选人主动承认了项目中的技术债"]}}"""

    try:
        resp = kimi_client.chat.completions.create(
            model="kimi-k2.6",
            messages=[{"role": "user", "content": review_prompt}],
            response_format={"type": "json_object"},
        )
        review_text = resp.choices[0].message.content or "{}"
        review_data = json.loads(review_text)

        # Save to session
        stage_reviews = json.loads(s.stage_reviews) if s.stage_reviews else {}
        stage_reviews[str(req.stage)] = review_data
        s.stage_reviews = json.dumps(stage_reviews, ensure_ascii=False)
        db.commit()

        return review_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"面评报告生成失败: {e}")
