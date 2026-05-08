import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { TopBar } from "@/components/TopBar";
import { ModuleCard } from "@/components/ModuleCard";
import { StatusCard } from "@/components/StatusCard";
import { RulerScale } from "@/components/RulerScale";
import { Square, Copy, Check, Mic, Paperclip } from "lucide-react";

interface Message {
  role: "user" | "bot";
  content: string;
  timestamp: string;
  tokens?: number;
  latency?: number;
}

function formatTime(d = new Date()) {
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "bot",
      content: "你好！我是 Kimi，有什么可以帮你的吗？",
      timestamp: formatTime(),
      tokens: 24,
    },
  ]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("就绪");
  const [isComposing, setIsComposing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [latency, setLatency] = useState("—");
  const [tokenCount, setTokenCount] = useState("—");
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const startTime = performance.now();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg: Message = {
      role: "user",
      content: text,
      timestamp: formatTime(),
      tokens: text.length,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStatus("生成中…");
    setLatency("—");

    abortRef.current = new AbortController();
    let fullText = "";
    let chunkCount = 0;

    try {
      const resp = await fetch("/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        signal: abortRef.current.signal,
      });

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      setMessages((prev) => [
        ...prev,
        { role: "bot", content: "", timestamp: formatTime() },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          if (data.startsWith("[ERROR]")) {
            fullText += data;
            break;
          }
          fullText += data;
          chunkCount++;
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              ...next[next.length - 1],
              content: fullText,
            };
            return next;
          });
        }
      }

      const elapsed = Math.round(performance.now() - startTime);
      setLatency(`${elapsed}ms`);
      setTokenCount(String(fullText.length + chunkCount));
      setStatus("就绪");
    } catch (err: any) {
      if (err.name === "AbortError") {
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            content: "已停止生成",
            timestamp: formatTime(),
          },
        ]);
        setStatus("已停止");
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            content: "请求失败: " + err.message,
            timestamp: formatTime(),
          },
        ]);
        setStatus("错误");
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      scrollToBottom();
    }
  };

  const stopGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  };

  const copyMessage = (index: number, content: string) => {
    navigator.clipboard.writeText(content).then(() => {
      setCopiedId(index);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const msgCount = messages.filter((m) => m.role === "user").length;

  return (
    <div className="h-screen flex flex-col bg-bg text-fg overflow-hidden">
      <TopBar
        center={
          <span>
            会话 002 · k2.6 · {isStreaming ? "生成中" : "运行中"}
          </span>
        }
      />

      <div className="flex-1 flex min-h-0">
        {/* 左侧状态栏 */}
        <aside className="hidden lg:flex w-[220px] shrink-0 border-r border-border flex-col overflow-y-auto p-4 gap-4">
          <StatusCard label="模型" value="k2.6" />
          <StatusCard label="延迟" value={latency} unit="ms" />
          <StatusCard label="Token" value={tokenCount} />
          <RulerScale direction="vertical" className="mt-2" />
        </aside>

        {/* 中间主区域 */}
        <main className="flex-1 min-w-0 flex flex-col p-4 lg:p-6 gap-4">
          {/* 对话流 */}
          <ModuleCard
            label="对话"
            meta={`${msgCount} 条消息`}
            className="flex-1 min-h-0"
            status={
              isStreaming ? (
                <span className="flex items-center gap-2">
                  <span className="text-accent">生成中</span>
                  <span className="pulse-dot-1 inline-block w-1 h-1 bg-fg-subtle" />
                  <span className="pulse-dot-2 inline-block w-1 h-1 bg-fg-subtle" />
                  <span className="pulse-dot-3 inline-block w-1 h-1 bg-fg-subtle" />
                </span>
              ) : (
                <span>{status}</span>
              )
            }
            action={
              <span className="text-[12px] text-fg-subtle">
                Δ {latency}
              </span>
            }
          >
            <div
              ref={scrollRef}
              className="h-full overflow-y-auto px-4 py-4 space-y-5 scanlines"
            >
              {messages.map((msg, i) => (
                <div key={i} className="group relative">
                  {/* 头部信息 */}
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12px] text-fg-subtle">
                        {msg.timestamp}
                      </span>
                      <span
                        className={cn(
                          "text-[12px] font-medium",
                          msg.role === "user"
                            ? "text-accent"
                            : msg.role === "bot"
                            ? "text-fg"
                            : "text-fg-muted"
                        )}
                      >
                        {msg.role === "user" ? "用户" : "Kimi"}
                      </span>
                    </div>
                    {msg.role === "bot" && msg.tokens && (
                      <span className="text-[12px] text-fg-subtle">
                        Δ {msg.tokens}t
                      </span>
                    )}
                  </div>

                  {/* 正文 */}
                  <div className="mt-1 pl-[52px] border-l border-accent/40">
                    <div className="pl-3 text-[15px] leading-relaxed text-fg">
                      {msg.content || (
                        <span className="inline-flex gap-1.5 items-center">
                          <span className="pulse-dot-1 inline-block w-1.5 h-1.5 bg-fg-subtle" />
                          <span className="pulse-dot-2 inline-block w-1.5 h-1.5 bg-fg-subtle" />
                          <span className="pulse-dot-3 inline-block w-1.5 h-1.5 bg-fg-subtle" />
                        </span>
                      )}
                      {isStreaming &&
                        msg.role === "bot" &&
                        i === messages.length - 1 &&
                        msg.content && <span className="cursor-blink text-accent">▎</span>}
                    </div>
                  </div>

                  {/* 悬浮操作 */}
                  {msg.role === "bot" && msg.content && (
                    <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <button
                        onClick={() => copyMessage(i, msg.content)}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] text-fg-subtle hover:text-fg hover:bg-overlay transition-colors"
                        aria-label="复制"
                      >
                        {copiedId === i ? (
                          <Check size={12} />
                        ) : (
                          <Copy size={12} />
                        )}
                        {copiedId === i ? "已复制" : "复制"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ModuleCard>

          {/* 输入区 */}
          <ModuleCard
            label="输入"
            meta={`${input.length} / 2000`}
            className="focus-within:border-accent transition-colors duration-150"
            status={
              <span className="hidden sm:inline">
                按 Enter 发送 · Shift+Enter 换行
              </span>
            }
            action={
              isStreaming ? (
                <button
                  onClick={stopGeneration}
                  className="flex items-center gap-1 text-[12px] text-error hover:text-fg transition-colors"
                >
                  <Square size={12} />
                  停止
                </button>
              ) : (
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="flex items-center gap-1 text-[12px] text-accent hover:text-accent-strong disabled:text-fg-subtle disabled:opacity-40 transition-colors"
                >
                  发送 →
                </button>
              )
            }
          >
            <div className="flex flex-col">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height =
                    Math.min(e.target.scrollHeight, 160) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !isComposing) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                placeholder="在这里输入消息…"
                disabled={isStreaming}
                className="bg-transparent text-fg placeholder:text-fg-subtle resize-none min-h-10 max-h-40 px-4 py-3 text-[15px] leading-relaxed outline-none w-full"
              />
              <div className="border-t border-border" />
              <div className="h-9 px-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    aria-label="录音"
                    className="h-9 w-9 rounded-sm bg-accent text-bg flex items-center justify-center hover:bg-accent-strong active:scale-[0.97] transition-all duration-100"
                  >
                    <Mic size={16} strokeWidth={1.5} />
                  </button>
                  <button
                    aria-label="附件"
                    className="h-9 w-9 rounded-sm border border-border flex items-center justify-center text-fg-muted hover:text-fg hover:border-fg-subtle/50 transition-colors duration-150"
                  >
                    <Paperclip size={16} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            </div>
          </ModuleCard>
        </main>

        {/* 右侧日志 */}
        <aside className="hidden xl:flex w-[320px] shrink-0 border-l border-border flex-col overflow-y-auto p-4 gap-4">
          <ModuleCard label="会话记录" meta="最近">
            <div className="px-4 py-3 space-y-2">
              {messages
                .filter((m) => m.role === "user")
                .map((m, i) => (
                  <div
                    key={i}
                    className="text-[12px] text-fg-subtle border-b border-border/30 pb-2 last:border-b-0"
                  >
                    <div className="flex justify-between">
                      <span className="text-accent">用户</span>
                      <span>{m.timestamp}</span>
                    </div>
                    <div className="mt-0.5 truncate">{m.content}</div>
                  </div>
                ))}
              {messages.filter((m) => m.role === "user").length === 0 && (
                <div className="text-[12px] text-fg-subtle text-center py-4">
                  暂无消息
                </div>
              )}
            </div>
          </ModuleCard>

          <ModuleCard label="参数" meta="默认">
            <div className="px-4 py-3 space-y-2 text-[12px] text-fg-subtle">
              <div className="flex justify-between">
                <span>温度</span>
                <span className="text-fg">0.70</span>
              </div>
              <div className="flex justify-between">
                <span>Top P</span>
                <span className="text-fg">0.90</span>
              </div>
              <div className="flex justify-between">
                <span>最大长度</span>
                <span className="text-fg">8192</span>
              </div>
              <div className="flex justify-between">
                <span>模型</span>
                <span className="text-fg">kimi-k2.6</span>
              </div>
            </div>
          </ModuleCard>
        </aside>
      </div>
    </div>
  );
}
