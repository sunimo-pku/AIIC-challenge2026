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

from app.db import get_db, PracticeProfile, PracticeLog, PracticeContext, User as UserRow
from app.middleware.auth import require_user, User
from app.services.kimi import chat_stream, kimi_client
from app.services.prompts import render_prompt, STAGE_PROMPTS
from app.routers.interview import _build_review_prompt

router = APIRouter(prefix="/practice", tags=["Practice"])


# ─── Profile（target 单例） ───

class ProfileReq(BaseModel):
    company: Optional[str] = None
    position: Optional[str] = None
    resume_file_path: Optional[str] = None


def _user_default_resume(user_id: int, db) -> str:
    u = db.query(UserRow).filter(UserRow.id == user_id).first()
    return (u.resume_file_path if u else "") or ""


@router.get("/profile")
def get_profile(user: User = Depends(require_user), db=Depends(get_db)):
    """取练习模式 profile。简历字段缺失时回退到 User.resume_file_path（用户级主简历）。
    这样新建账号 / 没填过 PracticeProfile 的情况下，刚上传过的主简历也会自动出现在练习页。
    """
    p = db.query(PracticeProfile).filter(PracticeProfile.user_id == user.id).first()
    fallback_resume = _user_default_resume(user.id, db)
    if not p:
        return {"company": "", "position": "", "resume_file_path": fallback_resume, "updated_at": None}
    return {
        "company": p.company or "",
        "position": p.position or "",
        "resume_file_path": p.resume_file_path or fallback_resume,
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


# ─── Practice Context（按 (公司, 岗位) 维度的画像缓存） ───
#
# 这两块是练习模式"针对性"的核心：用户在 stage 0 / stage 1 跑完后把结构化结果
# 显式落库到 PracticeContext，stage 2 / stage 3 chat 时后端按 (user, company,
# position) 查这一行注入面经画像 + 简历画像，未命中即返回 400 引导用户回 stage 0/1。
# 不在这里直接调 LLM——LLM 调用走现有 /practice/chat 流式接口，前端解析后再 PUT。


class IntelPayload(BaseModel):
    """Stage 0 攻略产出（前端 parse 出 JSON 块后 PUT 进来）"""
    interview_style: Optional[str] = ""
    high_freq_topics: Optional[list] = None
    difficulty: Optional[str] = ""
    prep_priority: Optional[list] = None
    raw_markdown: Optional[str] = ""


class IntelPutReq(BaseModel):
    company: str
    position: str
    intel: IntelPayload


class ResumeEvalPayload(BaseModel):
    """Stage 1 简历评估产出（前端 parse 出 JSON 后 PUT 进来）"""
    tags: Optional[list] = None
    risks: Optional[list] = None
    target_projects: Optional[list] = None
    score: Optional[float] = None
    suggestions: Optional[list] = None
    raw_json: Optional[str] = ""


class ResumeEvalPutReq(BaseModel):
    company: str
    position: str
    resume_eval: ResumeEvalPayload


def _get_or_create_practice_ctx(db, user_id: int, company: str, position: str) -> PracticeContext:
    company = (company or "").strip()
    position = (position or "").strip()
    if not company or not position:
        raise HTTPException(status_code=400, detail="company / position 不能为空")
    row = db.query(PracticeContext).filter(
        PracticeContext.user_id == user_id,
        PracticeContext.company == company,
        PracticeContext.position == position,
    ).first()
    if row is None:
        row = PracticeContext(user_id=user_id, company=company, position=position)
        db.add(row)
    return row


def _serialize_practice_ctx(row: PracticeContext | None, current_resume_path: str) -> dict:
    """返回前端友好的 JSON 视图：null 表示未生成；resume_eval_stale=True 表示用户换过简历。"""
    if row is None:
        return {
            "intel": None, "intel_at": None,
            "resume_eval": None, "resume_eval_at": None,
            "resume_eval_stale": False,
        }
    intel = json.loads(row.intel_json) if row.intel_json else None
    resume_eval = json.loads(row.resume_eval_json) if row.resume_eval_json else None
    stale = bool(
        resume_eval
        and row.resume_path_at_eval
        and current_resume_path
        and row.resume_path_at_eval != current_resume_path
    )
    return {
        "intel": intel,
        "intel_at": row.intel_at.isoformat() if row.intel_at else None,
        "resume_eval": resume_eval,
        "resume_eval_at": row.resume_eval_at.isoformat() if row.resume_eval_at else None,
        "resume_path_at_eval": row.resume_path_at_eval or "",
        "resume_eval_stale": stale,
    }


@router.get("/context")
def get_practice_context(
    company: str,
    position: str,
    user: User = Depends(require_user),
    db=Depends(get_db),
):
    """查 (user, company, position) 维度的练习画像缓存。
    `resume_eval_stale=True` 表示用户已经换了主简历，前端应提示重新评估。
    """
    company = (company or "").strip()
    position = (position or "").strip()
    if not company or not position:
        raise HTTPException(status_code=400, detail="company / position 不能为空")
    row = db.query(PracticeContext).filter(
        PracticeContext.user_id == user.id,
        PracticeContext.company == company,
        PracticeContext.position == position,
    ).first()
    return _serialize_practice_ctx(row, _user_default_resume(user.id, db))


@router.put("/context/intel")
def put_practice_intel(req: IntelPutReq, user: User = Depends(require_user), db=Depends(get_db)):
    """前端 Stage 0 攻略 chat 完成后调用，把 parse 出来的 JSON 块 + 原始 markdown 落库。"""
    row = _get_or_create_practice_ctx(db, user.id, req.company, req.position)
    row.intel_json = json.dumps(req.intel.model_dump(), ensure_ascii=False)
    row.intel_at = datetime.utcnow()
    db.commit()
    return _serialize_practice_ctx(row, _user_default_resume(user.id, db))


@router.put("/context/resume-eval")
def put_practice_resume_eval(req: ResumeEvalPutReq, user: User = Depends(require_user), db=Depends(get_db)):
    """前端 Stage 1 简历评估完成后调用，把结构化结果落库 + 记录评估时的简历路径快照。"""
    row = _get_or_create_practice_ctx(db, user.id, req.company, req.position)
    row.resume_eval_json = json.dumps(req.resume_eval.model_dump(), ensure_ascii=False)
    row.resume_eval_at = datetime.utcnow()
    row.resume_path_at_eval = _user_default_resume(user.id, db)
    db.commit()
    return _serialize_practice_ctx(row, _user_default_resume(user.id, db))


def _load_practice_ctx(db, user_id: int, company: str, position: str) -> PracticeContext | None:
    """内部 helper：练习模式 chat 注入时用，没命中返回 None。"""
    if not company or not position:
        return None
    return db.query(PracticeContext).filter(
        PracticeContext.user_id == user_id,
        PracticeContext.company == company,
        PracticeContext.position == position,
    ).first()


def _intel_text_from_ctx(ctx: PracticeContext | None) -> str:
    """把 PracticeContext.intel_json 序列化成 LLM 友好的中文段落。"""
    if not ctx or not ctx.intel_json:
        return ""
    try:
        data = json.loads(ctx.intel_json)
    except Exception:
        return ""
    parts = []
    if data.get("interview_style"):
        parts.append(f"- 面试风格：{data['interview_style']}")
    if data.get("difficulty"):
        parts.append(f"- 整体难度：{data['difficulty']}")
    topics = data.get("high_freq_topics") or []
    if topics:
        parts.append(f"- 近半年高频考点：{', '.join(topics[:8])}")
    prep = data.get("prep_priority") or []
    if prep:
        parts.append(f"- 候选人重点准备方向：{'；'.join(prep[:5])}")
    return "\n".join(parts) if parts else ""


def _resume_eval_from_ctx(ctx: PracticeContext | None) -> tuple[str, str]:
    """从 PracticeContext.resume_eval_json 抽出 (resume_tags, target_projects) 两个字符串。"""
    if not ctx or not ctx.resume_eval_json:
        return "", ""
    try:
        data = json.loads(ctx.resume_eval_json)
    except Exception:
        return "", ""
    tags = data.get("tags") or []
    projects = data.get("target_projects") or []
    return ", ".join(tags), ", ".join(projects)


# ─── Chat（流式，但不入库） ───

class PracticeChatReq(BaseModel):
    stage: int
    message: str
    history: list[dict] | None = None
    model: str | None = None
    audio_meta: dict | None = None
    difficulty: str | None = "中"
    interviewer_style: str | None = "严格追问型"


def _practice_system_prompt(
    stage: int,
    company: str,
    position: str,
    audio_meta: dict | None = None,
    difficulty: str = "中",
    interviewer_style: str = "严格追问型",
    history: list[dict] | None = None,
    practice_ctx: PracticeContext | None = None,
) -> str:
    """构造练习模式 system_prompt：模板照常用，但把跨关字段全部改为"练习模式"提示词。
    模型读到这种 placeholder 时会自然进入"独立练习"语境，不会反复 reference 不存在的前序记录。
    """
    template = STAGE_PROMPTS.get(stage, "")
    if not template:
        return ""
    # Build audio meta text for Stage 3
    audio_meta_text = "暂无音频数据"
    if stage == 3 and audio_meta:
        dur = audio_meta.get("duration", 0)
        wc = audio_meta.get("word_count", 0)
        wpm = round(wc / dur * 60, 1) if dur > 0 else 0
        avg_sr = audio_meta.get("avg_speech_rate", 0)
        avg_vol = audio_meta.get("avg_volume", 0)
        dom_emo = audio_meta.get("dominant_emotion", "未知")
        utts = audio_meta.get("utterances", [])
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
            for i, u in enumerate(utts[:8], 1):
                lines.append(f"  句{i}: 「{u.get('text', '')}」 情绪={u.get('emotion', '-')} 语速={u.get('speech_rate', 0)} 音量={u.get('volume', 0)}")
        audio_meta_text = "\n".join(lines)

    user_turns = sum(1 for m in (history or []) if isinstance(m, dict) and m.get("role") == "user")
    current_round = user_turns + 1
    if stage in (2, 3):
        if current_round <= 3:
            round_hint = f"当前是本关第 {current_round} 轮（建议 6-8 轮收尾，不要急着结束，先把题目追问到底）"
        elif current_round <= 5:
            round_hint = f"当前是本关第 {current_round} 轮（接近收尾区间 6-8 轮，可以开始考虑下一轮换主题或主动收尾）"
        elif current_round <= 7:
            round_hint = f"当前是本关第 {current_round} 轮（**已进入收尾区间**，若本题已追问到位 / 候选人疲态明显，请按【收尾输出格式】主动结束本关）"
        else:
            round_hint = f"当前是本关第 {current_round} 轮（**严重超时**，强烈建议立刻按【收尾输出格式】结束本关，避免对方疲惫）"
    else:
        round_hint = f"当前是第 {current_round} 轮"

    # 练习模式画像注入：如果 (user, company, position) 命中了 PracticeContext，
    # 把面经画像 + 简历画像注入到对应占位符；否则保留占位符（stage 0/1 自由跑，
    # stage 2/3 在 practice_chat 入口已经做了 hard 校验，能走到这里说明已命中）。
    intel_text = _intel_text_from_ctx(practice_ctx)
    resume_tags_text, target_projects_text = _resume_eval_from_ctx(practice_ctx)

    context = {
        "company": company or "某互联网公司",
        "position": position or "技术岗位",
        "intel_report": intel_text or "（练习模式 · 暂无攻略画像，请基于公司与岗位自行合理假设）",
        "prev_reviews": "（练习模式 · 本轮独立练习，无前序面试记录）",
        "resume_tags": resume_tags_text or "（练习模式 · 若有简历附件请基于其内容判断；否则按通用候选人对待）",
        "target_projects": target_projects_text or "（练习模式 · 若有简历附件请基于其内容判断；否则可让候选人自陈）",
        "all_scores_summary": "（练习模式 · 无前序评分汇总）",
        "audio_meta": audio_meta_text,
        "difficulty": difficulty,
        "interviewer_style": interviewer_style,
        "round_hint": round_hint,
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

    # 加载 (user, company, position) 维度的画像缓存
    ctx = _load_practice_ctx(db, user.id, company, position)
    ctx_view = _serialize_practice_ctx(ctx, _user_default_resume(user.id, db))

    # Stage 1（简历评估）依赖 Stage 0（面试攻略）—— 没面经画像就评不出"该公司视角"的简历好坏，
    # 评出来等于纯通用评估，stage 2/3 拿到也用不上。
    # Stage 2/3 同时依赖两块画像。
    needs_intel = not ctx_view.get("intel")
    needs_resume_eval = not ctx_view.get("resume_eval") or ctx_view.get("resume_eval_stale")

    if req.stage == 1 and needs_intel:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "practice_context_missing",
                "message": f"练习 {company} · {position} 的简历评估需要先完成面试攻略 (Stage 0)，让评估能结合这家公司的面经画像。",
                "needs_intel": True,
                "needs_resume_eval": False,  # stage 1 自己就是简历评估，不要把自己列进缺失项
                "company": company,
                "position": position,
            },
        )

    if req.stage in (2, 3) and (needs_intel or needs_resume_eval):
        missing = []
        if needs_intel:
            missing.append("面试攻略 (Stage 0)")
        if needs_resume_eval:
            missing.append(
                "简历评估 (Stage 1)" if not ctx_view.get("resume_eval") else "简历评估 (Stage 1) · 主简历已变更需重新评估"
            )
        raise HTTPException(
            status_code=400,
            detail={
                "code": "practice_context_missing",
                "message": f"练习 {company} · {position} 的{'/'.join(missing)}还没准备好，请先完成对应关卡。",
                "needs_intel": needs_intel,
                "needs_resume_eval": needs_resume_eval,
                "company": company,
                "position": position,
            },
        )

    system_prompt = _practice_system_prompt(
        req.stage, company, position, req.audio_meta,
        difficulty=req.difficulty or "中",
        interviewer_style=req.interviewer_style or "严格追问型",
        history=req.history,
        practice_ctx=ctx,
    )

    # 简历裸文注入策略：
    # - Stage 1（简历评估本身）：必须读 PDF，否则没东西可评估
    # - Stage 0（攻略）：不需要简历
    # - Stage 2 / 3：已经有 PracticeContext.resume_eval 提供结构化的 tags/target_projects，
    #   不再每次塞 12000 字裸文（节省 token + 模型更聚焦于深挖项目）
    if req.stage == 1 and resume_path and os.path.exists(resume_path):
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


# ─── Practice Stage Review（练习模式面评报告） ───

class PracticeStageReviewReq(BaseModel):
    stage: int
    messages: list[dict]


@router.post("/stage-review")
def generate_practice_stage_review(req: PracticeStageReviewReq, user: User = Depends(require_user)):
    """根据练习模式的对话历史，生成结构化面评报告（不入库，直接返回）。"""
    if not req.messages:
        raise HTTPException(status_code=400, detail="对话为空，无法生成报告")

    # Format conversation for review
    # 防御：剥掉 [[STAGE_END]] sentinel（面试官主动收尾用的内部信号），
    # 避免 review prompt 里出现裸 sentinel 让模型在新输出里反复模仿这个 token。
    convo_lines = []
    for msg in req.messages:
        role = msg.get("role", "")
        content = (msg.get("content", "") or "").replace("[[STAGE_END]]", "").rstrip()
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
        return review_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"面评报告生成失败: {e}")
