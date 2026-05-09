import time
from collections import defaultdict
from fastapi import Request, HTTPException, status

# 内存限流器：按 client IP 统计
# 生产环境可替换为 Redis，但限时项目内存方案足够
_rate_records: dict[str, list[float]] = defaultdict(list)

# 限流配置：每 60 秒最多 30 次请求（足够正常使用，防止恶意刷）
WINDOW_SECONDS = 60
MAX_REQUESTS = 30


async def rate_limit_middleware(request: Request, call_next):
    """简易滑动窗口限流中间件"""
    # 跳过静态资源和 health 检查
    path = request.url.path
    if path.startswith("/assets") or path == "/health" or path.startswith("/static"):
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"
    now = time.time()
    key = f"{client_ip}:{path}"

    # 清理过期记录
    records = _rate_records[key]
    cutoff = now - WINDOW_SECONDS
    _rate_records[key] = [ts for ts in records if ts > cutoff]

    if len(_rate_records[key]) >= MAX_REQUESTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please slow down.",
        )

    _rate_records[key].append(now)
    response = await call_next(request)
    return response


def reset_limiter():
    """测试/重启时清空限流记录"""
    _rate_records.clear()
