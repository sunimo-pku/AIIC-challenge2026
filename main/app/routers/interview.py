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
    difficulty: str | None = "中"
    interviewer_style: str | None = "严格追问型"


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
    stage_artifacts: Optional[dict] = None
    resume_file_path: Optional[str] = None


@router.post("/sessions")
def create_session(req: CreateSessionReq, user: User = Depends(require_user), db=Depends(get_db)):
    mode = req.mode if req.mode in ("simulation", "practice") else "simulation"
    # 自动从 User.resume_file_path 拉默认主简历——避免每场新面试都要求用户重传一遍。
    # 用户在 MockHub 创建场次时仍然可以选择换一份（前端发 PUT /interview/sessions/{id}
    # 覆盖此字段；这里只是兜底默认值）。
    from app.db import User as UserRow  # 局部 import 避免循环引用
    u = db.query(UserRow).filter(UserRow.id == user.id).first()
    default_resume = (u.resume_file_path if u else "") or ""

    session = InterviewSession(
        user_id=user.id,
        company=req.company,
        position=req.position,
        mode=mode,
        resume_file_path=default_resume,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {
        "id": session.id,
        "company": session.company,
        "position": session.position,
        "mode": session.mode,
        "resume_file_path": session.resume_file_path or "",
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


def _safe_json(raw, default):
    """老库可能存在该字段为 NULL 的行（_ensure_columns 只补列、不回填默认值），
    直接 ``json.loads(None)`` 会抛 TypeError。这里做一次兜底。"""
    if not raw:
        return default
    try:
        return json.loads(raw)
    except (TypeError, ValueError):
        return default


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
        "intel_report": _safe_json(s.intel_report, {}),
        "resume_text": s.resume_text or "",
        "resume_tags": _safe_json(s.resume_tags, []),
        "resume_risks": _safe_json(s.resume_risks, []),
        "target_projects": _safe_json(s.target_projects, []),
        "stage_histories": _safe_json(s.stage_histories, {}),
        "scores": _safe_json(s.scores, {}),
        "weaknesses": _safe_json(s.weaknesses, {}),
        "stage_reviews": _safe_json(s.stage_reviews, {}),
        "stage_artifacts": _safe_json(s.stage_artifacts, {}),
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
    if req.stage_artifacts is not None:
        s.stage_artifacts = json.dumps(req.stage_artifacts, ensure_ascii=False)
    if req.resume_file_path is not None:
        s.resume_file_path = req.resume_file_path
    db.commit()
    return {"ok": True}


def _build_reviews_text(stage_reviews: dict) -> str:
    """把所有已有关卡的面评报告格式化为文本注入 Prompt。

    没有前序面评时返回明确的"忽略本块"提示而不是裸"无"——避免模板里
    "前几关已经发现的薄弱点要刻意设计场景验证" 这条指令在空数据下让 LLM
    硬挑薄弱点，或者照着"无"反复念叨。
    """
    if not stage_reviews:
        return "（本场尚无前序面评，请忽略上文【对话规则】中『上一关暴露的薄弱点要刻意设计场景验证 / 验证抗压能力』等指令，按本关角色独立出题即可）"
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
    # stage 4 走 /interview/final-report 端点，不该路由到这里。
    # 之前没拒绝时，render_prompt 拿不到 stage2_review/stage3_review 等字段会用 "{}"
    # 占位，LLM 拿空数据生成无意义复盘——这种 dead path 直接 400 拒掉更安全。
    if req.stage not in (0, 1, 2, 3):
        raise HTTPException(
            status_code=400,
            detail="stage 必须是 0-3。Stage 4 综合复盘请走 /interview/final-report 端点。",
        )
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

    # 当前已进行的轮数 = 历史里 user 消息数（已答完的轮）+ 1（当前这一轮）
    user_turns = sum(1 for m in (req.history or []) if isinstance(m, dict) and m.get("role") == "user")
    current_round = user_turns + 1
    if req.stage in (2, 3):
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

    # ── 全文数据提取：尽量把信息传到底 ──
    intel_report_data = _safe_json(s.intel_report, {})
    intel_report_full = intel_report_data.get("raw_markdown", "") if isinstance(intel_report_data, dict) else ""

    # 简历全文：优先用已存储的 resume_text，否则读 PDF
    resume_text_full = s.resume_text or ""
    if not resume_text_full and s.resume_file_path and os.path.exists(s.resume_file_path):
        try:
            with open(s.resume_file_path, "rb") as f:
                file_bytes = f.read()
            file_obj = kimi_client.files.create(
                file=(os.path.basename(s.resume_file_path), file_bytes, "application/pdf"),
                purpose="file-extract",
            )
            resume_text_full = kimi_client.files.content(file_id=file_obj.id).text
        except Exception as e:
            print(f"[Interview] Failed to read PDF for resume text: {e}")

    # 简历评估全文：从 stage_artifacts["1"] 或分散字段组装
    stage_artifacts = _safe_json(s.stage_artifacts, {})
    artifact_1 = stage_artifacts.get("1", {}) if isinstance(stage_artifacts, dict) else {}
    resume_eval_full = ""
    if isinstance(artifact_1, dict) and artifact_1.get("raw_json"):
        resume_eval_full = str(artifact_1["raw_json"])
    else:
        eval_parts = {
            "tags": _safe_json(s.resume_tags, []),
            "risks": _safe_json(s.resume_risks, []),
            "target_projects": _safe_json(s.target_projects, []),
            "score": None,
            "suggestions": artifact_1.get("suggestions", []) if isinstance(artifact_1, dict) else [],
        }
        scores_data = _safe_json(s.scores, {})
        if isinstance(scores_data, dict):
            eval_parts["score"] = scores_data.get("stage_1") or scores_data.get("overall")
        resume_eval_full = json.dumps(eval_parts, ensure_ascii=False)

    context = {
        "company": s.company,
        "position": s.position,
        "resume_tags": ", ".join(json.loads(s.resume_tags)) if s.resume_tags else "未提供",
        "target_projects": ", ".join(json.loads(s.target_projects)) if s.target_projects else "未提供",
        "intel_report": intel_text,
        "prev_reviews": prev_reviews_text,
        "audio_meta": audio_meta_text,
        "difficulty": req.difficulty or "中",
        "interviewer_style": req.interviewer_style or "严格追问型",
        "round_hint": round_hint,
        "intel_report_full": intel_report_full,
        "resume_text": resume_text_full,
        "resume_eval_full": resume_eval_full,
    }
    system_prompt = render_prompt(STAGE_PROMPTS.get(req.stage, ""), context)

    # Stage 1 降级补丁：若用户跳过 stage 0 直接做简历评估，intel_report 占位为"无"——
    # 而 STAGE_1_RESUME 模板里硬性指令"务必结合面经画像"会让 LLM 陷入分裂状态
    # （任务 2/3/4 全部围绕一个"无"展开会捏造画像 / 忽略一半指令）。
    # 这里 append 一段降级说明，明确告诉 LLM 缺画像时按通用大厂候选人评估，
    # 覆盖前文"务必结合面经"的硬性要求。
    if req.stage == 1 and not intel_report:
        system_prompt += (
            "\n\n【画像降级提示（重要）】"
            "\n本次评估暂无该公司近期面经画像。请忽略上文【任务】中所有"
            "「结合面经画像」/「特别标出与高频考点强相关的部分」/「往这家公司爱看的关键词靠」"
            "等要求，按『通用大厂技术候选人』维度产出 tags / risks / target_projects / suggestions / score 即可。"
            "\n输出 JSON schema 不变。"
        )

    # Stage 1: append PDF resume content to system_prompt
    # PDF 已在上方 context 构建阶段统一读取到 resume_text_full，这里直接追加避免重复 I/O
    if req.stage == 1 and resume_text_full:
        system_prompt += f"\n\n【候选人简历全文】\n{resume_text_full[:12000]}"  # 截断避免超长

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


def _build_review_prompt(stage: int, conversation: str, company: str = "", position: str = "") -> str:
    """根据关卡和对话记录构建面评报告的 review prompt。

    技术面（stage 2）/ 情景面（stage 3）会额外要求 LLM 输出每道题的「参考答案 + 候选人答案 + 评分要点」，
    让面试者复盘时不只看到"哪里答得不好"，还能直接学到"标答应该怎么说"。

    company / position 注入用途：让 model_answer 写作能做"公司风格倾斜"——
    比如阿里偏工程深度 → model_answer 多写量化 + trade-off；Google 偏算法 → 多写复杂度分析。
    缺省（空串）时退回到通用大厂风格。
    """
    stage_names = ["面试攻略", "简历评估", "技术面", "情景面", "总结"]
    stage_name = stage_names[stage] if stage < len(stage_names) else f"Stage {stage}"

    # 头部注入目标公司岗位上下文。空串时直接省略整段，避免渲染出"目标公司：" 空字段。
    target_block = ""
    if company or position:
        target_block = f"\n【目标公司 / 岗位】\n- 公司：{company or '未指定'} · 岗位：{position or '未指定'}\n- 复盘 model_answer 写作时请按这家公司岗位的常见风格倾斜（偏算法 / 偏工程 / 偏场景），未明确时按通用大厂技术面标准。\n"

    qa_pairs_spec = """- qa_pairs: 数组，按对话顺序逐题输出（最多 8 题，必填）。每个元素是对象：
  - question: 字符串，面试官提出的问题（原话精炼，不超过 60 字）
  - candidate_answer: 字符串，候选人的实际回答要点摘录（不超过 120 字）
  - model_answer: 字符串，**针对该问题的高质量参考答案（300-600 字）**，按"核心结论 → 关键原理 → 常见追问点"展开，能让面试者背下来直接用
  - key_points: 字符串数组，3-5 条评分要点 / 加分项（候选人答到这些就算合格）
  - candidate_score: 数字 0-100，本题得分（参考 key_points 命中度 + 表达质量）
"""

    if stage == 3:
        return f"""你是一位资深大厂面试官复盘专家，同时也是面试表达分析专家。请根据以下语音情景面试的完整对话，生成结构化面评报告。
{target_block}
【对话记录】
{conversation[:8000]}

【输出要求】
仅输出一个 JSON 对象。字段如下：
- weaknesses: 字符串数组，候选人暴露的弱点（内容 + 表达）
- highlights: 字符串数组，亮点
- overall_score: 数字 0-100，本关总体评分
- key_observations: 字符串，整体观察
- critical_moments: 字符串数组，关键对话摘录
{qa_pairs_spec}- expression_analysis: 对象
  - fluency_score: 数字 0-100，表达流畅度
  - clarity_score: 数字 0-100，结构化清晰度
  - professionalism_score: 数字 0-100，语言得体性
  - emotional_stability: 数字 0-100，情绪稳定性
  - filler_words: 字符串数组，检测到的口头禅
  - observation: 字符串，对表达状态的综合观察

【qa_pairs 中 model_answer 的写作要求（针对情景题）】
- 必须按 STAR（情境 / 任务 / 行动 / 结果）结构组织
- 给出可量化的细节（"P95 从 800ms 降到 220ms"这种具体到能背的程度）
- 用第一人称写，候选人下次能直接套
- 末尾用一句话点出"面试官这道题真正想看什么"

示例（仅作格式参考，实际内容必须基于对话）：
{{"weaknesses":["压力下逻辑跳跃"],"highlights":["主动提出折中方案"],"overall_score":70,"key_observations":"内容不错但紧张时表达退化","critical_moments":["被质疑后语气变防御"],"qa_pairs":[{{"question":"上线前 30 分钟发现 P2 bug 怎么办","candidate_answer":"会先回滚再排查","model_answer":"先用 30 秒判断影响面：影响核心流程立刻回滚（情境）；如果是边缘流程，开 feature flag 灰度关掉这条路径并保留主链路上线（任务）；同时拉测试和 PM 进会议室，5 分钟内决定 ABC 三选一（行动）；上线后 24 小时内出 RCA 文档，复盘修复路径与监控盲点（结果）。面试官在这题真正考察的是"事故下的优先级排序能力"和"敢不敢拍板"，而不是技术解法本身。","key_points":["先量化影响再决策","保留 rollback 选项","明确决策时间窗","上线后必须有 RCA"],"candidate_score":55}}],"expression_analysis":{{"fluency_score":65,"clarity_score":72,"professionalism_score":75,"emotional_stability":60,"filler_words":["嗯","然后"],"observation":"紧张时口头禅密集"}}}}"""
    elif stage == 2:
        return f"""你是一位资深大厂面试官复盘专家。请根据以下第 {stage} 关（{stage_name}）的完整面试对话，生成一份结构化的面评报告。
{target_block}
【对话记录】
{conversation[:8000]}

【输出要求】
仅输出一个 JSON 对象，不要包含任何 Markdown 或其他说明。字段如下：
- weaknesses: 字符串数组，候选人暴露的弱点/答错的点
- highlights: 字符串数组，候选人表现亮点的点
- overall_score: 数字 0-100，本关总体评分
- key_observations: 字符串，对候选人整体表现的观察（如抗压能力、沟通风格等）
- critical_moments: 字符串数组，关键对话摘录（如"追问Redis持久化时候选人答错"）
{qa_pairs_spec}
【qa_pairs 中 model_answer 的写作要求（针对技术题）】
- 必须给出**完整的标准答案**，包括核心原理 / 关键名词解释 / 典型追问点的应对
- 涉及代码题给关键代码段（伪代码或主流语言均可，标注时间复杂度 / 空间复杂度）
- 涉及系统设计题给"先 X 后 Y 的取舍逻辑"，至少列 2 个折中方案
- 末尾用一句话点出"这题面试官真正想考的是 XX"

示例（仅作格式参考）：
{{"weaknesses":["Redis持久化机制掌握不牢"],"highlights":["内存管理回答扎实"],"overall_score":68,"key_observations":"连续追问下出现防御性回答","critical_moments":["追问Redis持久化时候选人答错"],"qa_pairs":[{{"question":"Redis 的 RDB 和 AOF 区别，生产怎么选","candidate_answer":"RDB 是快照 AOF 是日志，一般两个都开","model_answer":"RDB 是某一时刻全量内存快照，fork 子进程二进制 dump 到磁盘，**恢复快但有数据丢失窗口**；AOF 追加每条写命令，按 always/everysec/no 三种 fsync 策略落盘，**数据安全性高但 rewrite 耗 IO 且恢复慢**。生产推荐 RDB+AOF 双开 + AOF everysec，既有快速冷启动又有秒级数据保障；6.0 之后还可以开 RDB-AOF 混合持久化（aof-use-rdb-preamble），rewrite 时把 RDB 二进制写进 AOF 头，恢复速度兼顾两者。这题面试官真正想考察的是候选人是否懂得"持久化策略本质是性能 vs 一致性的取舍"。","key_points":["RDB 是快照 / AOF 是 WAL","fsync 策略 always/everysec/no","RDB-AOF 混合持久化","生产推荐双开"],"candidate_score":40}}]}}"""
    else:
        return f"""你是一位资深大厂面试官复盘专家。请根据以下第 {stage} 关（{stage_name}）的完整面试对话，生成一份结构化的面评报告。
{target_block}
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
    # 防御：如果前端某个旧版本忘了剥 [[STAGE_END]] sentinel（面试官主动收尾用的内部信号），
    # 这里也强制剥一遍，避免 review prompt 里出现裸 sentinel 让模型反复模仿这个 token。
    convo_lines = []
    for msg in stage_msgs:
        role = msg.get("role", "")
        content = (msg.get("content", "") or "").replace("[[STAGE_END]]", "").rstrip()
        if role == "user":
            convo_lines.append(f"候选人：{content}")
        elif role == "assistant":
            convo_lines.append(f"面试官：{content}")
    conversation = "\n\n".join(convo_lines)

    review_prompt = _build_review_prompt(req.stage, conversation, s.company or "", s.position or "")

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
    difficulty: str | None = "中"
    interviewer_style: str | None = "严格追问型"


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

    # ── 全文数据提取（Stage 4 同样需要）──
    intel_report_data = _safe_json(s.intel_report, {})
    intel_report_full = intel_report_data.get("raw_markdown", "") if isinstance(intel_report_data, dict) else ""

    resume_text_full = s.resume_text or ""
    if not resume_text_full and s.resume_file_path and os.path.exists(s.resume_file_path):
        try:
            with open(s.resume_file_path, "rb") as f:
                file_bytes = f.read()
            file_obj = kimi_client.files.create(
                file=(os.path.basename(s.resume_file_path), file_bytes, "application/pdf"),
                purpose="file-extract",
            )
            resume_text_full = kimi_client.files.content(file_id=file_obj.id).text
        except Exception as e:
            print(f"[Interview] Failed to read PDF for resume text: {e}")

    stage_artifacts = _safe_json(s.stage_artifacts, {})
    artifact_1 = stage_artifacts.get("1", {}) if isinstance(stage_artifacts, dict) else {}
    resume_eval_full = ""
    if isinstance(artifact_1, dict) and artifact_1.get("raw_json"):
        resume_eval_full = str(artifact_1["raw_json"])
    else:
        eval_parts = {
            "tags": _safe_json(s.resume_tags, []),
            "risks": _safe_json(s.resume_risks, []),
            "target_projects": _safe_json(s.target_projects, []),
            "score": None,
            "suggestions": artifact_1.get("suggestions", []) if isinstance(artifact_1, dict) else [],
        }
        scores_data = _safe_json(s.scores, {})
        if isinstance(scores_data, dict):
            eval_parts["score"] = scores_data.get("stage_1") or scores_data.get("overall")
        resume_eval_full = json.dumps(eval_parts, ensure_ascii=False)

    # Build context for final report prompt
    context = {
        "company": s.company or "",
        "position": s.position or "",
        "stage2_review": json.dumps(stage2_review, ensure_ascii=False),
        "stage3_review": json.dumps(stage3_review, ensure_ascii=False),
        "stage2_scores": json.dumps({k: v for k, v in scores.items() if "stage_2" in k}, ensure_ascii=False),
        "stage3_scores": json.dumps({k: v for k, v in scores.items() if "stage_3" in k}, ensure_ascii=False),
        "difficulty": req.difficulty or "中",
        "interviewer_style": req.interviewer_style or "严格追问型",
        "intel_report_full": intel_report_full,
        "resume_text": resume_text_full,
        "resume_eval_full": resume_eval_full,
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
