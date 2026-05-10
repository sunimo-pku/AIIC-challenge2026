import os
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db, User as UserRow, PracticeProfile
from app.middleware.auth import require_user, User

router = APIRouter(prefix="/upload", tags=["Upload"])

RESUME_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "resumes")
os.makedirs(RESUME_DIR, exist_ok=True)


class UploadResp(BaseModel):
    filename: str
    type: str
    file_path: str
    size: int


@router.post("", response_model=UploadResp)
async def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """上传 PDF 简历文件，作为该账号的"主简历"覆盖保存。

    设计要点：
    - **每个用户只保留一份简历**。文件名固定为 `user_{user_id}.pdf`，再次上传直接覆盖；
      不再用 `name_1.pdf / name_2.pdf` 这种 counter 后缀堆积老文件。
    - 上传完成后立刻把路径写到 `User.resume_file_path`，并同步更新该用户的
      `PracticeProfile.resume_file_path`（如果已存在），让所有入口下次读到的都是新简历。
    - 历史 `InterviewSession.resume_file_path` 不主动级联修改：它代表那场面试当时使用
      的简历快照，用户改主简历不该影响过去面试的复盘上下文。
    - 必须登录：公网 IP 暴露的服务必须防止匿名往磁盘上扔大文件。
    """
    content_type = file.content_type or ""
    filename = file.filename or "unknown"
    file_bytes = await file.read()
    size = len(file_bytes)

    if size > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="文件大小超过 20MB 限制")

    if not (filename.lower().endswith(".pdf") or content_type == "application/pdf"):
        raise HTTPException(
            status_code=415, detail=f"不支持的文件类型: {content_type}。仅支持 PDF"
        )

    # 固定文件名：每个用户唯一一份主简历
    file_path = os.path.join(RESUME_DIR, f"user_{user.id}.pdf")
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # 同步到 User 表（主来源）
    user_row = db.query(UserRow).filter(UserRow.id == user.id).first()
    if user_row:
        user_row.resume_file_path = file_path
        db.commit()

    # 同步到 PracticeProfile（如果存在）：让练习页"上传后立刻看到新简历"
    pp = db.query(PracticeProfile).filter(PracticeProfile.user_id == user.id).first()
    if pp:
        pp.resume_file_path = file_path
        db.commit()

    return UploadResp(
        filename=filename,
        type="pdf",
        file_path=file_path,
        size=size,
    )
