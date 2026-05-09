# test / 集成测试服务

本目录是一个完整的微型全栈服务，用于验证服务器环境和第三方 API 连通性。

## 技术栈

- **后端**：Python + FastAPI + SQLAlchemy (SQLite)
- **前端**：Vite + React + TypeScript + Tailwind CSS v4
- **大模型**：Kimi（Moonshot AI）+ DeepSeek V4 Pro
- **语音**：豆包语音 TTS + ASR（火山引擎）
- **认证**：bcrypt + JWT

## 项目结构

```
test/
├── app/                    # FastAPI 后端
│   ├── main.py
│   ├── config.py           # 配置（含后台系统提示词）
│   ├── db.py               # SQLAlchemy 数据库模型（User + ChatSession）
│   ├── routers/            # API 路由
│   │   ├── chat.py         # AI 对话（流式 / 非流式）
│   │   ├── tts.py          # 语音合成
│   │   ├── asr.py          # 语音识别
│   │   ├── auth.py         # 注册 / 登录 / 获取用户
│   │   └── sessions.py     # 会话 CRUD（云端同步）
│   ├── services/           # 业务逻辑
│   │   ├── kimi.py         # Kimi / DeepSeek 调用
│   │   ├── volc_tts.py     # 豆包 TTS
│   │   └── volc_asr.py     # 豆包 ASR
│   └── middleware/         # 认证 / 错误处理
│       ├── auth.py         # JWT + bcrypt
│       └── error_handler.py
├── frontend/               # React 前端源码
│   ├── src/
│   │   ├── pages/          # Home / Chat / Tts / Login / Register
│   │   ├── components/     # UI 组件
│   │   └── hooks/          # useAuth / useChatSessions / useVoiceRecorder
│   └── dist/               # 构建产物
├── data/                   # SQLite 数据库文件
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
- `/login` — 登录
- `/register` — 注册
- `/chat` — AI 对话（Kimi / DeepSeek 流式输出，需登录）
- `/tts` — 语音合成（需登录）

## 接口说明

### 认证

| 接口 | 方法 | 说明 |
|------|------|------|
| `POST /auth/register` | `{username, password}` | 用户注册 |
| `POST /auth/login` | `{username, password}` | 用户登录，返回 JWT |
| `GET /auth/me` | `Authorization: Bearer` | 获取当前用户 |

### 会话（需 Bearer Token）

| 接口 | 方法 | 说明 |
|------|------|------|
| `GET /sessions` | - | 列出当前用户所有会话 |
| `POST /sessions` | `{title, messages, model, ...}` | 创建会话 |
| `PUT /sessions/:id` | `{title, messages, ...}` | 更新会话 |
| `DELETE /sessions/:id` | - | 删除会话 |

### 对话（需 Bearer Token）

| 接口 | 方法 | 说明 |
|------|------|------|
| `POST /chat` | `{message, history, model, ...}` | Kimi 文本对话（非流式） |
| `POST /chat/stream` | `{message, history, model, ...}` | Kimi 流式对话（SSE） |

### 语音（需 Bearer Token）

| 接口 | 方法 | 说明 |
|------|------|------|
| `POST /tts` | `{text, speaker?}` | 豆包语音合成 |
| `POST /asr` | `{audio, format?}` | 豆包语音识别 |

### 其他

| 接口 | 方法 | 说明 |
|------|------|------|
| `GET /health` | - | 健康检查 |

## 依赖配置

读取项目根目录的 `.env`，需配置：

```bash
KIMI_API_KEY=sk-xxx
DEEPSEEK_API_KEY=sk-xxx
VOLC_API_KEY=xxx
JWT_SECRET_KEY=your-secret-key-here
```
