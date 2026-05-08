# test / 集成测试服务

本目录是一个完整的微型全栈服务，用于验证服务器环境和第三方 API 连通性。

## 技术栈

- **后端**：Python + FastAPI
- **前端**：Vite + React + TypeScript + Tailwind CSS
- **大模型**：Kimi（Moonshot AI）
- **语音**：豆包语音（火山引擎）

## 项目结构

```
test/
├── app/                    # FastAPI 后端
│   ├── main.py
│   ├── config.py
│   ├── routers/
│   ├── services/
│   └── middleware/
├── frontend/               # React 前端源码
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   ├── components/     # UI 组件
│   │   └── lib/
│   └── dist/               # 构建产物
├── logs/                   # 运行日志
└── README.md
```

## 启动方式

```bash
# 1. 构建前端（首次或修改前端后）
cd /root/workspace/test/frontend
npm install
npm run build

# 2. 启动后端服务
cd /root/workspace/test
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

生产环境已通过 Nginx 将 80 端口反向代理到 `127.0.0.1:8000`。

## 访问地址

浏览器打开：`http://39.106.211.238/`

- `/` — 导航首页
- `/chat` — AI 对话（Kimi 流式输出）
- `/tts` — 语音合成

## 接口说明

| 接口 | 方法 | 说明 |
|------|------|------|
| `GET /health` | - | 健康检查 |
| `POST /chat` | `{message}` | Kimi 文本对话（非流式） |
| `POST /chat/stream` | `{message}` | Kimi 流式对话（SSE） |
| `POST /tts` | `{text, speaker?}` | 豆包语音合成 |

## 依赖配置

读取项目根目录的 `.env`，需配置：

```bash
KIMI_API_KEY=sk-xxx
VOLC_API_KEY=xxx
```
