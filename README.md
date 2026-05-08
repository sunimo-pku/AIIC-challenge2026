# AIIC Challenge 2026

> 2026 年 5 月挑战赛项目仓库

## 项目状态

- **正式开始**：2026-05-10 08:00
- **当前阶段**：环境准备 & 基础测试 ✅

## 技术栈

- **后端**：Python + FastAPI + Uvicorn
- **前端**：HTML / CSS / JavaScript（纯原生）
- **大模型**：Kimi（Moonshot AI）
- **语音**：豆包语音（火山引擎）
- **部署**：Nginx 反向代理 + 云服务器

## 已配置环境

- Python 3.10 + FastAPI / Uvicorn / httpx / openai / python-dotenv
- Nginx（80/443 端口）
- GitHub 仓库已关联
- Kimi API Key & 豆包语音 API Key 已配置

## 快速启动

```bash
# 1. 进入测试服务
cd test

# 2. 启动服务
uvicorn main:app --host 127.0.0.1 --port 8000

# 3. 浏览器访问
# http://39.106.211.238/
```

## 项目结构

```
.
├── README.md               # 本文件
├── AGENTS.md               # 项目背景、环境、约定
├── .env                    # API Key 等敏感配置（已加入 .gitignore）
├── .gitignore
├── test/                   # 集成测试服务（完整微型项目）
│   ├── README.md
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── routers/
│   │   ├── services/
│   │   └── middleware/
│   ├── static/
│   │   ├── css/
│   │   ├── js/
│   │   └── index.html
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
