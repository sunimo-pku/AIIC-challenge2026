# 项目规范

> AI Agent 在进行修改之前必须仔细阅读本文档

## 项目背景

- **项目名称**：2026 年 5 月挑战赛项目
- **正式开始**：2026-05-10 08:00
- **当前阶段**：项目准备阶段，基础环境 + 测试服务全部就绪 ✅

## 服务器环境

- **服务器状态**：已租用，支持公网访问
- **已开放端口**：
  - HTTP: `80`
  - HTTPS: `443`
- **部署方式**：公网 IP + 端口（或配置域名）
- **SSH 公钥**：已按项目要求添加（详见项目准备说明）

## 项目要求摘要

### 最终交付物

1. **GitHub 仓库**（public）
  - 完整的项目代码及提交记录
2. **公网可访问的 URL**
  - 部署在上述服务器上
  - 项目截止时间后的构建/部署视为超时
3. **Demo 视频**（≤ 3 分钟）
  - 说明设计思路
  - 简单演示产品
  - 对剪辑无要求，录屏或手机一镜到底均可

### 功能预期（基础准备标准）

- 一个简单的可公网访问的网页
- 搭载聊天服务，可调用指定模型
- 支持简单的文本（或语音）对话

### 可选能力

- 多模态设计（音视频）
- 如需：建议注册火山引擎账号备用（[https://www.volcengine.com/docs/6561/1354845）](https://www.volcengine.com/docs/6561/1354845）)

## API 与工具准备


| 类别           | 状态  | 说明                           |
| ------------ | --- | ---------------------------- |
| LLM API Keys | 已确定 | **Kimi**（通过 `openai` SDK 调用） |
| 音视频 API      | 已就绪 | 豆包语音（火山引擎）API Key 已配置        |
| AI Coding 工具 | 待确认 | 确保额度充足                       |
| 录屏/剪辑工具      | 可选  | 剪映等即可                        |


## 预装环境

### 系统服务


| 软件      | 版本       | 说明                          |
| ------- | -------- | --------------------------- |
| Python  | 3.10.17  | 系统默认 Python                 |
| Node.js | v20.18.2 | 前端构建 / 工具链                  |
| npm     | 10.9.4   | 包管理器                        |
| nginx   | 1.26.2   | 反向代理、静态文件服务                 |
| certbot | 5.5.0    | HTTPS SSL 证书申请（配合 nginx 插件） |
| git     | -        | 版本控制                        |


> nginx 已启动并设置开机自启。

### Python 依赖

```
fastapi
uvicorn[standard]
websockets
httpx
openai          # Kimi API 兼容 OpenAI SDK
python-dotenv
certbot
certbot-nginx
```

### 前端依赖（test/frontend）

```
vite
react + react-dom
react-router-dom
typescript
tailwindcss + @tailwindcss/vite
lucide-react
clsx + tailwind-merge
```

## 配置管理（安全）

- **敏感信息（API Key 等）**：写入 `.env` 文件，**绝不硬编码在代码中**
- `**.env` 已加入 `.gitignore`**：防止误提交到 GitHub
- **模板文件**：`.env.example` 记录了需要配置的环境变量，可复制为 `.env` 后填写
- **代码读取方式**：通过 `python-dotenv` 加载，示例：
  ```python
  from dotenv import load_dotenv
  import os

  load_dotenv()
  api_key = os.getenv("KIMI_API_KEY")
  ```

## 前端技术栈与风格强制约定

- **前端技术栈**：Vite + React + TypeScript + Tailwind CSS + shadcn/ui + lucide-react。
- **后端保持**：FastAPI + Uvicorn，前端通过 API 调用后端服务。
- **部署方式**：前端构建为静态文件，由 Nginx 或 FastAPI 静态服务承载。
- **强制风格文件**：任何新建、重构或优化前端页面、组件、样式、动画、交互状态前，必须先读取并遵循 `[FRONTEND_STYLE.md](./FRONTEND_STYLE.md)`。
- **设计优先级**：`FRONTEND_STYLE.md` 中的风格、交互、响应式、可访问性要求优先于临时审美判断；如题目公布后需要改变视觉方向，必须先更新该文件，再按新风格实现。
- **禁止默认 AI 风格**：不得直接生成白底灰卡片、紫蓝渐变、全居中普通 Hero、无状态反馈的临时测试页。
- **Demo 标准**：前端必须以“可公网演示、可录制 Demo 视频、像真实产品”为目标，而不是仅满足功能可用。

## Git 自动化

提供了两种机制，降低「忘记提交」的概率：

### 1. 手动一键保存（推荐）

随时执行 `save` 即可把当前所有改动提交并推送到 GitHub：

```bash
save                    # 自动使用时间戳作为提交信息
save "feat: add chat"   # 自定义提交信息
```

### 2. 自动监控保存（可选）

后台运行文件监控，当工作区有变更且 **10 秒内无新变动** 时，自动 `git add && commit && push`。

```bash
# 启动（后台运行）
nohup python3 /root/workspace/.tools/auto-git.py > /root/workspace/.tools/auto-git.log 2>&1 &

# 查看运行状态
tail -f /root/workspace/.tools/auto-git.log

# 停止
ps aux | grep auto-git.py | grep -v grep | awk '{print $2}' | xargs kill
```

> 自动保存会忽略 `.git/`、`__pycache__/`、`.env`、临时文件等，避免误提交和循环触发。

## 当前进度


| 事项               | 状态   | 备注                                                                     |
| ---------------- | ---- | ---------------------------------------------------------------------- |
| 云服务器 & 端口 80/443 | ✅ 完成 | nginx + uvicorn 已打通                                                    |
| GitHub 仓库绑定      | ✅ 完成 | [AIIC-challenge2026](https://github.com/sunimo-pku/AIIC-challenge2026) |
| Kimi API Key     | ✅ 完成 | 测试页面可正常对话                                                              |
| 豆包语音 API Key     | ✅ 完成 | TTS 语音合成已调通                                                            |
| 测试页面（公网可访问）      | ✅ 完成 | [http://39.106.211.238/](http://39.106.211.238/)                       |
| 项目正式题目           | ⏳ 等待 | 2026-05-10 08:00 公布                                                    |


## 踩坑记录

### Kimi API

- **务必调用旗舰模型**：Kimi 的模型能力差异很大，不要使用 `moonshot-v1-8k` 等早期小模型。项目全程使用 `**kimi-k2.6`**（当前最强旗舰模型）。

### 豆包语音（火山引擎）

- **V3 HTTP Chunked 返回多行 JSON**：不是单个 JSON 对象，而是每行一个分块，需要逐行 `json.loads()` 并拼接 `data` 字段。
- **流结束标志 `code=20000000`**：最后一个分块的 code 不是 `0`，而是 `20000000`，message 为 `"OK"`，这是正常结束标志，不要当成错误。
- **资源 ID 与音色匹配**：`X-Api-Resource-Id` 必须与音色类型对应。大模型音色用 `volc.service_type.10029`，声音复刻用 `seed-icl-1.0` / `seed-icl-2.0`。
- **新旧控制台鉴权不同**：旧版需要 `AppID + Access Token`（`Authorization: Bearer;token`），新版只需要 `X-Api-Key`。

### 服务器环境

- **nginx 默认 server 块冲突**：Alibaba Cloud Linux 4 的 nginx 自带一个监听 80 的默认 server，会导致自定义配置冲突，需要注释掉 `/etc/nginx/nginx.conf` 中的默认 server 块。
- **pip 安装的命令不在 PATH**：`uvicorn`、`certbot` 等通过 pip 安装后位于 `/usr/local/python3.10/bin/`，需要创建软链接到 `/usr/local/bin/` 或手动加 PATH。
- `**load_dotenv()` 路径问题**：如果 Python 文件在子目录（如 `test/main.py`），默认只会在当前目录找 `.env`，需要显式指定根目录路径。

## 文档维护约定

> 这是给自己和 AI Coding 工具看的纪律，确保项目信息始终准确。

- **README.md 常更新**：每当项目结构、启动方式、功能列表发生变化时，立即更新根目录和各子目录的 `README.md`。
- **AGENTS.md 常更新**：项目过程中踩到的任何坑（API 行为、环境配置、部署问题），发现后**立刻**补充到「踩坑记录」中，不要事后补。
- **模型版本常检查**：调用外部 API（LLM、语音等）时，定期确认是否仍为当前最强模型，避免默认参数退化到小模型。
- **任何改动后必须推送到 GitHub**：代码、配置、文档有任何修改，执行 `save`（或 `git push`）立刻推送，**绝不在本地堆积未提交的改动**。这既是备份，也是提交记录的证明。

## 部署约定

- 使用当前服务器作为生产/演示环境
- HTTP(80) / HTTPS(443) 端口已开放，可直接使用
- 建议最终部署使用 HTTPS（443）
- 项目截止时间后禁止重新构建部署

