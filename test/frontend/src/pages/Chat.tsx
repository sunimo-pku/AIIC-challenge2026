import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Header } from "@/components/Header";
import { Bot, Send, Square, Copy, Check, User } from "lucide-react";

interface Message {
  role: "user" | "bot";
  content: string;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", content: "你好！我是 Kimi，有什么可以帮你的吗？" },
  ]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("就绪");
  const [isComposing, setIsComposing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsStreaming(true);
    setStatus("Kimi 思考中...");

    abortRef.current = new AbortController();
    let fullText = "";

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

      setMessages((prev) => [...prev, { role: "bot", content: "" }]);

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
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { role: "bot", content: fullText };
            return next;
          });
          scrollToBottom();
        }
      }
      setStatus("就绪");
    } catch (err: any) {
      if (err.name === "AbortError") {
        setMessages((prev) => [
          ...prev,
          { role: "bot", content: "⏹️ 已停止生成" },
        ]);
        setStatus("已停止");
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "bot", content: "请求失败: " + err.message },
        ]);
        setStatus("请求失败");
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

  return (
    <div className="mx-auto flex h-[calc(100vh-16px)] max-w-3xl flex-col px-4">
      <Header icon="💬" title="AI 对话" subtitle="Kimi 旗舰模型 · 流式输出" />

      <Card className="flex flex-1 flex-col overflow-hidden">
        <CardHeader>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Bot size={18} className="text-primary" />
          </div>
          <h2 className="flex-1 text-base font-semibold text-text">与 Kimi 对话</h2>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            kimi-k2.6
          </span>
        </CardHeader>

        <div
          ref={scrollRef}
          className="flex-1 space-y-1 overflow-y-auto px-4 py-3"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 py-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                  msg.role === "user"
                    ? "bg-gradient-to-br from-emerald-500 to-emerald-400"
                    : "bg-gradient-to-br from-primary to-indigo-500"
                }`}
              >
                {msg.role === "user" ? (
                  <User size={14} className="text-white" />
                ) : (
                  <Bot size={14} className="text-white" />
                )}
              </div>
              <div className="max-w-[80%]">
                <div
                  className={`rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed ${
                    msg.role === "user"
                      ? "rounded-br-sm bg-primary text-[#0a0e17]"
                      : "rounded-bl-sm border border-border bg-bg-secondary text-text"
                  }`}
                >
                  {msg.content || (
                    <span className="inline-flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-text-secondary [animation-delay:-0.32s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-text-secondary [animation-delay:-0.16s]" />
                      <span className="h-2 w-2 animate-bounce rounded-full bg-text-secondary" />
                    </span>
                  )}
                </div>
                {msg.role === "bot" && msg.content && !msg.content.startsWith("⏹️") && (
                  <div className="mt-1 flex gap-2 opacity-0 transition-opacity duration-200 hover:opacity-100">
                    <button
                      onClick={() => copyMessage(i, msg.content)}
                      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-text-secondary hover:bg-bg-secondary hover:text-text"
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
            </div>
          ))}
        </div>

        <CardContent className="border-t border-border pt-4">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-bg-secondary p-2 transition-all duration-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-ring">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height =
                  Math.min(e.target.scrollHeight, 140) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !isComposing) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder="输入消息，按 Enter 发送..."
              className="max-h-[140px] min-h-[40px] flex-1 resize-none bg-transparent px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted"
              disabled={isStreaming}
            />
            {isStreaming ? (
              <Button
                variant="danger"
                size="sm"
                onClick={stopGeneration}
                className="h-9 w-9 rounded-full p-0"
              >
                <Square size={14} />
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={sendMessage}
                disabled={!input.trim()}
                className="h-9 w-9 rounded-full p-0"
              >
                <Send size={14} />
              </Button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between px-1">
            <span className="text-[11px] text-text-muted">{status}</span>
            <span className="text-[11px] text-text-muted/60">
              Enter 发送 · Shift+Enter 换行
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
