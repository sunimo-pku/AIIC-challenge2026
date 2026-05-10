import os
import json
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, Float, String, Text, DateTime, ForeignKey
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

    # 第 0 关：情报局
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

    # 弱点记录：{"2": ["MySQL索引弱"], "3": ["CAP理论不清"]}
    weaknesses = Column(Text, default="{}")

    # PDF 简历文件路径（让 Kimi 直接读取，不经过 OCR）
    resume_file_path = Column(String, default="")

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# Create tables on import
Base.metadata.create_all(bind=engine)


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
