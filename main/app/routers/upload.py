import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/upload", tags=["Upload"])

RESUME_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "resumes")
os.makedirs(RESUME_DIR, exist_ok=True)


class UploadResp(BaseModel):
    filename: str
    type: str
    file_path: str
    size: int


@router.post("", response_model=UploadResp)
async def upload_file(file: UploadFile = File(...)):
    """上传 PDF 简历文件，保存到本地供 Kimi 直接读取（不做 OCR 文本提取）"""
    content_type = file.content_type or ""
    filename = file.filename or "unknown"
    file_bytes = await file.read()
    size = len(file_bytes)

    if size > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="文件大小超过 20MB 限制")

    # 只接受 PDF
    if not (filename.lower().endswith(".pdf") or content_type == "application/pdf"):
        raise HTTPException(
            status_code=415, detail=f"不支持的文件类型: {content_type}。仅支持 PDF"
        )

    # 保存到本地
    safe_name = filename.replace("/", "_").replace("\\", "_")
    file_path = os.path.join(RESUME_DIR, safe_name)
    # 如果文件已存在，追加数字
    base, ext = os.path.splitext(file_path)
    counter = 1
    while os.path.exists(file_path):
        file_path = f"{base}_{counter}{ext}"
        counter += 1

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    return UploadResp(
        filename=filename,
        type="pdf",
        file_path=file_path,
        size=size,
    )
