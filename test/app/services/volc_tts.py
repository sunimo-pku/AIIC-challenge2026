import json
import httpx
from app.config import Config


def synthesize(text: str, speaker: str = None) -> dict:
    if not Config.VOLC_API_KEY or Config.VOLC_API_KEY == "your_volc_api_key_here":
        return {"error": "⚠️ VOLC_API_KEY 未配置"}

    headers = {
        "Content-Type": "application/json",
        "X-Api-Key": Config.VOLC_API_KEY,
        "X-Api-Resource-Id": Config.VOLC_TTS_RESOURCE_ID,
    }
    payload = {
        "user": {"uid": "test_user"},
        "req_params": {
            "text": text,
            "speaker": speaker or Config.VOLC_DEFAULT_SPEAKER,
            "audio": {"encoding": "mp3", "speed_ratio": 1.0},
        },
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(Config.VOLC_TTS_URL, headers=headers, json=payload)
            text_body = resp.text

        audio_parts = []
        lines = [l.strip() for l in text_body.strip().split("\n") if l.strip()]
        for chunk_str in lines:
            chunk = json.loads(chunk_str)
            code = chunk.get("code")
            if code not in (0, 20000000):
                return {"error": chunk.get("message", "语音合成失败")}
            if chunk.get("data"):
                audio_parts.append(chunk["data"])

        return {
            "audio_base64": "".join(audio_parts),
            "format": "mp3",
            "text": text,
        }
    except Exception as e:
        return {"error": f"请求异常: {str(e)}"}
