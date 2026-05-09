import os
import json
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey
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
    model = Column(String, default="kimi-k2.6")
    temperature = Column(String, default="1.0")
    top_p = Column(String, default="0.95")
    max_tokens = Column(String, default="8192")
    system_prompt = Column(Text, default="")
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
