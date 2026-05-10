import os
import re
import shutil
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


def _safe_filename(name: str) -> str:
    """剥掉路径分隔符 / NUL，限制长度。保留原文件名（含中文）让用户在前端能识别"。
    Path traversal 防护：禁止 ``..`` / 绝对路径前缀；以下字符替换为下划线：``/ \\ \0``。
    """
    base = os.path.basename(name or "")
    base = base.replace("\\", "_").replace("/", "_").replace("\0", "_")
    base = re.sub(r"\s+", " ", base).strip()
    if not base or base in (".", ".."):
        base = "resume.pdf"
    return base[:120]


@router.post("", response_model=UploadResp)
async def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """上传 PDF 简历文件，作为该账号的"主简历"。

    设计要点：
    - **每个用户只保留一份简历**：路径形如 ``data/resumes/{user_id}/{原始文件名}.pdf``。
      上传时先把该用户子目录里的旧文件全部清掉（包括上一次上传的同名 / 不同名 PDF），
      再写入新文件。这样既满足"每用户一份"又保留用户原始文件名，方便用户识别。
    - 上传完成后立刻把路径写到 ``User.resume_file_path``，并同步该用户的
      ``PracticeProfile.resume_file_path``（如果已存在），让所有入口下次读到的都是新简历。
    - 历史 ``InterviewSession.resume_file_path`` 不主动级联修改：它代表那场面试当时使用
      的简历快照，用户改主简历不该影响过去面试的复盘上下文。
    - 必须登录：公网 IP 暴露的服务必须防止匿名往磁盘上扔大文件。
    """
    content_type = file.content_type or ""
    raw_name = file.filename or "resume.pdf"
    file_bytes = await file.read()
    size = len(file_bytes)

    if size > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="文件大小超过 20MB 限制")

    if not (raw_name.lower().endswith(".pdf") or content_type == "application/pdf"):
        raise HTTPException(
            status_code=415, detail=f"不支持的文件类型: {content_type}。仅支持 PDF"
        )

    safe_name = _safe_filename(raw_name)
    if not safe_name.lower().endswith(".pdf"):
        safe_name += ".pdf"

    # 每用户一个子目录：上传新简历前先清空目录，保证"每用户一份"
    user_dir = os.path.join(RESUME_DIR, str(user.id))
    if os.path.isdir(user_dir):
        # 只清当前用户目录下的文件，不递归到其他用户目录（防御性）
        for entry in os.listdir(user_dir):
            full = os.path.join(user_dir, entry)
            try:
                if os.path.isfile(full):
                    os.remove(full)
                elif os.path.isdir(full):
                    shutil.rmtree(full)
            except OSError:
                # 即使清旧文件失败也继续——下面会覆盖式写新文件
                pass
    else:
        os.makedirs(user_dir, exist_ok=True)

    file_path = os.path.join(user_dir, safe_name)
    with open(file_path, "wb") as f:
        f.write(file_bytes)

    user_row = db.query(UserRow).filter(UserRow.id == user.id).first()
    if user_row:
        user_row.resume_file_path = file_path
        db.commit()

    pp = db.query(PracticeProfile).filter(PracticeProfile.user_id == user.id).first()
    if pp:
        pp.resume_file_path = file_path
        db.commit()

    return UploadResp(
        filename=safe_name,
        type="pdf",
        file_path=file_path,
        size=size,
    )
