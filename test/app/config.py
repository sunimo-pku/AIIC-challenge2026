import os
from dotenv import load_dotenv

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
project_root = os.path.dirname(base_dir)
load_dotenv(os.path.join(project_root, ".env"))


class Config:
    KIMI_API_KEY = os.getenv("KIMI_API_KEY", "")
    KIMI_BASE_URL = "https://api.moonshot.cn/v1"
    KIMI_MODEL = "kimi-k2.6"

    VOLC_API_KEY = os.getenv("VOLC_API_KEY", "")
    VOLC_TTS_URL = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
    VOLC_TTS_RESOURCE_ID = "volc.service_type.10029"
    VOLC_DEFAULT_SPEAKER = "zh_female_qingchezizi_moon_bigtts"
