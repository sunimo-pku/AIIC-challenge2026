# MOCK MATE — AI 模拟面试官

> **让正式面试 ─ 不再是第一次。**
>
> 为大厂技术岗求职而生的 AI 私人面试官 · 高频对练 / 沉浸演练 / 结构化复盘。
>
> 2026 年 5 月 AIIC 挑战赛参赛项目。本文件面向**人类协作者与评审**；AI 编码工具的工作规范放在 [AGENTS.md](./AGENTS.md)。

## 项目状态

- **题目公布**：2026-05-10 08:00 ✅
- **提交截止**：2026-05-10 24:00
- **当前阶段**：MVP 开发中
- **公网访问**：http://39.106.211.238/

## 我们解决的问题

**目标用户**：所有准备大厂技术岗位面试的求职者。

- 在校学生：冲字节 / 阿里 / 腾讯 / 美团等的暑期或日常实习
- 应届毕业生：参加大厂校招技术岗
- 在职工程师：跳槽冲击大厂、或从中小厂晋升头部互联网

**他们在面试前夜共同的痛点**：

| 痛点 | 现状 | MOCK MATE 怎么解 |
|---|---|---|
| 找不到对练搭子 | 学长不愿意陪练第 8 次、Mentor 没空 | AI 24h 在线，可对同一关刷到吐 |
| 反馈"答得不好"但不知怎么改 | 朋友给的反馈泛泛而谈 | 每关结束输出结构化面评：弱点 / 亮点 / 关键对话摘录 / 改进建议 |
| 第一次面试就是"开盲盒" | 没有低成本预演渠道 | 先在 AI 这跑通整套 5 关流程，正式面试就是第二次 |
| 复盘没有抓手 | 凭记忆复盘漏洞百出 | 跨关累积评分 → 综合雷达图 → 录用建议大字结论 |

## 产品定位

我们不是又一个 ChatGPT 套壳。区别于直接使用通用 ChatBot，MOCK MATE 在以下三处建立护城河：

1. **面试官人格的跨关一致性**——技术官在前一关问倒你的 Redis 持久化，HR 在第三关接过来时会"刚才看到你在 Redis 上有些迟疑"。通用 ChatBot 每开一段对话都是失忆状态，做不到这件事。
2. **专项练习的"无记忆"刻意练习**——想专攻 STAR 行为面，连刷 5 题，每次都是白板。不会被昨天的弱点反复点名，符合刻意练习的心智模型。
3. **结构化反馈而非聊天式建议**——每关一份 JSON 化面评（亮点/弱点/总评分/关键观察/对话摘录），跑完 5 关一份带雷达图的综合报告 + 录用建议徽章。复盘不再凭记忆。

## 双模式：练习 vs 模拟

产品按用户**生命周期需求**切分为两条互补主线（顶层 `/interview` 模式选择页二选一进入）：

| | **练习模式** `/interview/practice` | **模拟模式** `/interview/mock` |
|---|---|---|
| 适用阶段 | 面试还有 2~6 周 | 面试前一周 / 当晚 |
| 心智模型 | LeetCode 单题刷题 | 模拟卷一气呵成 |
| 5 关访问 | 任意进入、任意切换 | 严格线性，必须依次解锁 |
| 跨关上下文 | 无（每关独立） | 强（前关面评/分数注入下关 prompt） |
| 数据持久化 | 仅留档 `practice_logs` | 全量持久化 `interview_sessions` |
| 终局产物 | 单关反馈 | 综合复盘报告 + 录用建议 |
| 主接口 | `/practice/*` | `/interview/*` |

> 这是产品形态的核心：高频对练（练习）+ 沉浸演练（模拟）形成闭环——通用 ChatBot 既无法保持「面试官人格的跨关一致性」，也无法做「专项无记忆刻意练习」，这两点形成产品差异化护城河。

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
| **双模式选择** | ✅ | 顶层入口二选一：练习模式（自由专项）/ 模拟模式（线性沉浸）|
| 5 关面试流程 | ✅ | 面试攻略 → 简历评估 → 技术面 → 情景面 → 总结 |
| 联网情报搜集 | ✅ | 第 0 关调用 Kimi 联网搜索生成定制化面经报告 |
| 简历标签云 | ✅ | 第 1 关 AI 直读 PDF 提取技术栈、风险点、深挖项目 |
| 双栏对战室 | ✅ | 第 2/3/4 关左侧对话 + 右侧面板（雷达图/场景/面评）|
| 情景面综合能力 | ✅ | 第 3 关场景冲突 + STAR 行为面试 |
| SVG 雷达图 | ✅ | 实时评估 10 维能力，纯 SVG 零依赖 |
| **跨关 prompt 注入** | ✅ | 模拟模式下，后关面试官能看到前关面评/评分/弱点（差异化卖点）|
| **复盘报告页** | ✅ | 模拟跑完 5 关后生成综合雷达 + 5 关摘要 + 录用建议 |
| **练习历史留档** | ✅ | 练习模式可一键将本次对话保存到 `practice_logs` |
| AI 对话 | ✅ | Kimi k2.6 / DeepSeek v4-pro 双模型，SSE 流式输出 |
| Markdown 渲染 | ✅ | GFM + KaTeX 数学公式 + 代码语法高亮 |
| 用户系统 | ✅ | 注册 / 登录 / JWT 认证 |
| 云端面试会话 | ✅ | InterviewSession + PracticeProfile 持久化到 SQLite |
| 主题切换 | ✅ | 亮色 / 暗色 |

## 快速启动

### 推荐：一键部署 `deploy.sh`

```bash
bash /root/workspace/deploy.sh
```

脚本会自动完成三步：

1. **构建前端**：在 `main/frontend` 下执行 `npm run build`（首次自动 `npm install`）
2. **重启后端**：杀掉旧 uvicorn 进程，以 `nohup` 后台重启，日志写入 `main/logs/uvicorn.log`
3. **健康检查**：轮询 `http://127.0.0.1/health`，**返回 200 才算部署成功**

整体耗时约 7-9 秒，成功时输出 `[deploy] SUCCESS in Ns -- ... OK`，失败时退出码非 0 并提示日志路径。

### 手动启动（仅调试用）

```bash
# 1. 进入前端目录并构建
cd main/frontend
npm install
npm run build

# 2. 启动后端服务
cd /root/workspace/main
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
├── main/                   # 正式项目（前后端完整应用）
│   ├── app/                # FastAPI 后端
│   │   ├── main.py
│   │   ├── config.py       # 配置加载
│   │   ├── db.py           # SQLAlchemy 数据库模型（User / ChatSession / InterviewSession）
│   │   ├── routers/        # API 路由
│   │   │   ├── interview.py  # 模拟模式：场次 CRUD + 跨关 chat + stage_review
│   │   │   ├── practice.py   # 练习模式：profile 单例 + 无记忆 chat + logs 留档
│   │   │   └── (其它) auth / sessions / chat / tts / asr / upload
│   │   ├── services/       # 业务逻辑（Kimi / prompts / 豆包语音 / 工具调用）
│   │   │   └── prompts.py    # 5 关 System Prompt 模板
│   │   └── middleware/     # 认证 / 错误处理 / 限流中间件
│   ├── frontend/           # React 前端源码
│   │   ├── src/
│   │   │   ├── pages/      # 页面（Login / Register / interview/*）
│   │   │   │   └── interview/
│   │   │   │       ├── ModeSelect.tsx       # 顶层入口：练习 / 模拟二选一
│   │   │   │       ├── PracticeHub.tsx      # 练习模式：target 表单 + 5 关入口
│   │   │   │       ├── MockHub.tsx          # 模拟模式：场次列表 + 新建
│   │   │   │       ├── MockReport.tsx       # 模拟模式跑完 5 关后的复盘报告
│   │   │   │       ├── InterviewLayout.tsx  # 公共布局（按 mode 切 nav 行为）
│   │   │   │       ├── Stage0Intel.tsx      # 面试攻略（双模式适配）
│   │   │   │       ├── Stage1Resume.tsx     # 简历评估（双模式适配）
│   │   │   │       ├── Stage2Technical.tsx  # 技术面（TemplateB 包装）
│   │   │   │       ├── Stage3Scenario.tsx   # 情景面（含场景题预生成）
│   │   │   │       ├── Stage4Summary.tsx    # 总结（TemplateB 包装）
│   │   │   │       └── TemplateB.tsx        # Stage 2/3/4 共用对话模板
│   │   │   ├── contexts/   # InterviewContext（模拟）+ PracticeContext（练习）
│   │   │   ├── components/ # UI 组件（RadarChart / MarkdownRenderer / StageSidebar 等）
│   │   │   └── hooks/      # 自定义 Hooks（useInterviewMode 路径感知模式）
│   │   └── dist/           # 构建产物
│   ├── data/               # SQLite 数据库文件
│   └── logs/
├── test/                   # 准备阶段集成测试服务（保留做回归验证）
│   ├── app/
│   ├── frontend/
│   ├── data/
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
