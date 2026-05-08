# test / 集成测试服务

本目录是一个完整的微型后端服务，用于验证服务器环境和第三方 API 连通性。

## 项目结构

```
test/
├── app/
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置管理（读取根目录 .env）
│   ├── routers/
│   │   ├── chat.py          # Kimi 对话路由
│   │   └── tts.py           # 豆包语音合成路由
│   ├── services/
│   │   ├── kimi.py          # Kimi 服务封装
│   │   └── volc_tts.py      # 火山 TTS 服务封装
│   └── middleware/
│       └── error_handler.py # 全局异常处理
├── static/
│   ├── css/style.css        # 样式
│   ├── js/app.js            # 前端逻辑
│   └── index.html           # 测试页面
├── logs/                    # 运行日志
└── README.md
```

## 启动方式

```bash
cd /root/workspace/test
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

生产环境已通过 Nginx 将 80 端口反向代理到 `127.0.0.1:8000`。

## 接口说明

| 接口 | 方法 | 说明 |
|------|------|------|
| `GET /` | - | 测试页面 |
| `GET /health` | - | 健康检查 |
| `POST /chat` | `{message}` | Kimi 文本对话（kimi-k2.6） |
| `POST /tts` | `{text, speaker?}` | 豆包语音合成 |

## 访问地址

浏览器打开：`http://<服务器IP>/`

## 依赖配置

读取项目根目录的 `.env`，需配置：

```bash
KIMI_API_KEY=sk-xxx
VOLC_API_KEY=xxx
```
