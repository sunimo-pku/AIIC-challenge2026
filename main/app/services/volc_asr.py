import base64
import json
import uuid
import httpx
from app.config import Config


ASR_FLASH_URL = "https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash"
ASR_RESOURCE_ID = "volc.bigasr.auc_turbo"


def recognize(audio_base64: str, audio_format: str = "wav") -> dict:
    """调用火山引擎大模型录音文件极速版识别 API

    Args:
        audio_base64: base64 编码的音频数据
        audio_format: 音频格式，支持 wav/mp3/ogg/pcm

    Returns:
        {"text": "识别文本"} 或 {"error": "错误信息"}
    """
    if not Config.VOLC_API_KEY:
        return {"error": "VOLC_API_KEY not configured"}

    headers = {
        "Content-Type": "application/json",
        "X-Api-Key": Config.VOLC_API_KEY,
        "X-Api-Resource-Id": ASR_RESOURCE_ID,
        "X-Api-Request-Id": str(uuid.uuid4()),
        "X-Api-Sequence": "-1",
    }

    payload = {
        "user": {"uid": "aiic_user"},
        "audio": {"data": audio_base64, "format": audio_format},
        "request": {
            "model_name": "bigmodel",
            "enable_itn": True,
            "enable_punc": True,
        },
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(ASR_FLASH_URL, headers=headers, json=payload)

        status_code = resp.headers.get("X-Api-Status-Code", "")
        message = resp.headers.get("X-Api-Message", "")

        if status_code == "20000000":
            data = resp.json()
            result = data.get("result", {})
            text = result.get("text", "")
            return {"text": text}
        elif status_code == "20000003":
            return {"error": "未检测到有效语音，请靠近麦克风重试"}
        else:
            return {"error": f"ASR failed: [{status_code}] {message}"}

    except httpx.TimeoutException:
        return {"error": "ASR request timeout"}
    except Exception as e:
        return {"error": f"ASR exception: {str(e)}"}
