import os
import json
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, Float, String, Text, DateTime, ForeignKey, inspect, text, UniqueConstraint
from sqlalchemy.orm import declarative_base, sessionmaker, Session

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "app.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    # 用户级"主简历"：每个账号只保留一份 PDF，路径固定为 data/resumes/user_{id}.pdf。
    # 替代之前每场面试都重新上传 + 服务器堆积一堆 hash 后缀文件的设计。
    # InterviewSession.resume_file_path / PracticeProfile.resume_file_path 仍然保留作为
    # 历史/会话快照（删除场次时不影响主简历），但默认值都从 User.resume_file_path 拉。
    resume_file_path = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, default="新会话")
    messages_json = Column(Text, default="[]")
    model = Column(String, default="deepseek-v4-pro")
    # 数值字段直接用 Float/Integer。早期版本用 String 是从 test/ 迁移残留，
    # 导致 sessions 路由层来回 str(...) / float(...) 转换很容易踩坑。
    temperature = Column(Float, default=1.0)
    top_p = Column(Float, default=0.95)
    max_tokens = Column(Integer, default=8192)
    system_prompt = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # 模式：'simulation' = 完整 5 关模拟（线性 + 跨关记忆，默认）
    #       'practice'   = 单关精练（实际不入此表，保留 enum 以便未来扩展）
    # 当前所有 InterviewSession 行均为 simulation；练习模式数据走 practice_logs。
    mode = Column(String, default="simulation", index=True)

    # 第 0 关：面试攻略
    company = Column(String, default="")
    position = Column(String, default="")
    intel_report = Column(Text, default="{}")

    # 第 1 关：简历评估
    resume_text = Column(Text, default="")
    resume_tags = Column(Text, default="[]")
    resume_risks = Column(Text, default="[]")
    target_projects = Column(Text, default="[]")

    # 当前进度
    current_stage = Column(Integer, default=0)

    # 各关消息历史
    stage_histories = Column(Text, default="{}")

    # 评分
    scores = Column(Text, default="{}")

    # 弱点记录（兼容保留）
    weaknesses = Column(Text, default="{}")

    # 结构化面评报告：{"2": {"weaknesses":[], "highlights":[], "overall_score":68, "key_observations":""}}
    stage_reviews = Column(Text, default="{}")

    # 各关"非对话型"的结构化产出留档：
    #   {"1": {"suggestions": [...], "raw_json": "..."},
    #    "2": {...}, ...}
    # stage_histories 只存对话流；stage_reviews 是 LLM 出的面评报告；
    # 这一列专门给 stage 1 简历评估的修改建议卡片 + raw JSON 这种"既不是消息也不是
    # 评分"的中间产物用，否则 useState 维护一刷新就丢，用户回来感觉"内容少了一段"。
    stage_artifacts = Column(Text, default="{}")

    # PDF 简历文件路径（让 Kimi 直接读取，不经过 OCR）
    resume_file_path = Column(String, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PracticeProfile(Base):
    """练习模式的全局 target（每用户单例）。
    练习模式不持久化对话历史，但需要存一份"目标公司+岗位+简历"，
    避免每次进入练习页都让用户重新填表。
    """

    __tablename__ = "practice_profiles"

    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    company = Column(String, default="")
    position = Column(String, default="")
    resume_file_path = Column(String, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PracticeContext(Base):
    """练习模式按 (公司, 岗位) 维度的画像缓存。

    练习模式天然没有"5 关跨关上下文"，单关 chat 不知道这家公司爱考什么、
    简历里有什么靶子，问题就泛化成八股套题——不够有针对性。
    解法：让用户在 stage 0（面试攻略）/ stage 1（简历评估）跑完后，
    把结构化结果按 (user_id, company, position) 三元组缓存到这一行；
    stage 2 / stage 3 chat 时后端查这一行注入 intel_report / resume_tags /
    target_projects 占位符。命中即"知道你练的是什么公司什么岗位 + 你简历里
    有什么"；未命中则前端引导用户先去 stage 0 / stage 1。

    设计要点：
    1. 不污染"独立练习"语义——本表只存"画像（公司/简历事实）"，**不存
       前关 reviews / scores**（那两个仍然走占位符），所以不会出现"面试官
       说你之前 65 分"这种破坏 mock 的鬼话。
    2. 简历过期感知——`resume_path_at_eval` 记录评估时的简历路径；用户换主
       简历后，这个字段与 `User.resume_file_path` 不一致即视为缓存过期，
       前端提示"重新评估简历"。
    3. 面经与简历独立刷新——一份缓存的两半是分别更新的：换公司只重做面经，
       不需要重做简历评估；反之亦然。
    """

    __tablename__ = "practice_contexts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    company = Column(String, nullable=False, index=True)
    position = Column(String, nullable=False, index=True)

    # Stage 0 攻略产出：含 interview_style / high_freq_topics / difficulty / prep_priority + raw_markdown
    intel_json = Column(Text, default="")
    intel_at = Column(DateTime, nullable=True)

    # Stage 1 简历评估产出：含 tags / risks / target_projects / score / suggestions / raw_json
    resume_eval_json = Column(Text, default="")
    resume_eval_at = Column(DateTime, nullable=True)
    # 评估时的简历路径快照——用户换主简历后，与 User.resume_file_path 不一致 = 缓存已过期
    resume_path_at_eval = Column(String, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "company", "position", name="uq_practice_ctx_user_co_po"),
    )


class PracticeLog(Base):
    """练习模式每次完整对话的留档（用户主动结束/切换关卡时落库）。
    用于后续做"练习历史回顾"，不参与跨关 prompt 注入——保持练习模式"无记忆"的语义。
    """

    __tablename__ = "practice_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    stage = Column(Integer, nullable=False, index=True)
    company = Column(String, default="")
    position = Column(String, default="")
    messages_json = Column(Text, default="[]")  # [{role, content}, ...]
    msg_count = Column(Integer, default=0)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, default=datetime.utcnow)


class Note(Base):
    """求职复盘笔记。
    用户在每场练习/模拟之后用 Markdown 记录自己的反思、面试题答案、待补知识点。
    设计要点：
    1. 笔记是"我自己消化的产物"，而不是 AI 报告的副本——两者并存于不同表。
    2. 关联字段（mode/stage/company/position/ref_session_id/ref_log_id）全部可空，
       支持纯独立笔记（不绑定任何 session/log），也支持从 stage 报告页"留笔记"
       自动带 ref。
    3. 不在面试 chat history 中注入笔记内容——笔记是给人看的，不进 prompt。
    """

    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String, default="")
    content = Column(Text, default="")  # markdown 全文

    mode = Column(String, default="", index=True)  # 'practice' / 'simulation' / ''
    stage = Column(Integer, nullable=True, index=True)  # 0..4 / null = 整局
    company = Column(String, default="")
    position = Column(String, default="")

    ref_session_id = Column(Integer, nullable=True, index=True)  # InterviewSession.id
    ref_log_id = Column(Integer, nullable=True, index=True)  # PracticeLog.id

    tags = Column(Text, default="[]")  # JSON 数组，预留

    # 发布状态：用户可以把笔记发布到"广场"让其他人看到。
    # 发布的笔记不能被他人编辑/删除，但可被 fork（未来扩展）。
    is_published = Column(Integer, default=0, index=True)  # SQLite 没有原生 bool，用 0/1
    published_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Create tables on import
Base.metadata.create_all(bind=engine)


def _ensure_columns():
    """SQLite 不会自动 ALTER 已有表加列。手动检查 + ADD COLUMN。
    踩坑提醒：SQLAlchemy 的 create_all 只创建不存在的表，不会改已有表结构。
    任何新增字段后，务必在此处补一条 ALTER TABLE。
    """
    insp = inspect(engine)

    # interview_sessions: mode / stage_artifacts 字段
    if insp.has_table("interview_sessions"):
        cols = {c["name"] for c in insp.get_columns("interview_sessions")}
        with engine.begin() as conn:
            if "mode" not in cols:
                conn.execute(text(
                    "ALTER TABLE interview_sessions ADD COLUMN mode VARCHAR DEFAULT 'simulation'"
                ))
            if "stage_artifacts" not in cols:
                conn.execute(text(
                    "ALTER TABLE interview_sessions ADD COLUMN stage_artifacts TEXT DEFAULT '{}'"
                ))

    # users: resume_file_path 字段（用户级单一简历架构引入时新增）
    if insp.has_table("users"):
        cols = {c["name"] for c in insp.get_columns("users")}
        with engine.begin() as conn:
            if "resume_file_path" not in cols:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN resume_file_path VARCHAR DEFAULT ''"
                ))

    # notes: 发布相关字段（笔记广场功能引入时新增）
    if insp.has_table("notes"):
        cols = {c["name"] for c in insp.get_columns("notes")}
        with engine.begin() as conn:
            if "is_published" not in cols:
                conn.execute(text(
                    "ALTER TABLE notes ADD COLUMN is_published INTEGER DEFAULT 0"
                ))
            if "published_at" not in cols:
                conn.execute(text(
                    "ALTER TABLE notes ADD COLUMN published_at DATETIME"
                ))


_ensure_columns()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def serialize_messages(messages: list[dict]) -> str:
    return json.dumps(messages, ensure_ascii=False)


def deserialize_messages(data: str) -> list[dict]:
    try:
        return json.loads(data)
    except Exception:
        return []
