# 项目 AGENTS.md

## 项目背景

- **项目名称**：2026 年 5 月挑战赛项目
- **正式开始**：2026-05-10 08:00
- **当前阶段**：项目准备阶段，环境已就绪

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


| 类别           | 状态  | 说明                        |
| ------------ | --- | ------------------------- |
| LLM API Keys | 已确定 | **Kimi**（通过 `openai` SDK 调用）|
| 音视频 API      | 可选  | 火山引擎备用                    |
| AI Coding 工具 | 待确认 | 确保额度充足                    |
| 录屏/剪辑工具      | 可选  | 剪映等即可                     |


## 预装环境

### 系统服务

| 软件 | 版本 | 说明 |
|------|------|------|
| Python | 3.10.17 | 系统默认 Python |
| Node.js | v20.18.2 | 前端构建 / 工具链 |
| npm | 10.9.4 | 包管理器 |
| nginx | 1.26.2 | 反向代理、静态文件服务 |
| certbot | 5.5.0 | HTTPS SSL 证书申请（配合 nginx 插件）|
| git | - | 版本控制 |

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

## 配置管理（安全）

- **敏感信息（API Key 等）**：写入 `.env` 文件，**绝不硬编码在代码中**
- **`.env` 已加入 `.gitignore`**：防止误提交到 GitHub
- **模板文件**：`.env.example` 记录了需要配置的环境变量，可复制为 `.env` 后填写
- **代码读取方式**：通过 `python-dotenv` 加载，示例：
  ```python
  from dotenv import load_dotenv
  import os

  load_dotenv()
  api_key = os.getenv("KIMI_API_KEY")
  ```

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

## 部署约定

- 使用当前服务器作为生产/演示环境
- HTTP(80) / HTTPS(443) 端口已开放，可直接使用
- 建议最终部署使用 HTTPS（443）
- 项目截止时间后禁止重新构建部署

