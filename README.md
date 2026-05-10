# MockMate — AI 模拟面试官

> **让正式面试 ─ 不再是第一次。**
>
> 为大厂技术岗求职而生的 AI 私人面试官 · 高频对练 / 沉浸演练 / 结构化复盘。
>
> 2026 年 5 月 AIIC 挑战赛参赛项目。本文件面向**人类协作者与评审**；AI 编码工具的工作规范放在 [AGENTS.md](./AGENTS.md)。

## 项目状态

- **题目公布**：2026-05-10 08:00 ✅
- **提交截止**：2026-05-10 24:00
- **当前阶段**：功能完善中，核心闭环已跑通
- **公网访问**：[http://39.106.211.238/](http://39.106.211.238/)

## 我们解决的问题

**目标用户**：所有准备大厂技术岗位面试的求职者。

- 在校学生：冲字节 / 阿里 / 腾讯 / 美团等的暑期或日常实习
- 应届毕业生：参加大厂校招技术岗
- 在职工程师：跳槽冲击大厂、或从中小厂晋升头部互联网

**他们在面试前夜共同的痛点**：

| 痛点             | 现状                     | MockMate 怎么解                       |
| -------------- | ---------------------- | ----------------------------------- |
| 找不到对练搭子        | 学长不愿意陪练第 8 次、Mentor 没空 | AI 24h 在线，可对同一关刷到吐                  |
| 反馈"答得不好"但不知怎么改 | 朋友给的反馈泛泛而谈             | 每关结束输出结构化面评：弱点 / 亮点 / 关键对话摘录 / 逐题解析 / 改进建议 |
| 第一次面试就是"开盲盒"   | 没有低成本预演渠道              | 先在 AI 这跑通整套 5 关流程，正式面试就是第二次         |
| 复盘没有抓手         | 凭记忆复盘漏洞百出              | 跨关累积评分 → 综合雷达图 → 录用建议大字结论           |
| 说得出但写不出        | 文字流畅但面试时紧张磕绊            | 情景面支持语音输入 + 语速/情绪/口头禅分析，专门练表达       |

## 产品定位

我们不是又一个 ChatGPT 套壳。区别于直接使用通用 ChatBot，MockMate 在以下三处建立护城河：

1. **面试官人格的跨关一致性**——模拟模式下，技术面面试官发现的 Redis 持久化薄弱点，会被注入到情景面面试官的 prompt 中，后者会刻意设计场景验证。通用 ChatBot 每开一段对话都是失忆状态，做不到这件事。
2. **专项练习的"无记忆"刻意练习**——练习模式下用户可自由进入任意关卡，模块之间不共享面评记忆，符合刻意练习的心智模型。
3. **结构化反馈而非聊天式建议**——每关一份 JSON 化面评（亮点/弱点/总评分/关键观察/对话摘录/逐题解析），跑完 5 关一份综合报告 + 录用建议。复盘不再凭记忆。

## 双模式：练习 vs 模拟

产品按用户**生命周期需求**切分为两条互补主线（顶层 `/interview` 模式选择页二选一进入）：

|       | **练习模式** `/interview/practice` | **模拟模式** `/interview/mock` |
| ----- | ------------------------------ | -------------------------- |
| 适用阶段  | 面试还有 2~6 周                     | 面试前一周 / 当晚                 |
| 心智模型  | LeetCode 单题刷题                  | 模拟卷一气呵成                    |
| 5 关访问 | 任意进入、任意切换                      | 严格线性，必须依次解锁                |
| 跨关上下文 | 基础画像共享（面经/简历），面评不共享           | 强（前关面评/分数/简历全文/评估全文注入下关 prompt） |
| 数据持久化 | Profile 单例 + PracticeContext 缓存 + PracticeLog 留档 | 全量持久化 InterviewSession |
| 终局产物  | 单关反馈                           | 综合复盘报告 + 录用建议              |
| 主接口   | `/practice/`*                  | `/interview/*`             |

## 技术栈

- **后端**：Python + FastAPI + Uvicorn + SQLAlchemy (SQLite)
- **前端**：Vite + React 19 + TypeScript + Tailwind CSS v4
- **大模型**：Kimi k2.6（Moonshot AI，主力）+ DeepSeek V4 Pro（备用）
- **语音**：豆包语音 TTS + ASR（火山引擎），支持语速/情绪/音量/口头禅多模态分析
- **认证**：bcrypt + JWT (python-jose)
- **PDF 处理**：PyMuPDF（简历上传与文本提取）
- **部署**：Nginx 反向代理 + 云服务器

## 已配置环境

- Python 3.10 + FastAPI / Uvicorn / httpx / openai / SQLAlchemy / bcrypt / python-jose / PyMuPDF
- Node.js 20 + npm + Vite
- Nginx（80/443 端口）
- GitHub 仓库已关联
- Kimi API Key、DeepSeek API Key、豆包语音 API Key 已配置

## 核心功能

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| **双模式选择** | ✅ | 顶层入口二选一：练习模式（自由专项）/ 模拟模式（线性沉浸） |
| 5 关面试流程 | ✅ | 面试攻略 → 简历评估 → 技术面 → 情景面 → 综合复盘 |
| 联网情报搜集 | ✅ | 第 0 关调用 Kimi 联网搜索生成定制化面经报告 |
| 简历 AI 直读 | ✅ | 第 1 关 Kimi 直接读取 PDF，提取技术栈、风险点、深挖项目、逐句改写建议 |
| 跨关全文注入 | ✅ | 面试攻略全文 / 简历全文 / 评估全文注入后续所有关卡的 system prompt |
| 技术面（文字面） | ✅ | 八股/手搓代码/简历项目深度追问，支持 Markdown + 代码高亮 + KaTeX 数学公式 |
| 情景面（语音面） | ✅ | 场景冲突 + STAR 行为面试，语音输入经豆包 ASR 多模态分析（语速/情绪/音量/口头禅）后注入 LLM |
| 语音合成（TTS） | ✅ | 面试官语音输出（豆包大模型音色） |
| SVG 雷达图 | ✅ | 实时评估 10 维能力，纯 SVG 零依赖 |
| **跨关 prompt 注入** | ✅ | 模拟模式下，后关面试官能看到前关面评/评分/弱点/简历全文（差异化卖点） |
| **复盘报告页** | ✅ | 模拟跑完 5 关后生成综合雷达 + 5 关摘要 + 录用建议 + 技术面/表达面分项评估 |
| **练习历史留档** | ✅ | 练习模式可一键将本次对话保存到 `practice_logs` |
| 笔记系统 | ✅ | Markdown 编辑器支持复盘笔记，可关联具体面试场次/关卡 |
| 笔记广场 | ✅ | 用户可发布笔记到广场，供他人学习参考 |
| 代码编辑器 | ✅ | 技术面支持 Monaco Editor 在线写代码 |
| Inline Edit | ✅ | 选中任意文本可触发 AI 重写/润色/扩写 |
| 图片理解 | ✅ | 聊天中可上传图片，Kimi k2.6 多模态理解 |
| AI 对话 | ✅ | Kimi k2.6 / DeepSeek v4-pro 双模型，SSE 流式输出 |
| Markdown 渲染 | ✅ | GFM + KaTeX 数学公式 + 代码语法高亮 |
| 用户系统 | ✅ | 注册 / 登录 / JWT 认证 |
| 云端面试会话 | ✅ | InterviewSession + PracticeProfile + PracticeContext + PracticeLog 持久化到 SQLite |
| 主题切换 | ✅ | 亮色 / 暗色 |
| 函数调用框架 | ✅ | 预留工具调用注册表（`agent_tools.py`），比赛日可快速扩展 |

## API 路由概览

| 前缀 | 路由文件 | 核心功能 |
| --- | --- | --- |
| `/auth/*` | `auth.py` | 注册、登录、JWT Token 签发 |
| `/interview/*` | `interview.py` | 模拟模式：场次 CRUD、跨关流式 chat、Stage Review、Final Report |
| `/practice/*` | `practice.py` | 练习模式：Profile 单例、PracticeContext 缓存、无记忆 chat、Logs 留档、Stage Review |
| `/notes/*` | `notes.py` | 笔记 CRUD、笔记广场（列表 + 发布） |
| `/upload/*` | `upload.py` | PDF 简历上传 |
| `/tts/*` | `tts.py` | 豆包语音合成 |
| `/asr/*` | `asr.py` | 豆包语音识别（含情绪/语速/音量分析） |
| `/chat/*` | `chat.py` | 通用对话（早期测试接口，保留做回归验证） |
| `/sessions/*` | `sessions.py` | 通用聊天会话管理（早期测试接口） |

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
│   │   ├── main.py         # 应用入口：路由注册、CORS、静态文件、SPA fallback
│   │   ├── config.py       # 配置加载（Kimi / DeepSeek / 火山引擎 / JWT）
│   │   ├── db.py           # SQLAlchemy 数据库模型
│   │   │                   #   User / InterviewSession / PracticeProfile /
│   │   │                   #   PracticeContext / PracticeLog / Note
│   │   ├── routers/        # API 路由
│   │   │   ├── interview.py   # 模拟模式：场次 CRUD + 跨关 chat + stage_review + final_report
│   │   │   ├── practice.py    # 练习模式：profile 单例 + PracticeContext 缓存 + 无记忆 chat + logs 留档
│   │   │   ├── notes.py       # 笔记 CRUD + 笔记广场
│   │   │   ├── auth.py        # 注册 / 登录 / JWT
│   │   │   ├── upload.py      # PDF 简历上传
│   │   │   ├── tts.py         # 豆包语音合成
│   │   │   ├── asr.py         # 豆包语音识别（含情绪/语速/音量/口头禅分析）
│   │   │   ├── chat.py        # 通用对话（早期测试接口）
│   │   │   └── sessions.py    # 通用聊天会话管理（早期测试接口）
│   │   ├── services/       # 业务逻辑
│   │   │   ├── prompts.py     # 5 关 System Prompt 模板 + render_prompt
│   │   │   ├── kimi.py        # LLM 调用：Kimi + DeepSeek，支持 stream / tools / web_search
│   │   │   ├── agent_tools.py # 函数调用框架：工具注册表 + JSON Schema（预留扩展）
│   │   │   ├── volc_asr.py    # 火山引擎语音识别（异步 submit + 轮询 query）
│   │   │   └── volc_tts.py    # 火山引擎语音合成
│   │   └── middleware/     # 认证 / 错误处理 / 限流中间件
│   ├── frontend/           # React 前端源码
│   │   ├── src/
│   │   │   ├── pages/      # 页面路由
│   │   │   │   ├── Login.tsx / Register.tsx / NotFound.tsx
│   │   │   │   ├── Journal.tsx                    # 复盘笔记（编辑器 + 广场）
│   │   │   │   └── interview/
│   │   │   │       ├── ModeSelect.tsx             # 顶层入口：练习 / 模拟二选一
│   │   │   │       ├── PracticeHub.tsx            # 练习模式：target 表单 + 5 关入口 + 历史留档
│   │   │   │       ├── MockHub.tsx                # 模拟模式：场次列表 + 新建 + 继续面试
│   │   │   │       ├── MockReport.tsx             # 模拟模式跑完 5 关后的综合复盘报告
│   │   │   │       ├── InterviewLayout.tsx        # 公共布局（按 mode 切 nav 行为）
│   │   │   │       ├── Stage0Intel.tsx            # 面试攻略（双模式适配）
│   │   │   │       ├── Stage1Resume.tsx           # 简历评估（双模式适配）
│   │   │   │       ├── Stage2Technical.tsx        # 技术面（TemplateB 包装）
│   │   │   │       ├── Stage3Scenario.tsx         # 情景面（语音输入 + STAR 场景题）
│   │   │   │       ├── Stage4Summary.tsx          # 总结（TemplateB 包装）
│   │   │   │       └── TemplateB.tsx              # Stage 2/3/4 共用双栏对战室模板
│   │   │   ├── contexts/   # 全局状态管理
│   │   │   │   ├── InterviewContext.tsx           # 模拟模式：session / stage / messages / reviews
│   │   │   │   └── PracticeContext.tsx            # 练习模式：profile / context / messages
│   │   │   ├── components/ # UI 组件
│   │   │   │   ├── MarkdownRenderer.tsx           # Markdown 渲染（GFM + KaTeX + 代码高亮）
│   │   │   │   ├── RadarChart.tsx                 # SVG 雷达图（10 维能力评估）
│   │   │   │   ├── StageSidebar.tsx               # 阶段导航侧边栏
│   │   │   │   ├── VoiceMessageBubble.tsx         # 语音消息气泡（播放/波形）
│   │   │   │   ├── InlineEditPopover.tsx          # 文本选中重写/润色/扩写
│   │   │   │   ├── ImageLightbox.tsx              # 图片灯箱
│   │   │   │   ├── NoteEditor.tsx                 # Markdown 笔记编辑器
│   │   │   │   ├── CodeEditor.tsx                 # Monaco Editor 代码编辑
│   │   │   │   ├── StructuredRenderer.tsx         # 结构化 JSON 面评渲染
│   │   │   │   ├── ArtifactPanel.tsx              # 简历评估产物面板
│   │   │   │   ├── FollowUpChat.tsx               # 追问侧边栏
│   │   │   │   └── ...
│   │   │   ├── hooks/      # 自定义 Hooks
│   │   │   │   ├── useAuth.ts                     # JWT 认证
│   │   │   │   ├── useVoiceRecorder.ts            # Web Audio API 语音录制（PCM → WAV）
│   │   │   │   ├── useInterviewMode.ts            # 路径感知模式（mock / practice）
│   │   │   │   └── useChatSessions.ts             # 聊天会话管理
│   │   │   └── lib/        # 工具库
│   │   │       ├── api.ts                         # 前端 API 封装（axios）
│   │   │       ├── sse.ts                         # SSE 流式解析器
│   │   │       ├── theme.tsx                      # 亮色/暗色主题管理
│   │   │       └── interviewSettings.ts           # 难度/风格配置
│   │   └── dist/           # 构建产物（Vite 输出）
│   ├── data/               # SQLite 数据库文件 + PDF 简历存储
│   └── logs/               # 应用日志 + uvicorn 日志
├── test/                   # 准备阶段集成测试服务（保留做回归验证）
│   ├── app/
│   ├── frontend/
│   ├── data/
│   └── logs/
├── Product_Memo/           # Product Memo（LaTeX 源文件）
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
