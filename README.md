# AI 模拟面试官

> 2026 年 5 月 AIIC 挑战赛项目 —— 帮助本科生高效准备大厂实习面试与保研复试的 AI 模拟面试产品。
>
> 本文件面向**人类协作者**与评审；AI 编码工具的工作规范放在 [AGENTS.md](./AGENTS.md)，无需人类阅读。

## 项目状态

- **题目公布**：2026-05-10 08:00 ✅
- **提交截止**：2026-05-10 24:00
- **当前阶段**：MVP 开发中
- **公网访问**：http://39.106.211.238/

## 目标用户与核心痛点

**目标用户**：准备大厂实习面试或保研复试的本科生。

**核心痛点**：
- 找不到资深学长或专业人士进行高频对练
- 面试后没有得到针对性的、可执行的反馈
- 缺乏真实面试场景的沉浸式模拟体验
- 无法系统性复盘自己的面试表现与成长轨迹

## 产品定位

区别于直接使用通用 ChatBot，本产品在以下三个维度提供增量价值：

1. **面试场景专业化**：针对技术/行为/压力面试等不同类型，提供结构化追问与场景还原
2. **反馈可执行化**：不仅告诉"答得不好"，更给出"如何改进"的具体建议
3. **练习高频化**：7×24 可用，随时开练，降低 mock 面试的时间与社交成本

## 技术栈

- **后端**：Python + FastAPI + Uvicorn + SQLAlchemy (SQLite)
- **前端**：Vite + React + TypeScript + Tailwind CSS v4
- **大模型**：Kimi（Moonshot AI）+ DeepSeek V4 Pro
- **语音**：豆包语音 TTS + ASR（火山引擎）
- **认证**：bcrypt + JWT (python-jose)
- **部署**：Nginx 反向代理 + 云服务器

## 已配置环境

- Python 3.10 + FastAPI / Uvicorn / httpx / openai / SQLAlchemy / bcrypt / python-jose
- Node.js 20 + npm + Vite
- Nginx（80/443 端口）
- GitHub 仓库已关联
- Kimi API Key、DeepSeek API Key、豆包语音 API Key 已配置

## 核心功能

| 功能 | 状态 | 说明 |
|------|------|------|
| AI 对话 | ✅ | Kimi k2.6 / DeepSeek v4-pro 双模型，SSE 流式输出 |
| 多轮对话 | ✅ | 完整历史上下文 |
| 图片理解 | ✅ | 支持拖拽/粘贴/上传多张图片 |
| 语音识别 | ✅ | 豆包 ASR 极速版（localhost 演示） |
| 语音合成 | ✅ | 豆包 TTS 多音色 |
| Markdown 渲染 | ✅ | GFM + KaTeX 数学公式 + 代码语法高亮 |
| 用户系统 | ✅ | 注册 / 登录 / JWT 认证 |
| 云端会话 | ✅ | 登录用户会话自动同步到 SQLite |
| 系统提示词 | ✅ | 后台注入，塑造产品专业人设 |
| 主题切换 | ✅ | 亮色 / 暗色 |
| 局部重写 (Inline Edit) | ✅ | 在 AI 回复上划选文字，悬浮菜单进行润色 |
| 工具调用 (Function Calling) | ✅ | 通用函数调用框架，AI 可主动调用本地 Python 工具 |

## 快速启动

### 推荐：一键部署 `deploy.sh`

```bash
bash /root/workspace/deploy.sh
```

脚本会自动完成三步：

1. **构建前端**：在 `test/frontend` 下执行 `npm run build`（首次自动 `npm install`）
2. **重启后端**：杀掉旧 uvicorn 进程，以 `nohup` 后台重启，日志写入 `backend/logs/uvicorn.log`
3. **健康检查**：轮询 `http://127.0.0.1/health`，**返回 200 才算部署成功**

整体耗时约 7-9 秒，成功时输出 `[deploy] SUCCESS in Ns -- ... OK`，失败时退出码非 0 并提示日志路径。

> 注：当前前端源码仍位于 `test/frontend`，后续计划迁移至 `frontend/`。

### 手动启动（仅调试用）

```bash
# 1. 进入前端目录并构建
cd test/frontend
npm install
npm run build

# 2. 启动后端服务
cd /root/workspace/backend
uvicorn app.main:app --host 127.0.0.1 --port 8000

# 3. 浏览器访问
# http://39.106.211.238/
```

## 项目结构

```
.
├── README.md               # 本文件（给人看：项目说明、启动方式、部署流程）
├── AGENTS.md               # AI 协作规则、踩坑记录（给 AI Coding 工具读，人无需翻阅）
├── FRONTEND_STYLE.md       # 前端视觉与交互设计基准
├── deploy.sh               # 正式项目一键部署脚本
├── .env                    # API Key 等敏感配置（已加入 .gitignore）
├── .env.example            # .env 模板
├── .gitignore
├── backend/                # 正式后端服务
│   ├── app/                # FastAPI 后端
│   │   ├── main.py
│   │   ├── config.py       # 配置加载
│   │   ├── db.py           # SQLAlchemy 数据库模型
│   │   ├── dependencies.py # 依赖注入
│   │   ├── routers/        # API 路由（chat / auth / sessions / tts）
│   │   ├── services/       # 业务逻辑（LLM / TTS / ASR）
│   │   ├── middleware/     # 认证 / 错误处理中间件
│   │   └── models/         # Pydantic schemas
│   ├── requirements.txt
│   └── logs/
├── test/                   # 准备阶段集成测试服务（完整微型全栈项目）
│   ├── app/                # FastAPI 后端（准备阶段）
│   ├── frontend/           # React 前端源码（当前正式前端构建来源）
│   ├── data/               # SQLite 数据库文件
│   └── logs/
└── docs/                   # 项目文档
    ├── 2026-05-07_项目准备说明.pdf
    └── 2026-05-09_项目挑战说明.pdf
```

## 环境变量

复制 `.env.example` 为 `.env`，填写以下 Key：

```bash
KIMI_API_KEY=sk-xxx
DEEPSEEK_API_KEY=sk-xxx
VOLC_API_KEY=xxx
JWT_SECRET_KEY=your-secret-key-here      # 生产环境务必修改
```

## 提交代码

```bash
# 一键保存并推送到 GitHub（仅供人类用户使用）
save "你的提交说明"
```

> ⚠️ `.env` 文件包含 API Key，请勿提交到 GitHub（已配置 .gitignore）。
