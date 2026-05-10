/**
 * 统一的 SSE 流式解析 helper。
 *
 * 为什么单独抽出来：
 *   - fetch + ReadableStream 的 chunk 切包是按 TCP 包来的，一条
 *     `data: {"delta":"..."}\n\n` 完全可能被切到两个 chunk。
 *   - 早期各 Stage 页面都是 `chunk.split("\n\n")` 直接解析，跨 chunk 的消息
 *     前一半 JSON.parse 抛错被静默吞掉、后一半不以 `data:` 开头被 continue
 *     跳过 → 整条消息丢失。
 *   - decoder.decode(value) 必须传 { stream: true }，否则中文跨 chunk 时
 *     边界字节会被替换成乱码字符。
 *
 * 用法：
 *   await readSseStream(resp, {
 *     onDelta: (s) => setStreaming(prev => prev + s),
 *     onStatus: (s) => setStatus(s),
 *     onError: (s) => toast.error(s),
 *     onDone:  () => setStreaming(""),
 *   });
 */
export interface SseHandlers {
  onDelta?: (text: string) => void;
  onReasoning?: (text: string) => void;
  onStatus?: (text: string) => void;
  onError?: (text: string) => void;
  onDone?: () => void;
  signal?: AbortSignal;
}

export async function readSseStream(resp: Response, handlers: SseHandlers): Promise<string> {
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const data = await resp.clone().json();
      if (data?.detail) detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch { /* response 不是 json，忽略 */ }
    handlers.onError?.(detail);
    handlers.onDone?.();
    return "";
  }

  const reader = resp.body?.getReader();
  if (!reader) {
    handlers.onError?.("Empty response body");
    handlers.onDone?.();
    return "";
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let collected = "";
  let doneFired = false;
  const fireDone = () => {
    if (doneFired) return;
    doneFired = true;
    handlers.onDone?.();
  };

  try {
    while (true) {
      if (handlers.signal?.aborted) {
        await reader.cancel();
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 按 \n\n 切消息边界，保留最后一个不完整片段在 buffer 中
      let idx;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (!raw.startsWith("data:")) continue;
        const payload = raw.slice(5).trim();
        if (!payload) continue;
        let event: any;
        try {
          event = JSON.parse(payload);
        } catch {
          // 单条消息 JSON 损坏时跳过这一条，避免污染后续解析
          continue;
        }
        if (event.delta) {
          collected += event.delta;
          handlers.onDelta?.(event.delta);
        }
        if (event.reasoning) handlers.onReasoning?.(event.reasoning);
        if (event.status) handlers.onStatus?.(event.status);
        if (event.error) handlers.onError?.(event.error);
        if (event.done) fireDone();
      }
    }
  } finally {
    fireDone();
  }
  return collected;
}
