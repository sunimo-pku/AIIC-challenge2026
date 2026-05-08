# AIIC Challenge 2026

> 2026 年 5 月挑战赛项目仓库。
>
> 本文件面向**人类协作者**与评审；AI 编码工具的工作规范放在 [AGENTS.md](./AGENTS.md)，无需人类阅读。

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

### 推荐：一键部署 `test-deploy.sh`

```bash
bash /root/workspace/test-deploy.sh
```

脚本会自动完成三步：

1. **构建前端**：在 `test/frontend` 下执行 `npm run build`（首次自动 `npm install`）
2. **重启后端**：杀掉旧 uvicorn 进程，以 `nohup` 后台重启，日志写入 `test/logs/uvicorn.log`
3. **健康检查**：轮询 `http://127.0.0.1/health`，**返回 200 才算部署成功**

整体耗时约 7 秒，成功时输出 `[deploy] SUCCESS in Ns -- ... OK`，失败时退出码非 0 并提示日志路径。

#### 比赛日如何复用这个脚本

`test-deploy.sh` 是**为当前 `test/` 目录定制的**，比赛日题目公布、目录结构变化后，**不要直接修改它**，而是：

```bash
cp test-deploy.sh deploy.sh                # 复制为正式部署脚本
vim deploy.sh                              # 只改顶部「配置」段的 6-7 行变量：
                                           #   BACKEND_DIR / FRONTEND_DIR /
                                           #   APP_MODULE / HOST / PORT / HEALTH_URL
bash deploy.sh                             # 之后正常部署
```

脚本主体逻辑不需要动。这样 `test-deploy.sh` 留作环境回归验证，`deploy.sh` 是比赛日正式入口，两者互不污染。

### 手动启动（仅调试用）

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
├── README.md               # 本文件（给人看：项目说明、启动方式、部署流程）
├── AGENTS.md               # AI 协作规则、踩坑记录（给 AI Coding 工具读，人无需翻阅）
├── FRONTEND_STYLE.md       # 前端视觉与交互设计基准
├── test-deploy.sh          # 准备阶段的一键部署脚本（仅针对 test/ 目录）
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
