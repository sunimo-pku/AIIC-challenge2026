# 前端设计参考资料（Design References）

本目录存放**外部权威**的前端设计 skill / 规范，作为本项目 `FRONTEND_STYLE.md` 的上游依据。

## 为什么需要这个目录

- **隔离**：与项目自己的 `FRONTEND_STYLE.md` 物理隔开，避免 AI agent 混淆"项目约束"和"外部参考"。
- **锁版本**：联网拉到的内容会随上游更新而变，本目录是**当前比赛周期**用到的版本快照。
- **离线可读**：AI agent 可以本地直接 Read，不依赖网络。

## 文件清单

| 文件 | 来源 | 用途 |
| --- | --- | --- |
| `anthropic-frontend-design-SKILL.md` | [anthropics/skills](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md) | 官方权威：Design Thinking 流程 + 5 大 Aesthetic Guidelines + Anti-AI-Slop 红线 |
| `wilwaldon-frontend-design-toolkit.md` | [wilwaldon/Claude-Code-Frontend-Design-Toolkit](https://github.com/wilwaldon/Claude-Code-Frontend-Design-Toolkit) | 70+ 第三方 skill 索引清单（202⭐），含 11 种命名美学、字体配对、动效库、a11y 等 |

## 与 `FRONTEND_STYLE.md` 的关系

```
.design-references/                ← 外部参考（只读，照搬上游）
   ├── anthropic-frontend-design-SKILL.md
   └── wilwaldon-frontend-design-toolkit.md

FRONTEND_STYLE.md                  ← 项目落地约束（基于上述参考改写）
```

**优先级**：`FRONTEND_STYLE.md` ＞ 本目录的参考文件。
本目录是"为什么这么定"的依据，`FRONTEND_STYLE.md` 是"必须这么做"的规则。

## 何时回来读这里

- 想新增/修改 `FRONTEND_STYLE.md` 的某条规则时，先回到本目录确认上游是否有更权威的写法。
- 不再确定某种美学方向是否合理时，对照 Anthropic 官方的 5 大 Aesthetic Guidelines。
- 想引入新的 skill 或 plugin 时，先到 `wilwaldon-frontend-design-toolkit.md` 查清单，避免 AI 推荐已停更或低质量的项目。
