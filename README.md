# AIIC Challenge 2026

> 2026 年 5 月挑战赛项目仓库
> 
> AI Agent 在进行修改之前必须仔细阅读 `[AGENTS.md](./AGENTS.md)` 
## 项目状态

- **正式开始**：2026-05-10 08:00
- **当前阶段**：环境准备 & 基础测试 ✅

## 技术栈

- **后端**：Python + FastAPI + Uvicorn
- **前端**：Vite + React + TypeScript + Tailwind CSS
- **大模型**：Kimi（Moonshot AI）
- **语音**：豆包语音（火山引擎）
- **部署**：Nginx 反向代理 + 云服务器

## 已配置环境

- Python 3.10 + FastAPI / Uvicorn / httpx / openai / python-dotenv
- Node.js 20 + npm + Vite
- Nginx（80/443 端口）
- GitHub 仓库已关联
- Kimi API Key & 豆包语音 API Key 已配置

## 快速启动

```bash
# 1. 进入前端目录并构建
cd test/frontend
npm install
npm run build

# 2. 启动后端服务
cd /root/workspace/test
uvicorn app.main:app --host 127.0.0.1 --port 8000

# 3. 浏览器访问
# http://39.106.211.238/
```

## 项目结构

```
.
├── README.md               # 本文件
├── AGENTS.md               # 项目背景、环境、约定、踩坑记录
├── FRONTEND_STYLE.md       # 前端视觉与交互设计基准
├── .env                    # API Key 等敏感配置（已加入 .gitignore）
├── .gitignore
├── test/                   # 集成测试服务（完整微型全栈项目）
│   ├── app/                # FastAPI 后端
│   ├── frontend/           # React 前端源码
│   │   ├── src/
│   │   │   ├── pages/      # Home / Chat / Tts
│   │   │   └── components/ # UI 组件
│   │   └── dist/           # 构建产物
│   └── logs/
└── docs/                   # 项目文档
    └── 2026-05-07_项目准备说明.pdf
```

## 提交代码

```bash
# 一键保存并推送到 GitHub
save "你的提交说明"
```

---

> ⚠️ `.env` 文件包含 API Key，请勿提交到 GitHub（已配置 .gitignore）。
