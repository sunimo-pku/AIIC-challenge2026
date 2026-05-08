from openai import OpenAI
from app.config import Config

client = OpenAI(api_key=Config.KIMI_API_KEY, base_url=Config.KIMI_BASE_URL)


def chat(message: str) -> str:
    if not Config.KIMI_API_KEY or Config.KIMI_API_KEY == "your_kimi_api_key_here":
        return "⚠️ KIMI_API_KEY 未配置，请在项目根目录的 .env 文件中设置。"

    try:
        resp = client.chat.completions.create(
            model=Config.KIMI_MODEL,
            messages=[{"role": "user", "content": message}],
        )
        return resp.choices[0].message.content
    except Exception as e:
        return f"调用失败: {str(e)}"


def chat_stream(message: str):
    """流式生成器，yield SSE 格式字符串"""
    if not Config.KIMI_API_KEY or Config.KIMI_API_KEY == "your_kimi_api_key_here":
        yield "data: ⚠️ KIMI_API_KEY 未配置\n\n"
        yield "data: [DONE]\n\n"
        return

    try:
        stream = client.chat.completions.create(
            model=Config.KIMI_MODEL,
            messages=[{"role": "user", "content": message}],
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
