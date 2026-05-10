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
    mode: Optional[str] = "simulation"


class StageChatReq(BaseModel):
    session_id: int
    stage: int
    message: str
    history: list[dict] | None = None
    model: str | None = None
    response_format: dict | None = None
    audio_meta: dict | None = None  # {duration: float, word_count: int}


class UpdateStageReq(BaseModel):
    stage: Optional[int] = None
    # 模拟模式的元数据可改字段——之前漏掉 company/position 导致前端表单"看似改了实际未生效"
    company: Optional[str] = None
    position: Optional[str] = None
    mode: Optional[str] = None
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
    mode = req.mode if req.mode in ("simulation", "practice") else "simulation"
    session = InterviewSession(
        user_id=user.id,
        company=req.company,
        position=req.position,
        mode=mode,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {
        "id": session.id,
        "company": session.company,
        "position": session.position,
        "mode": session.mode,
    }


@router.get("/sessions")
def list_sessions(
    mode: Optional[str] = "simulation",
    user: User = Depends(require_user),
    db=Depends(get_db),
):
    """默认只返回 simulation 模式的场次（练习模式数据走 /practice/logs）。
    前端列表页扩展元数据：当前关卡、已完成关数、综合评分、最近更新时间。
    """
    q = db.query(InterviewSession).filter(InterviewSession.user_id == user.id)
    if mode and mode != "all":
        q = q.filter(InterviewSession.mode == mode)
    sessions = q.order_by(InterviewSession.updated_at.desc()).all()
    out = []
    for s in sessions:
        try:
            reviews = json.loads(s.stage_reviews) if s.stage_reviews else {}
        except Exception:
            reviews = {}
        scores_list = [
            r.get("overall_score")
            for r in reviews.values()
            if isinstance(r, dict) and r.get("overall_score") is not None
        ]
        avg = round(sum(scores_list) / len(scores_list)) if scores_list else None
        out.append({
            "id": s.id,
            "company": s.company,
            "position": s.position,
            "current_stage": s.current_stage,
            "mode": s.mode or "simulation",
            "completed_stages": len(reviews),
            "total_score": avg,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None,
        })
    return out


@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, user: User = Depends(require_user), db=Depends(get_db)):
    s = db.query(InterviewSession).filter(
        InterviewSession.id == session_id, InterviewSession.user_id == user.id
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    db.delete(s)
    db.commit()
    return {"ok": True}


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
    if req.company is not None:
        s.company = req.company
    if req.position is not None:
        s.position = req.position
    if req.mode is not None and req.mode in ("simulation", "practice"):
        s.mode = req.mode
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
        stage_names = ["面试攻略", "简历评估", "技术面", "情景面", "总结"]
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
    # 5 关重构后，Stage 2(技术面) 与 Stage 3(情景面) 的实际维度合计 10 个，全部列入终面汇总
    all_scores_summary = ""
    if req.stage == 4 and scores:
        dims = [
            # Stage 2 技术面五维
            "基础知识掌握度", "系统设计与架构能力", "代码质量与工程素养",
            "项目深度与Ownership", "抗压与应变能力",
            # Stage 3 情景面五维
            "沟通与协作能力", "决策与权衡能力", "结构化表达",
            "抗压与情绪管理", "自我认知与成长",
        ]
        lines = []
        for dim in dims:
            vals = [v for k, v in scores.items() if dim in k and isinstance(v, (int, float))]
            if vals:
                avg = sum(vals) / len(vals)
                lines.append(f"  - {dim}: 平均分 {avg:.0f}")
        all_scores_summary = "\n".join(lines)

    # Build audio meta text for Stage 3
    audio_meta_text = "暂无音频数据"
    if req.stage == 3 and req.audio_meta:
        dur = req.audio_meta.get("duration", 0)
        wc = req.audio_meta.get("word_count", 0)
        wpm = round(wc / dur * 60, 1) if dur > 0 else 0
        avg_sr = req.audio_meta.get("avg_speech_rate", 0)
        avg_vol = req.audio_meta.get("avg_volume", 0)
        dom_emo = req.audio_meta.get("dominant_emotion", "未知")
        utts = req.audio_meta.get("utterances", [])
        pause_count = max(0, len(utts) - 1)
        lines = [
            f"本轮录音时长 {dur} 秒，识别到 {wc} 字，平均语速约 {wpm} 字/分钟",
            f"分句数 {len(utts)}，句间停顿 {pause_count} 次",
            f"平均语速（token/s）: {avg_sr}",
            f"平均音量（分贝）: {avg_vol}",
            f"主导情绪: {dom_emo}",
        ]
        if utts:
            lines.append("各分句详情：")
            for i, u in enumerate(utts[:8], 1):  # 最多展示 8 句避免过长
                lines.append(f"  句{i}: 「{u.get('text', '')}」 情绪={u.get('emotion', '-')} 语速={u.get('speech_rate', 0)} 音量={u.get('volume', 0)}")
        audio_meta_text = "\n".join(lines)

    context = {
        "company": s.company,
        "position": s.position,
        "resume_tags": ", ".join(json.loads(s.resume_tags)) if s.resume_tags else "未提供",
        "target_projects": ", ".join(json.loads(s.target_projects)) if s.target_projects else "未提供",
        "intel_report": intel_text,
        "prev_reviews": prev_reviews_text,
        "all_scores_summary": all_scores_summary or "无",
        "audio_meta": audio_meta_text,
    }
    system_prompt = render_prompt(STAGE_PROMPTS.get(req.stage, ""), context)

    # Stage 1: upload PDF to Kimi, extract content, append to system_prompt
    if req.stage == 1 and s.resume_file_path and os.path.exists(s.resume_file_path):
        try:
            with open(s.resume_file_path, "rb") as f:
                file_bytes = f.read()
            file_obj = kimi_client.files.create(
                file=(os.path.basename(s.resume_file_path), file_bytes, "application/pdf"),
                purpose="file-extract",
            )
            file_content = kimi_client.files.content(file_id=file_obj.id).text
            system_prompt += f"\n\n【候选人简历全文】\n{file_content[:12000]}"  # 截断避免超长
        except Exception as e:
            print(f"[Interview] Failed to upload/read PDF: {e}")

    return StreamingResponse(
        chat_stream(
            req.message,
            [],
            req.history or [],
            model=req.model,
            system_prompt=system_prompt,
            web_search=(req.stage == 0),
            response_format=req.response_format,
        ),
        media_type="text/event-stream",
    )


def _build_review_prompt(stage: int, conversation: str) -> str:
    """根据关卡和对话记录构建面评报告的 review prompt。"""
    stage_names = ["面试攻略", "简历评估", "技术面", "情景面", "总结"]
    stage_name = stage_names[stage] if stage < len(stage_names) else f"Stage {stage}"

    if stage == 3:
        return f"""你是一位资深大厂面试官复盘专家，同时也是面试表达分析专家。请根据以下语音情景面试的完整对话，生成结构化面评报告。

【对话记录】
{conversation[:8000]}

【输出要求】
仅输出一个 JSON 对象。字段如下：
- weaknesses: 字符串数组，候选人暴露的弱点（内容 + 表达）
- highlights: 字符串数组，亮点
- overall_score: 数字 0-100，本关总体评分
- key_observations: 字符串，整体观察
- critical_moments: 字符串数组，关键对话摘录
- expression_analysis: 对象
  - fluency_score: 数字 0-100，表达流畅度
  - clarity_score: 数字 0-100，结构化清晰度
  - professionalism_score: 数字 0-100，语言得体性
  - emotional_stability: 数字 0-100，情绪稳定性
  - filler_words: 字符串数组，检测到的口头禅
  - observation: 字符串，对表达状态的综合观察

示例：
{{"weaknesses":["压力下逻辑跳跃","语速过快导致表述不清"],"highlights":["主动提出折中方案"],"overall_score":70,"key_observations":"候选人内容不错，但紧张时表达退化明显","critical_moments":["被质疑后语气变防御"],"expression_analysis":{{"fluency_score":65,"clarity_score":72,"professionalism_score":75,"emotional_stability":60,"filler_words":["嗯","然后","就是"],"observation":"紧张时口头禅密集，但恢复较快"}}}}"""
    else:
        return f"""你是一位资深大厂面试官复盘专家。请根据以下第 {stage} 关（{stage_name}）的完整面试对话，生成一份结构化的面评报告。

【对话记录】
{conversation[:8000]}

【输出要求】
仅输出一个 JSON 对象，不要包含任何 Markdown 或其他说明。字段如下：
- weaknesses: 字符串数组，候选人暴露的弱点/答错的点
- highlights: 字符串数组，候选人表现亮点的点
- overall_score: 数字 0-100，本关总体评分
- key_observations: 字符串，对候选人整体表现的观察（如抗压能力、沟通风格等）
- critical_moments: 字符串数组，关键对话摘录（如"追问Redis持久化时候选人答错"）

示例：
{{"weaknesses":["Redis持久化机制掌握不牢"],"highlights":["操作系统内存管理回答扎实"],"overall_score":68,"key_observations":"候选人在连续追问下表现出防御性","critical_moments":["追问Redis持久化时候选人答错","候选人主动承认了项目中的技术债"]}}"""


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

    review_prompt = _build_review_prompt(req.stage, conversation)

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


class FinalReportReq(BaseModel):
    session_id: int


@router.post("/final-report")
def generate_final_report(req: FinalReportReq, user: User = Depends(require_user), db=Depends(get_db)):
    """根据 Stage 2 和 Stage 3 的面评报告，生成综合复盘报告。"""
    s = db.query(InterviewSession).filter(InterviewSession.id == req.session_id, InterviewSession.user_id == user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")

    stage_reviews = json.loads(s.stage_reviews) if s.stage_reviews else {}
    scores = json.loads(s.scores) if s.scores else {}

    stage2_review = stage_reviews.get("2", {})
    stage3_review = stage_reviews.get("3", {})

    if not stage2_review or not stage3_review:
        raise HTTPException(status_code=400, detail="需先完成技术面和情景面才能生成综合报告")

    # Build context for final report prompt
    context = {
        "stage2_review": json.dumps(stage2_review, ensure_ascii=False),
        "stage3_review": json.dumps(stage3_review, ensure_ascii=False),
        "stage2_scores": json.dumps({k: v for k, v in scores.items() if "stage_2" in k}, ensure_ascii=False),
        "stage3_scores": json.dumps({k: v for k, v in scores.items() if "stage_3" in k}, ensure_ascii=False),
    }
    system_prompt = render_prompt(STAGE_PROMPTS.get(4, ""), context)

    try:
        resp = kimi_client.chat.completions.create(
            model="kimi-k2.6",
            messages=[{"role": "user", "content": system_prompt}],
            response_format={"type": "json_object"},
        )
        report_text = resp.choices[0].message.content or "{}"
        report_data = json.loads(report_text)

        # Save to session as stage 4 review
        stage_reviews[str(4)] = report_data
        s.stage_reviews = json.dumps(stage_reviews, ensure_ascii=False)
        db.commit()

        return report_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"综合报告生成失败: {e}")
