# 前端风格规范（FRONTEND_STYLE.md）

> **上游依据**：`.design-references/anthropic-frontend-design-SKILL.md`（Anthropic 官方 frontend-design skill）
> **优先级**：本文件高于一切临时审美判断。任何新建、重构、优化前端页面/组件/样式/动画/交互前，**必须先读完本文件**。
> **不得简化**：本文件的具体值（字体名、OKLCH 颜色、间距、动效时长）是约束，不是建议。修改值之前必须先在 PR/对话中说明理由。

---

## 0. 这份文件是什么 / 不是什么

**是**：本项目（2026 年 5 月挑战赛 · 语音聊天）所有前端工作的强制风格契约。
**不是**：通用 React 编码规范，也不是 Tailwind 教程。技术栈与编码规范见 `AGENTS.md`。

**它解决一个核心问题**：AI agent 在没有强约束时，会坍缩到训练数据里最常见的"AI slop"——白底灰卡片 + Inter 字体 + 紫蓝渐变 + 圆角按钮 + 居中 hero。本文件用**具体的、不可妥协的**字体名、颜色值、装饰元素和反模式清单，把 AI 钉死在一个明确的美学方向上。

---

## 1. 强制流程：每次写代码前的 Design Thinking 打卡

每写一个新页面 / 新模块前，AI agent **必须**先在思考过程里回答以下 4 个问题（不允许跳过）：

| # | 问题 | 本项目默认答案 |
| --- | --- | --- |
| Q1 | **Purpose**：这个界面解决什么问题？谁用？ | 演示一个搭载 Kimi K2.6 + 豆包语音的多模态对话产品；目标观众是评委 / 投资人 / 技术同行 |
| Q2 | **Tone**：选一个极端美学方向 | **Retro-Futuristic Voice Console**（复古未来语音控制台，详见第 2 节，**禁止改**） |
| Q3 | **Constraints**：技术 + 性能 + a11y | Vite + React + TS + Tailwind + shadcn/ui；移动端 375px 可用；WCAG AA；`prefers-reduced-motion` 必须尊重 |
| Q4 | **Differentiation**：让人记住的那 1 个点 | 实时声波 + 控制台仪表刻度 + 琥珀色 CRT 强调色组合（详见第 3 节） |

> ⚠️ 凡是没有打这个卡就开始写代码的输出，都要被打回重做。

---

## 2. 项目锁定美学：Retro-Futuristic Voice Console

### 2.1 核心隐喻（Reference Imagery）

把以下三个意象**叠加**在一起：

1. **1980s NASA Mission Control** —— 黑色金属面板、琥珀色 CRT 字符、密密麻麻的标签和刻度尺
2. **Apple Vision Pro / Teenage Engineering OP-1 的工业克制** —— 现代材质、精密留白、模块化分区
3. **Hi-Fi 音响仪表盘** —— VU 表、波形可视化、单位标注（dB / Hz / ms）

这不是"赛博朋克"，不是"霓虹科幻大片"。是**专业、克制、有信息密度的工程师审美**。

### 2.2 一句话定调

> 像是从一台真正在用的、调校精良的语音工作站上截下来的画面，而不是一张科幻概念图。

### 2.3 关键词

**追求**：工业、控制台、仪表、刻度、模块化、信息密度、复古颗粒感、暖色 CRT、机械质感
**远离**：科幻、未来感、霓虹、发光、流体、梦幻、紫蓝渐变、毛玻璃、太空、AI 助手、机器人

> 如果你脑子里浮现的是 ChatGPT / Gemini / Claude 官网的样子——**全错**。

---

## 3. Aesthetic Guidelines（5 大要素 · 全部为强约束）

### 3.1 Typography（字体）

| 角色 | 字体 | 用途 | 来源 |
| --- | --- | --- | --- |
| **Display** | `Major Mono Display` | 一级标题、装饰性大字、模块徽章（如 `[ VOICE.IN ]`、`MISSION 002`） | Google Fonts 免费 |
| **Mono / Data** | `JetBrains Mono` | 时间戳、模型名、参数、错误码、数字、日志、计数器 | Google Fonts 免费 |
| **Body** | `Onest` | 正文、按钮文字、对话气泡、表单 | Google Fonts 免费 |

**铁律**：

- **禁止**使用：`Inter`、`Inter Tight`、`Roboto`、`Arial`、`Helvetica`、`system-ui`、`Space Grotesk`、`Geist`、`DM Sans`、`Manrope`、`Sora`、`Plus Jakarta Sans`、`Poppins`、`Outfit`。这些都是 AI slop 默认值。
- 中文字体：默认 `'PingFang SC', 'HarmonyOS Sans SC', 'Noto Sans SC'`，不引入任何收费中文字体。
- 字号采用八度音程节奏：`12 / 13 / 14 / 16 / 20 / 28 / 40 / 56 / 80`（rem），不要中间插任意值。
- 数字（计时、参数、计数）**必须**用 Mono 字体。一级标题大字**必须**用 Display 字体。正文用 Body。三种字体必须**同屏出现**（这正是控制台感的来源）。
- 字间距：Display 用 `tracking-[0.08em]` 以上的展开；Mono 标签用 `tracking-[0.12em] uppercase`。

### 3.2 Color & Theme（色彩）

**唯一驱动变量**：`--brand-hue: 250`（深蓝灰基调），其余颜色用 OKLCH 派生。

```css
@theme {
  --brand-hue: 250;

  /* 背景层级（深色基底，不是纯黑——纯黑是 AI slop） */
  --color-bg:        oklch(0.16 0.02  var(--brand-hue));   /* 主背景 */
  --color-elevated:  oklch(0.20 0.025 var(--brand-hue));   /* 卡片 / 控制台模块 */
  --color-overlay:   oklch(0.24 0.03  var(--brand-hue));   /* 弹层 / Sheet */
  --color-border:    oklch(0.34 0.02  var(--brand-hue) / 0.7);
  --color-grid:      oklch(0.30 0.02  var(--brand-hue) / 0.4); /* 刻度尺 / 分隔线 */

  /* 文本层级（暖白色调，与冷色背景形成温度对比） */
  --color-fg:        oklch(0.95 0.01 80);
  --color-fg-muted:  oklch(0.65 0.01 80);
  --color-fg-subtle: oklch(0.45 0.01 80);

  /* 主强调色：CRT 琥珀（核心记忆点，绝不替换为蓝/紫） */
  --color-accent:        oklch(0.78 0.18 65);
  --color-accent-soft:   oklch(0.78 0.18 65 / 0.15);
  --color-accent-strong: oklch(0.85 0.20 65);

  /* 信号绿：仅用于"语音活跃 / 系统在线"指示，不得用于按钮或装饰 */
  --color-signal:        oklch(0.85 0.20 145);

  /* 状态色 */
  --color-warn:  oklch(0.78 0.16 90);
  --color-error: oklch(0.65 0.22 25);
}
```

**调色铁律**：

- 一个页面里 **80% 中性色 + 15% 琥珀强调 + 5% 信号绿**，比例不可逆。琥珀色绝不大面积铺底。
- **禁止**任何形式的紫色、蓝紫渐变、霓虹粉、紫蓝双色。
- **禁止**纯黑 `#000` 和纯白 `#fff` 出现在视觉上。所有黑要走 OKLCH，所有白都是暖白。
- 渐变只允许一种用法：**极低对比度的色彩 mesh 作为大块背景的微妙色温变化**，不允许出现在按钮、卡片、文字上。

### 3.3 Motion（动效）

**默认状态：高度克制 + 高冲击力时刻**。这意味着：99% 时间页面是静止的，但有 1-2 个关键时刻动效要做到位。

| 时刻 | 动效 | 时长 | 缓动 |
| --- | --- | --- | --- |
| 页面首次进入 | Staggered reveal：每个模块 `opacity 0→1` + `translateY(8px→0)`，每模块延迟 60ms | 240ms | `cubic-bezier(0.22, 1, 0.36, 1)` |
| 流式输出 | 每个 chunk 直接出现（**禁止**字符级打字机），末尾光标 1Hz 闪烁（仅闪烁，不渐变） | - | - |
| 语音活跃 | 实时声波柱状图 60fps（这是功能反馈，不算装饰动效） | - | - |
| 按钮按下 | `scale(0.97)` | 80ms | `ease-out` |
| 状态切换 | 边框/背景颜色平滑过渡 | 120ms | `ease-out` |
| Hover（仅桌面） | 边框颜色或文字颜色微变；**不要 lift / 不要发光** | 120ms | `ease-out` |

**禁止**：

- 永久背景动画、流动渐变、漂浮粒子、动态网格、呼吸光晕。
- Loading spinner（用**进度条**或**3 点序列脉冲**替代）。
- 字符级打字机效果（慢，且非常 AI slop）。
- 按钮 hover 时上浮 / 发光 / 阴影变深。
- 任何在用户没操作时不停动的元素（除了语音波形和流式光标）。

**必须**：尊重 `@media (prefers-reduced-motion: reduce)`，在该模式下所有 `translate/scale` 动效退化为只剩 `opacity`。

### 3.4 Spatial Composition（空间结构）

布局是本风格规范里**最容易被 AI 写崩**的一节，所以拆成 8 个子节，每条都是强约束。

#### 3.4.1 网格基线与间距系统

**8px 基线**（不用 4px——4px 会让控制台失去呼吸节奏）：

| 用途 | 值 | Tailwind |
| --- | --- | --- |
| 模块内元素紧凑 | 8px / 12px | `gap-2` / `p-3` |
| 模块内分区标准 | 16px / 20px | `gap-4` / `p-4` / `p-5` |
| 模块之间 | 24px / 32px | `gap-6` / `gap-8` |
| 页面级分区 | 48px | `gap-12` |

**铁律**：
- ❌ 禁止 `gap-3 / gap-5 / gap-7 / gap-9 / p-7` 这类打破 8px 节奏的奇数值。
- ❌ 禁止任意像素 `p-[13px]` `m-[7px]` 这种硬编码（除非是 1px / 2px 的边框线，这两个值允许）。
- ✅ 行高用 `leading-relaxed`（1.625）作为正文默认，标题用 `leading-tight`（1.25）。

#### 3.4.2 桌面端三栏控制台骨架

```
lg+ (≥1024px):
┌──────────────────────────────────────────────────────────────────────┐
│ TOP-BAR (44px)  [BRAND]   ─── [SESSION 002 · 21:42:08] ───   [USER]  │
├──────────┬───────────────────────────────────────────────┬───────────┤
│ STATUS   │ ┌─[ MODULE.NAME ]──────────────[ 02 / 04 ]──┐ │ LOG       │
│ 220px    │ │                                            │ │ 320px     │
│          │ │             主操作区（独立滚动）           │ │           │
│ ┊ scale  │ │                                            │ │           │
│ ┊        │ ├──[ STATUS ]──── 21:42:08 ─── Δ 142ms ──────┤ │           │
│ ┊        │ └────────────────────────────────────────────┘ │           │
└──────────┴───────────────────────────────────────────────┴───────────┘
              ░░░░░░░░  GRAIN OVERLAY (z-1, 全屏覆盖)  ░░░░░░░░
```

**像素与 class 对照**：

| 区域 | 高/宽 | Tailwind 关键 class |
| --- | --- | --- |
| TOP-BAR | h-11 (44px) | `h-11 border-b border-border flex items-center px-6` |
| STATUS（左栏） | w-[220px] | `w-[220px] shrink-0 border-r border-border overflow-y-auto` |
| MAIN（中栏） | flex-1 | `flex-1 min-w-0 flex flex-col overflow-hidden` |
| LOG（右栏） | w-[320px] | `w-[320px] shrink-0 border-l border-border overflow-y-auto` |
| 整页容器 | 100vh | `h-screen flex flex-col bg-bg text-fg` |

**绝对禁令**：
- ❌ 桌面端**任何**页面使用 `mx-auto max-w-3xl/4xl/5xl` 收窄居中——这是上一版前端代码的最大 AI slop 错误。
- ❌ 桌面端使用 `flex flex-col items-center` 居中堆叠 hero。
- ❌ 三栏改成两栏对称（比如 50/50 或 60/40），必须是 220 / flex / 320 这种"非对称工业感"。

#### 3.4.3 模块卡片的 4 段式内部结构

**所有模块卡片**（聊天面板、状态栏、日志栏、参数面板……）都遵循同一种结构：

```
┌─[ MODULE.NAME ]────────────────────────[ 02 / 04 ]─┐  ← ① 标签条  h-8 (32px)
│                                                     │
│                  内容区（自适应高度）               │  ← ② 主体  flex-1 overflow-y-auto
│                                                     │
├─────────────────────────────────────────────────────┤  ← ③ 1px 分隔线
│ [ STATUS ] · 21:42:08 · Δ 142ms          [action →] │  ← ④ 状态条  h-7 (28px)
└─────────────────────────────────────────────────────┘
   border-md, border 1px, no shadow
```

**4 段的具体规范**：

| # | 段 | 必填？ | 内容 | Tailwind |
| --- | --- | --- | --- | --- |
| ① | 标签条 | **必填** | 左 `[ MODULE.NAME ]` Mono 标签 + 右元数据/序号 | `h-8 px-4 flex items-center justify-between border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-fg-muted` |
| ② | 内容区 | **必填** | 业务主体 | `flex-1 min-h-0 overflow-y-auto px-4 py-4` |
| ③ | 分隔线 | ④ 存在时必填 | 1px 实线 | `border-t border-border` |
| ④ | 状态条 | 推荐 | Mono 元数据 + 内联操作 | `h-7 px-4 flex items-center justify-between font-mono text-[11px] text-fg-subtle` |

**铁律**：
- ✅ 标签条**绝不能省**——这是控制台风格的灵魂。
- ✅ 模块整体 `rounded-md` + `border border-border`，**没有任何 box-shadow**（控制台不需要悬浮感）。
- ❌ 禁止把模块做成毛玻璃 + 大圆角的"卡片"——那是 macOS 风格，不是控制台。

#### 3.4.4 消息列表：终端日志风（强制，禁用气泡布局）

**这是上一版 `Chat.tsx` 最严重的反模式。新规直接禁掉气泡布局**。

正确范式（终端日志）：

```
21:42:08  [ USER ]                                              Δ 124t
└─ 你好，介绍一下今天的天气

21:42:09  [ KIMI ]                              k2.6 · Δ 856t · 1.2s
└─ 今天北京晴朗，气温 23-31°C，建议穿薄外套或衬衫▎
                                                            ↑
                                                     1Hz 闪烁光标
                                                  (流式输出时贴在末尾)
```

| 元素 | 规范 |
| --- | --- |
| 时间戳 | 左侧最先，`font-mono text-[11px] text-fg-subtle`，格式 `HH:mm:ss` |
| 角色标签 | `[ USER ]` 用琥珀 `text-accent`；`[ KIMI ]` 用暖白 `text-fg`；其他工具角色用次级灰 `text-fg-muted`。统一 `font-mono uppercase tracking-[0.12em]` |
| 元数据（右） | Mono `text-[11px] text-fg-subtle`，可含模型名 / token 数 / 耗时 |
| 正文 | Body 字体（Onest）`text-[14.5px] leading-relaxed text-fg`，**整行左对齐到时间戳下方**，左侧用 `└─ ` 或 1px `border-l border-accent/40 pl-3` 装饰 |
| 用户与机器人区分 | **仅靠角色标签颜色**。两者位置、字号、背景一致，都左对齐 |
| 消息间距 | `space-y-5`（20px），不要 `space-y-2` 那么挤 |
| Hover 操作 | 整行 hover 时右上角浮出复制 / 重发 / 朗读按钮（绝对定位，不挤压正文） |

**绝对禁令**（直接对应你旧 `Chat.tsx`）：
- ❌ 圆形头像（`rounded-full` + Avatar 组件）
- ❌ 消息气泡 / 浅色块底（`rounded-2xl px-4 py-2.5 bg-primary/...`）
- ❌ 用户消息居右、机器人消息居左的两侧布局
- ❌ "用户气泡用主色填充，机器人气泡用边框卡片"这种 ChatGPT 仿品
- ❌ 用 `flex-row-reverse` 翻转用户消息

#### 3.4.5 输入区结构

```
┌─[ VOICE.IN ]──────────────────────────[ 0 / 2000 ]─┐  ← 标签条 h-8
│                                                     │
│ ▸ 在这里输入消息或按住 SPACE 录音...               │  ← textarea，自适应 40-160px
│                                                     │
├─────────────────────────────────────────────────────┤  ← 1px 分隔线
│ [🎤 MIC]  [📎]   ⏎ 发送 · ⇧⏎ 换行       [SEND →]   │  ← 工具栏 h-9 (36px)
└─────────────────────────────────────────────────────┘
```

| 元素 | 规范 |
| --- | --- |
| 整体容器 | `rounded-md border border-border bg-elevated`，focus-within 时 `border-accent`（**不用 ring/inset shadow**） |
| textarea | `bg-transparent text-fg placeholder:text-fg-subtle resize-none min-h-10 max-h-40 px-4 py-3 text-[14.5px] leading-relaxed outline-none` |
| MIC 按钮 | 方形 `h-9 w-9 rounded-sm bg-accent text-bg`（琥珀实心），录音中变 `--color-signal`（信号绿） |
| 附件按钮 | 方形 `h-9 w-9 rounded-sm border border-border` 描边样式 |
| 中部提示 | Mono `text-[11px] text-fg-subtle`，桌面端显示，移动端隐藏 |
| 发送按钮 | 方形 `h-9 px-4 rounded-sm border border-accent text-accent font-mono text-[12px] uppercase tracking-[0.12em]`，文字写 `SEND →` |
| 字符计数 | 右上角 `[ 0 / 2000 ]`，Mono 11px，超过 80% 变 `--color-warn`，超限变 `--color-error` |

**绝对禁令**：
- ❌ 输入框 `rounded-full` 胶囊形或 `rounded-2xl` 大圆角。
- ❌ 麦克风和发送按钮**做成同尺寸圆形并排**（这是 ChatGPT-mobile 仿品的标志）。
- ❌ 输入框 focus 时使用 `ring-2 ring-primary/30` 内阴影（控制台风格用 1px 边框颜色变化即可）。

#### 3.4.6 三栏在不同断点的退化路径

| 断点 | 范围 | 三栏行为 |
| --- | --- | --- |
| `2xl` | ≥ 1536px | 三栏标准 + 顶栏整体 `max-w-[1600px] mx-auto` |
| `xl` | 1280-1535 | 三栏标准（220 / flex / 320） |
| `lg` | 1024-1279 | 三栏紧凑（200 / flex / 280） |
| `md` | 768-1023 | **两栏**：STATUS 收为顶部 36px 横条；MAIN flex-1；LOG 折叠成右侧抽屉（按钮触发） |
| `sm` | 640-767 | **单列**：TOP-BAR 固定顶部；MAIN 全宽；STATUS / LOG 各自从左/右抽屉滑入 |
| 默认 | ≤ 639 | 同 `sm`，但抽屉宽度占满屏幕 |

**抽屉规范**：
- 用 shadcn Sheet，但样式必须改造为方角 + 顶部带 `[ MODULE.NAME ]` 标签条，**禁止 macOS 风格圆角**。
- 入场动画：从对应边缘 `translateX` 滑入，180ms `ease-out`，**不要做反弹**。

#### 3.4.7 圆角 / 边框 / 阴影系统

| 要素 | 值 | Tailwind |
| --- | --- | --- |
| 模块卡片 | 6px | `rounded-md` |
| 输入框 / textarea | 4px | `rounded` |
| 按钮 | 3px | `rounded-sm` |
| 头像 / 徽章 / 状态点 | **0px（方形）** | `rounded-none` |
| 标签 / Tag | 0px | `rounded-none`（Mono 字体方括号 `[ TAG ]` 的天然形态） |
| 描边 | 1px | `border` |
| Focus | 2px 琥珀 + 2px offset | `ring-2 ring-accent ring-offset-2 ring-offset-bg` |
| 常规阴影 | **不允许** | 用边框和背景层级建立层次 |
| 弹层阴影 | 仅 Dialog/Popover/Sheet | `shadow-[0_4px_24px_oklch(0.05_0.02_250/0.6)]` |

**铁律**：
- ❌ `rounded-xl` `rounded-2xl` `rounded-3xl` `rounded-full`（**头像/徽章/状态点也是方的，不要用 `rounded-full`**）。
- ❌ Tailwind 默认 `shadow-md/lg/xl/2xl`（这些是 Material Design AI slop）。
- ❌ `drop-shadow` 在卡片上的使用。
- ✅ 唯一允许的"非方形"是仪表盘里的圆形进度环 / 雷达图——这些是 SVG 数据可视化，不是 UI 圆角。

#### 3.4.8 z-index 层级

固定 6 层，**不允许发明新值**：

| 层级 | 用途 |
| --- | --- |
| `z-0` | 背景 |
| `z-1` | grain overlay / 扫描线（`pointer-events-none`） |
| `z-10` | 顶部 sticky 状态栏 / 底部固定输入栏 |
| `z-50` | 抽屉 / Sheet |
| `z-80` | Dialog / Modal |
| `z-100` | Toast / Notification |

❌ 禁止 `z-[999]` `z-[9999]` 这种"防御性"高 z-index。

#### 3.4.9 移动端补充

- 退化为单列纵向滚动，但**保留模块标签条 + 刻度尺装饰**，绝不是把卡片简单堆叠。
- 顶部固定 TOP-BAR 高 44px，底部固定输入栏高 64-72px，中间消息流可滚动。
- 移动端**消息流仍然是终端日志风**——不要在小屏幕上倒退回气泡布局。
- 输入区在键盘弹出时不被遮挡（用 `dvh` 单位或 `visualViewport` 监听）。
- 底部输入栏的麦克风按钮和发送按钮**色彩和形状必须区分**：MIC 琥珀实心方形，SEND 描边方形。

### 3.5 Backgrounds & Visual Details（背景与装饰细节）

这一节是最容易出"AI slop"的地方，本项目要**反向**做。

**必须使用**：

- 全局 **noise grain 叠层**：1px noise PNG 或 SVG，4-6% 不透明度，`pointer-events: none`，固定在 body 上。这是控制台/CRT 颗粒感的灵魂。
- **极淡的水平扫描线**：仅在主聊天区背景，2px 间距，`rgba(255,255,255,0.015)`。开关可由 `prefers-reduced-motion` 控制（虽然它是静态的）。
- **刻度尺 / 分隔线**：用真正的 SVG 刻度尺装饰边缘和分区。
- **角标 / 序号**：右上角的 `[ 02 / 04 ]` 这类页签序号，用 Mono 字体小号灰色。
- **细线分隔**：模块间用 1px 实线（`var(--color-border)`）或虚线（`border-style: dashed`，`spacing: 4px`）分隔，比留白更有控制台感。

**禁止使用**：

- ❌ 紫蓝渐变背景（`from-purple-500 to-blue-500` 或类似）
- ❌ 毛玻璃 `backdrop-blur-xl` 大量使用（小范围弹层可以）
- ❌ 发光阴影 `shadow-[0_0_40px_rgba(...)]`
- ❌ 漂浮粒子 / 星空 / 流光网格 / aurora mesh 流体
- ❌ 全屏居中的渐变 hero 块
- ❌ `bg-gradient-to-br from-... to-...` 的常见 AI 渐变

---

## 4. Anti-AI-Slop 红线（一票否决清单）

满足以下**任意一条**的输出**直接被拒**，重做：

1. 字体里出现 Inter / Roboto / Arial / system-ui / Space Grotesk
2. 出现紫蓝渐变 / 紫粉渐变 / 任何主色为紫色的设计
3. 一级布局是"白底 + 灰卡片 + 居中 hero + CTA 按钮"
4. 圆角 ≥ 12px（`rounded-xl` 及以上）
5. 按钮使用蓝色或紫色 `bg-blue-500` / `bg-indigo-600` 这类 Tailwind 调色板默认色
6. 没有刻度尺 / 模块标签 / Mono 字体数据展示三件套中的任何两件
7. 出现 emoji 作为 UI 图标（图标必须用 lucide-react）
8. Loading 用旋转 spinner（必须是脉冲点或进度条）
9. 没有 noise grain 颗粒层
10. 流式输出用慢速字符级打字机
11. 无任何状态反馈的功能按钮（loading/error/empty/disabled 必须全覆盖）
12. 桌面端是单列居中而不是控制台分栏
13. 消息列表使用气泡布局（圆角色块 + 圆形头像 + 用户居右机器人居左）——必须用终端日志风（见 3.4.4）
14. 模块卡片没有顶部 `[ MODULE.NAME ]` 标签条
15. 麦克风和发送按钮是同尺寸圆形并排（必须 MIC 实心方形 + SEND 描边方形）

---

## 5. 技术栈实现要求

### 5.1 React + TypeScript

- 函数组件 + hooks，不写 class 组件。
- props 必须有显式 TypeScript 类型；禁止 `any`，必要时用 `unknown` + 类型守卫。
- 业务组件命名表达业务含义：`ChatPanel`、`VoiceControl`、`ModelStatus`、`MessageBubble`、`ConsoleHeader`、`MissionLog`、`SessionTimeline`。
- 组件文件用 PascalCase（`ChatPanel.tsx`），hook 用 camelCase（`useVoiceStream.ts`）。
- 不为了复用过早抽象。

### 5.2 Tailwind + 主题 token

- 使用 Tailwind v4 的 `@theme` CSS-first 配置（不写 `tailwind.config.js`），所有 token 通过 CSS 变量驱动（见 3.2）。
- **禁止**在组件里硬编码颜色字面量。比如不允许 `text-[#38bdf8]` 或 `bg-zinc-800`，必须 `text-accent` / `bg-elevated`。
- **禁止**同页面混用多套中性色（不允许同时出现 `slate` + `zinc` + `gray`）。
- 暗色不是反色：本项目就是深色基底，没有"亮色模式"。如果需要切换，先在本文件里加一节再改。

### 5.3 shadcn/ui

- 优先使用 shadcn/ui 的 Button / Input / Dialog / Sheet / Card / Tabs / ScrollArea / Tooltip / Toast。
- shadcn 组件的默认样式**必须改造**以匹配本风格：
  - Button 默认改为方角（`rounded-sm`）+ 边框 + Mono 字体 + 大写 + tracking-wider。
  - Card 改为方角（`rounded-md`）+ 顶部带 `[ MODULE.NAME ]` 标签插槽。
  - Tabs 改为底部下划线（琥珀色）形态，不要 pill 风格。
- 不引入额外 UI 库（Radix 衍生除外，因为 shadcn 本身基于 Radix）。

### 5.4 图标

- 仅使用 `lucide-react`。
- 图标默认 16-20px，描边 1.5-1.75。
- 图标和文字组合时使用 Mono 字体的标签风格。
- **禁止** emoji 作为 UI 图标。

---

## 6. 交互状态全覆盖

每个可交互元素必须覆盖：

- `default` / `hover`（仅桌面）/ `active`（按下）/ `focus-visible`（必须可见）/ `disabled`

聊天与语音相关界面必须额外覆盖：

| 状态 | 表现 |
| --- | --- |
| `loading` | 模块右上角显示 Mono 标签 `[ LOADING ]` + 3 点脉冲 |
| `streaming` | 末尾光标 1Hz 闪烁 + 顶部 1px 进度条向右流动 |
| `error` | 边框变 `--color-error`，顶部插入红色 `[ ERR ]` 标签 + 错误码 + retry 按钮 |
| `empty` | 居中 Mono 字体 `[ NO SIGNAL ]` + 一行说明文字 |
| `success` | 边框短暂变 `--color-signal` 600ms 后回落 |
| `recording`（语音） | 麦克风按钮变琥珀实心 + 周围出现实时声波柱 |
| `disabled` | 整体降至 50% 透明度，光标 `not-allowed` |

---

## 7. 响应式

- 移动端优先（375px 起）。
- 断点（Tailwind 默认）：`sm 640 / md 768 / lg 1024 / xl 1280 / 2xl 1536`。
- 三栏控制台仅在 `lg` 及以上启用；`md` 退化为左右两栏（聊天 + 状态合并）；`sm` 单列。
- **禁止**任何宽度下出现横向滚动（除了刻意的水平时间轴模块）。
- 输入栏在移动端必须固定底部，键盘弹出时不挡住消息流。
- 触控目标最小 44×44px。

---

## 8. 可访问性

- 所有图标按钮必须有 `aria-label`。
- 表单控件必须关联 `<label>` 或显式 `aria-labelledby`。
- `focus-visible` 状态必须有清晰边框（琥珀色 2px outline + 2px offset）。
- 文本对比度 ≥ WCAG AA（正文 4.5:1，大字 3:1）。已在 3.2 的颜色 token 中预留。
- `loading` / `error` 状态必须有 `aria-live="polite"`（错误用 `assertive`），且文本可被屏幕阅读器读出。
- 视频/语音相关：录音按钮按下后必须有非视觉反馈（屏幕阅读器播报 "recording started"）。

---

## 9. 输出质量

- 代码必须**完整可运行**：不留 TODO、占位文本、未接线按钮、`onClick={() => {}}` 空函数。
- **不硬编码 API Key / 密钥**。所有敏感配置通过 `.env`，前端只读 `VITE_` 前缀的变量（见 `AGENTS.md`）。
- 修改已有页面前必须先 Read 整个文件，最小范围改造，不做无关重构。
- 新增依赖前必须确认项目已有的清单（见 `AGENTS.md` 前端依赖一节），并说明为什么需要、是否有现有方案替代。
- 不破坏现有 FastAPI / Kimi / 豆包语音 API 的调用契约。

---

## 10. 交付前检查清单（每个 PR / 改动必过）

### Design Thinking
- [ ] 已完成第 1 节的 4 步打卡（Purpose / Tone / Constraints / Differentiation）。

### Aesthetic
- [ ] 字体只用 Major Mono Display + JetBrains Mono + Onest 三件套（含中文回退）。
- [ ] 颜色全部走 OKLCH CSS 变量，没有硬编码 hex。
- [ ] 同屏至少能看到：1 个 `[ MODULE.NAME ]` 标签 + 1 处 Mono 字体的数据展示 + 1 处刻度尺/分隔装饰。
- [ ] 全局有 noise grain 颗粒层。
- [ ] 没有任何紫蓝渐变 / 居中 hero / 大圆角。

### Anti-Slop
- [ ] 通过第 4 节红线清单 12 条全部检查。

### 技术与状态
- [ ] 所有交互元素覆盖 default/hover/active/focus-visible/disabled。
- [ ] 聊天/语音相关额外覆盖 loading/streaming/error/empty/success/recording。
- [ ] 桌面端是控制台三栏；移动端 375px 单列可用。
- [ ] 尊重 `prefers-reduced-motion`。
- [ ] WCAG AA 对比度。
- [ ] 没有 TODO / 占位 / 未接线按钮。

### Demo 视频适配
- [ ] 在 1080p / 1440p 录屏分辨率下视觉信息密度合适，文字清晰可读。
- [ ] 关键动效（首屏 reveal / 流式输出 / 语音波形）在录屏帧率下流畅。

---

## 11. 页面骨架模板（写新页面时直接照抄）

本节给出本项目 4 类典型页面的"标准骨架"——AI agent 写新页面时**优先照抄骨架**，不要重新发明轮子。每个骨架包含：ASCII 示意 / 关键 Tailwind class / 最常见的反模式。

### 11.1 Home / Mission Hub 骨架

**用途**：项目首页 / 入口页，列出可进入的子能力（聊天 / 语音 / TTS / 设置）。

```
┌────────────────────────────────────────────────────────────────────────┐
│ TOP-BAR (44px)                                                         │
├──────────────────────────────────────┬─────────────────────────────────┤
│                                      │ ┌─[ MISSIONS ]──────[ 04 ]─┐    │
│   ┌────┐                             │ │ 01  ──  AI 对话          │    │
│   │MISSION                           │ │     └─ Kimi K2.6 流式    │    │
│   │ 002    (Major Mono Display)      │ │ ───────────────────────  │    │
│   └────┘                             │ │ 02  ──  语音合成         │    │
│                                      │ │     └─ 豆包 TTS          │    │
│   AIIC CHALLENGE                     │ │ ───────────────────────  │    │
│   ─────────────                      │ │ 03  ──  实时语音对话     │    │
│   多模态语音工作站                   │ │     └─ 等待开发          │    │
│                                      │ │ ───────────────────────  │    │
│   STATUS · ACTIVE  ·  21:42:08       │ │ 04  ──  会话历史         │    │
│                                      │ │     └─ 本地存储          │    │
│         (左 60%)                     │ └──────────────────────────┘    │
│                                      │            (右 40%)             │
└──────────────────────────────────────┴─────────────────────────────────┘
                          ░░░  GRAIN OVERLAY  ░░░
```

**关键 class**：

```tsx
<div className="h-screen flex flex-col bg-bg text-fg">
  <TopBar />
  <div className="flex-1 grid grid-cols-[3fr_2fr] min-h-0">
    {/* 左：brand 区 */}
    <section className="border-r border-border p-12 flex flex-col justify-between">
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
        [ MISSION 002 ]
      </div>
      <div>
        <h1 className="font-display text-[80px] leading-none tracking-[0.04em]">
          AIIC<br/>CHALLENGE
        </h1>
        <p className="mt-6 text-fg-muted max-w-md">多模态语音工作站</p>
      </div>
      <div className="font-mono text-[11px] text-fg-subtle">
        STATUS · ACTIVE · {timestamp}
      </div>
    </section>
    {/* 右：mission list */}
    <section className="overflow-y-auto p-8">
      <ModuleCard label="MISSIONS" meta="04">
        {missions.map((m, i) => <MissionRow key={m.id} index={i+1} {...m} />)}
      </ModuleCard>
    </section>
  </div>
  <GrainOverlay />
</div>
```

**反模式（直接对应你旧 `Home.tsx`）**：
- ❌ `mx-auto max-w-3xl` 收窄居中
- ❌ `flex flex-col items-center` 居中堆叠
- ❌ `grid sm:grid-cols-2` 完全对称两个圆角大卡片
- ❌ 圆形图标徽章 `rounded-2xl bg-primary/10`
- ❌ `hover:-translate-y-0.5` 卡片 lift
- ❌ "测试环境"圆角药丸 `rounded-full bg-primary/10`

### 11.2 Chat / Voice Console 骨架

**用途**：核心对话页（文字 / 语音 / 流式输出）。

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOP-BAR  [BRAND]  ── [SESSION 002 · k2.6 · ACTIVE] ──   [USER]       │
├──────────┬─────────────────────────────────────────────┬─────────────┤
│ ┌──────┐ │ ┌─[ DIALOG.STREAM ]──────────[ 12 msgs ]──┐ │ ┌─[ LOG ]─┐ │
│ │MODEL │ │ │ 21:42:08 [USER]               Δ 124t   │ │ │·session1│ │
│ │ k2.6 │ │ │ └─ 你好...                              │ │ │·session2│ │
│ ├──────┤ │ │                                          │ │ ├─────────┤ │
│ │LATEN │ │ │ 21:42:09 [KIMI]    k2.6·Δ856t·1.2s     │ │ │[PARAMS] │ │
│ │142ms │ │ │ └─ 今天北京晴朗...▎                     │ │ │ temp .7 │ │
│ ├──────┤ │ │                                          │ │ │ topP .9 │ │
│ │TOKENS│ │ │                                          │ │ └─────────┘ │
│ │1,420 │ │ ├──────────────────────────────────────────┤ │             │
│ └──────┘ │ │┌─[ VOICE.IN ]───────────[ 24/2000 ]────┐│ │             │
│ ┊ scale  │ ││ ▸ 输入消息...                          ││ │             │
│ ┊        │ │├────────────────────────────────────────┤│ │             │
│ ┊        │ ││[🎤MIC] [📎] ⏎发送 ⇧⏎换行  [SEND →]    ││ │             │
│          │ │└────────────────────────────────────────┘│ │             │
│          │ └──────────────────────────────────────────┘ │             │
└──────────┴─────────────────────────────────────────────┴─────────────┘
```

**关键 class**：

```tsx
<div className="h-screen flex flex-col bg-bg text-fg">
  <TopBar />
  <div className="flex-1 flex min-h-0">
    <aside className="w-[220px] shrink-0 border-r border-border overflow-y-auto p-4 space-y-4">
      <StatusCard label="MODEL" value="k2.6" />
      <StatusCard label="LATENCY" value="142ms" />
      <StatusCard label="TOKENS" value="1,420" />
      <RulerScale />
    </aside>
    <main className="flex-1 min-w-0 flex flex-col p-6 gap-4">
      <ModuleCard label="DIALOG.STREAM" meta={`${msgs.length} msgs`} className="flex-1">
        <MessageLog messages={msgs} />
      </ModuleCard>
      <ModuleCard label="VOICE.IN" meta={`${input.length} / 2000`}>
        <ChatInput />
      </ModuleCard>
    </main>
    <aside className="w-[320px] shrink-0 border-l border-border overflow-y-auto">
      <SessionList />
      <ParamPanel />
    </aside>
  </div>
  <GrainOverlay />
</div>
```

**反模式（直接对应你旧 `Chat.tsx`）**：
- ❌ `mx-auto max-w-3xl` 单列居中
- ❌ 用 `Card + CardHeader + CardContent` 把对话裹成一个圆角大卡片
- ❌ 圆形头像 + 气泡 + `rounded-2xl rounded-br-sm`
- ❌ 用户气泡 `bg-primary text-[#0a0e17]`、机器人气泡 `border bg-bg-secondary`
- ❌ 发送按钮 `rounded-full h-9 w-9`
- ❌ 没有 STATUS 栏 / 没有 LOG 栏 / 没有时间戳 / 没有 token 显示

### 11.3 TTS / Voice Studio 骨架

**用途**：语音合成 / 录音工坊。三段纵向布局（transport / canvas / params）。

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOP-BAR                                                              │
├──────────────────────────────────────────────────────────────────────┤
│ ┌─[ TRANSPORT ]────────────────────────────────[ 00:12 / 00:30 ]──┐  │  56px
│ │  [▶ PLAY]  [■ STOP]  [● REC]   ─────────────●─────────  -3.2dB │  │
│ └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ┌─[ WAVEFORM ]──────────────────────────────────────[ 24kHz ]─────┐  │
│ │     ║║║║▏▎▍▍▌▋▊▉█▉▊▋▌▍▍▎▏║║║║║║▏▎▍▌▋▊▉█▉▊▋▌▍║║║              │  │  flex-1
│ │  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔               │  │
│ └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│ ┌─[ PARAMS ]──────────────────────────────────────────────────────┐  │  240px
│ │  TEXT  ▸ 在这里输入要合成的文本...                              │  │
│ │  ──────────────────────────────────────────────────────────────  │  │
│ │  VOICE   [zh_female_qingxin ▾]    SPEED  ◀──●──▶  1.0x          │  │
│ │  EMOTION [neutral ▾]              PITCH  ◀──●──▶  0             │  │
│ │                                                       [SYNTH →] │  │
│ └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

**关键点**：
- Transport / Waveform / Params 三段纵向，**不要**做成左右分栏。
- 波形画布用 Canvas / SVG 实时绘制，黑底 + 琥珀色波形，**禁止**音乐播放器风格的发光效果。
- 参数面板用 Mono 字体的标签 + 滑杆 / Select，**禁止**圆形旋钮（除非真做仪表盘风格的 SVG knob，后者可以）。
- 主操作 `[SYNTH →]` 描边方形按钮，琥珀色文字。

### 11.4 Login / Onboarding 骨架（如果需要）

**用途**：登录 / 注册 / 入场页。

```
┌──────────────────────────────────────┬──────────────────────────────┐
│                                      │ ┌─[ AUTH ]────────[ 01/02 ]─┐│
│  AIIC                                │ │                            ││
│  CHALLENGE      (Display 80-120px)   │ │  USERNAME                  ││
│  ─────────                           │ │  ┌──────────────────────┐  ││
│  欢迎，请登录                        │ │  │ ▸                    │  ││
│                                      │ │  └──────────────────────┘  ││
│  ──────────────────────              │ │                            ││
│  v1.0.0 · BUILD 4f2a9c3              │ │  PASSWORD                  ││
│                                      │ │  ┌──────────────────────┐  ││
│       (左 55%, brand 大字区)         │ │  │ ▸                    │  ││
│                                      │ │  └──────────────────────┘  ││
│                                      │ │                            ││
│                                      │ │           [LOGIN →]        ││
│                                      │ └────────────────────────────┘│
│                                      │       (右 45%, 紧凑表单)      │
└──────────────────────────────────────┴──────────────────────────────┘
```

**关键点**：
- 左大字 brand 区 + 右紧凑表单的非对称分栏。
- 不要全屏渐变背景。
- CTA 用琥珀色 `[LOGIN →]` 描边方形按钮。

### 11.5 通用反模板（永远不要这样做）

| 反模式 | 出现频率 | 修复方向 |
| --- | --- | --- |
| `mx-auto max-w-3xl` 收窄居中 | ⭐⭐⭐⭐⭐ | 改为三栏控制台或左右分栏 |
| 居中圆形图标徽章 + 标题 + 副标题 + 药丸标签 | ⭐⭐⭐⭐⭐ | 改为左对齐 Display 大字 + Mono 元数据条 |
| 完全对称的 grid 卡片 | ⭐⭐⭐⭐ | 改为非对称分栏或带序号的列表条 |
| 圆形头像 + 圆角气泡的对话布局 | ⭐⭐⭐⭐⭐ | 改为终端日志风（见 3.4.4） |
| `rounded-full` 发送按钮 + 同尺寸圆形 mic | ⭐⭐⭐⭐ | MIC 实心方形琥珀，SEND 描边方形 |
| `hover:-translate-y-0.5` 卡片浮起 | ⭐⭐⭐ | 改为 hover 时边框颜色微变 |
| 用 `bg-primary/10` 圆形作为图标容器 | ⭐⭐⭐⭐ | 改为方形 lucide 图标 + Mono 标签同行 |
| 状态用 `rounded-full` 药丸 | ⭐⭐⭐⭐ | 改为方括号 Mono 标签 `[ ACTIVE ]` |

---

## 附录 A：常见请求的标准答案

| 用户说 | 不要做 | 要做 |
| --- | --- | --- |
| "做一个聊天页面" | 居中 hero + 渐变背景 + 圆角大卡片 | 三栏控制台，左 STATUS / 中 CHAT / 右 LOG，顶部刻度尺 |
| "加一个登录页" | 全屏渐变 + 居中卡片 + 蓝色按钮 | 黑底 + 左侧大块 Display 字体 brand 区 + 右侧紧凑表单 + 琥珀色 CTA |
| "做个语音控制" | 大圆形 mic 按钮 + 紫色发光 | 方形麦克按钮 + 旁边实时波形柱 + Mono 字体显示 dB 数值和录音时长 |
| "loading 状态" | 旋转 spinner | 顶部 1px 进度条 + 右上角 `[ LOADING ]` Mono 标签 |
| "美化一下" | 加渐变 / 加阴影 / 加圆角 | 加刻度尺装饰 / 加 Mono 数据元素 / 加模块标签 |
