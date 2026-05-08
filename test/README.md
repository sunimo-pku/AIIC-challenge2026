# test / 基础测试

本目录用于验证服务器环境和第三方 API 连通性，**不代表最终项目代码**。

## 启动方式

```bash
cd /root/workspace/test
uvicorn main:app --host 127.0.0.1 --port 8000
```

> 生产环境已通过 Nginx 将 80 端口反向代理到 127.0.0.1:8000，直接访问服务器 IP 即可。

## 测试功能

打开浏览器访问 `http://<服务器IP>/`

### 1. Kimi 文本对话

- 输入文字消息
- 后端调用 Kimi API（`moonshot-v1-8k`）
- 返回 AI 回复

### 2. 豆包语音合成（TTS）

- 输入要合成的文本
- 可选择音色（默认：`zh_female_qingchezizi_moon_bigtts`）
- 后端调用火山引擎 V3 语音合成接口
- 前端自动播放合成的 MP3 音频

## 接口说明

| 接口 | 方法 | 说明 |
|------|------|------|
| `GET /` | - | 返回测试页面 |
| `POST /chat` | JSON `{message}` | Kimi 文本对话 |
| `POST /tts` | JSON `{text, speaker?}` | 豆包语音合成 |

## 依赖配置

测试服务读取项目根目录的 `.env` 文件，需要配置以下变量：

```bash
KIMI_API_KEY=sk-xxx
VOLC_API_KEY=xxx
```
