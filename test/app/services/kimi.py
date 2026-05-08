from openai import OpenAI
from app.config import Config

client = OpenAI(api_key=Config.KIMI_API_KEY, base_url=Config.KIMI_BASE_URL)


def _build_messages(message: str, images: list[str]):
    """构建支持图文混合的消息列表"""
    if not images:
        return [{"role": "user", "content": message}]

    content = []
    for img_b64 in images:
        # 如果前端已经带了 data:image/xxx;base64, 前缀，直接使用
        # 否则补全前缀
        url = img_b64 if img_b64.startswith("data:") else f"data:image/jpeg;base64,{img_b64}"
        content.append({"type": "image_url", "image_url": {"url": url}})
    content.append({"type": "text", "text": message})
    return [{"role": "user", "content": content}]


def chat(message: str, images: list[str] | None = None) -> str:
    if not Config.KIMI_API_KEY or Config.KIMI_API_KEY == "your_kimi_api_key_here":
        return "⚠️ KIMI_API_KEY 未配置，请在项目根目录的 .env 文件中设置。"

    try:
        resp = client.chat.completions.create(
            model=Config.KIMI_MODEL,
            messages=_build_messages(message, images or []),
        )
        return resp.choices[0].message.content
    except Exception as e:
        return f"调用失败: {str(e)}"


def chat_stream(message: str, images: list[str] | None = None):
    """流式生成器，yield SSE 格式字符串"""
    if not Config.KIMI_API_KEY or Config.KIMI_API_KEY == "your_kimi_api_key_here":
        yield "data: ⚠️ KIMI_API_KEY 未配置\n\n"
        yield "data: [DONE]\n\n"
        return

    try:
        stream = client.chat.completions.create(
            model=Config.KIMI_MODEL,
            messages=_build_messages(message, images or []),
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield f"data: {delta}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        yield f"data: [ERROR] {str(e)}\n\n"
        yield "data: [DONE]\n\n"
