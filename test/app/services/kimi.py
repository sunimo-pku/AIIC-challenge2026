import json

from openai import OpenAI
from app.config import Config

kimi_client = OpenAI(api_key=Config.KIMI_API_KEY, base_url=Config.KIMI_BASE_URL)
deepseek_client = OpenAI(api_key=Config.DEEPSEEK_API_KEY, base_url=Config.DEEPSEEK_BASE_URL)


def _get_client(model: str | None):
    if model and model.startswith("deepseek"):
        return deepseek_client, model
    return kimi_client, Config.KIMI_MODEL


def _sse(event: dict) -> str:
    """把事件 JSON 编码后包成单行 SSE。

    必须 JSON 编码：Kimi 的 delta 经常包含 \\n / \\n\\n（标题、---、表格、$$...$$
    两侧），如果直接拼进 data: ... 中，前端按 \\n\\n 切分 SSE 消息时会把
    delta 内部的换行误判为消息边界，导致内容被截断丢弃，
    最终渲染出像 ``||---|:---|`` / ``---### 标题`` 这种粘连的乱码。
    """
    return f"data: {json.dumps(event, ensure_ascii=False)}\n\n"


def _build_content(message: str, images: list[str]):
    """构建单条消息的内容（支持图文混合）"""
    if not images:
        return message
    content = []
    for img_b64 in images:
        url = img_b64 if img_b64.startswith("data:") else f"data:image/jpeg;base64,{img_b64}"
        content.append({"type": "image_url", "image_url": {"url": url}})
    content.append({"type": "text", "text": message})
    return content


def build_messages(message: str, images: list[str], history: list[dict], system_prompt: str | None = None):
    """构建包含历史记录的完整消息列表"""
    messages = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    for item in history:
        role = item.get("role", "user")
        # 统一 role 名称：前端用 "bot"，OpenAI/Kimi 用 "assistant"
        if role == "bot":
            role = "assistant"
        content = item.get("content", "")
        item_images = item.get("images") or []
        messages.append({"role": role, "content": _build_content(content, item_images)})
    # 追加当前消息
    messages.append({"role": "user", "content": _build_content(message, images)})
    return messages


def chat(
    message: str,
    images: list[str] | None = None,
    history: list[dict] | None = None,
    model: str | None = None,
    temperature: float | None = None,
    top_p: float | None = None,
    max_tokens: int | None = None,
    system_prompt: str | None = None,
) -> str:
    client, actual_model = _get_client(model)
    if not client.api_key or client.api_key == "your_kimi_api_key_here":
        provider = "DeepSeek" if model and model.startswith("deepseek") else "Kimi"
        return f"⚠️ {provider} API_KEY 未配置，请在项目根目录的 .env 文件中设置。"

    try:
        kwargs = {
            "model": actual_model,
            "messages": build_messages(message, images or [], history or [], system_prompt),
        }
        if temperature is not None:
            kwargs["temperature"] = temperature
        if top_p is not None:
            kwargs["top_p"] = top_p
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens
        resp = client.chat.completions.create(**kwargs)
        return resp.choices[0].message.content
    except Exception as e:
        return f"调用失败: {str(e)}"


def chat_stream(
    message: str,
    images: list[str] | None = None,
    history: list[dict] | None = None,
    model: str | None = None,
    temperature: float | None = None,
    top_p: float | None = None,
    max_tokens: int | None = None,
    system_prompt: str | None = None,
):
    """流式生成器，yield SSE 格式字符串。

    事件协议（前端按行 ``data: <json>\\n\\n`` 解析后 JSON.parse）：
      {"delta": "..."}   — 增量文本
      {"error": "..."}   — 错误信息
      {"done": true}     — 流结束
    """
    client, actual_model = _get_client(model)
    if not client.api_key or client.api_key == "your_kimi_api_key_here":
        provider = "DeepSeek" if model and model.startswith("deepseek") else "Kimi"
        yield _sse({"error": f"⚠️ {provider} API_KEY 未配置，请在项目根目录的 .env 文件中设置。"})
        yield _sse({"done": True})
        return

    try:
        kwargs = {
            "model": actual_model,
            "messages": build_messages(message, images or [], history or [], system_prompt),
            "stream": True,
        }
        if temperature is not None:
            kwargs["temperature"] = temperature
        if top_p is not None:
            kwargs["top_p"] = top_p
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens
        stream = client.chat.completions.create(**kwargs)
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield _sse({"delta": delta})
        yield _sse({"done": True})
    except Exception as e:
        yield _sse({"error": str(e)})
        yield _sse({"done": True})
