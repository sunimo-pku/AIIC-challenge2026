import { useEffect, useRef, useState } from "react";
import { Send, Loader2, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { readSseStream } from "@/lib/sse";

/**
 * Stage 0 / Stage 1 共用的「围绕报告追问」对话组件。
 *
 * 设计要点：
 * 1. 不持久化也不入库，对话历史完全活在组件内存里。
 *    模拟模式下虽然 `chat_session_id` 由后端管理，但本组件不区分 — 后端的 history
 *    管理对前端透明，前端只负责把累积消息按 OpenAI 风格塞 `history` 字段。
 * 2. **一定要把"原始报告"作为 assistant 的第一条历史消息塞进去**，
 *    不然模型会失忆，第二轮自由对话时根本不知道用户在追问什么。
 * 3. 折叠态默认收起，有报告之后才显示入口；展开后聚焦输入框，
 *    避免攻略页一进来就出现一大块对话区，挤占报告本身的可视空间。
 */

interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface FollowUpChatProps {
  endpoint: string; // "/practice/chat" 或 "/interview/chat"
  stage: 0 | 1;
  sessionId?: number | null; // 模拟模式必传
  initialReport: string; // 上一步生成的结构化报告（作为对话上下文起点）
  initialUserMessage: string; // 触发报告的那条用户消息（用于补全 history 起点）
  placeholder?: string;
  /**
   * 当对话有内容时回调，便于父组件做留档动作（如 practice 把追问 messages 写入 logs）。
   * 不强制——目前主要用于 practice 模式的"留档"按钮把 chat 一并打包进去。
   */
  onMessagesChange?: (messages: Message[]) => void;
  difficulty?: string;
  interviewerStyle?: string;
}

export function FollowUpChat(props: FollowUpChatProps) {
  const {
    endpoint,
    stage,
    sessionId,
    initialReport,
    initialUserMessage,
    placeholder,
    onMessagesChange,
    difficulty,
    interviewerStyle,
  } = props;

  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState("");
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 报告变化（重新生成）时清空对话
  useEffect(() => {
    setMessages([]);
    setStreaming("");
    setOpen(false);
  }, [initialReport]);

  // 展开时自动聚焦输入框
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // 滚到对话底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // 通知父组件对话变化
  useEffect(() => {
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const canSend = !!initialReport && !loading && input.trim().length > 0;

  const handleSend = async () => {
    if (!canSend) return;
    const userMessage = input.trim();
    setInput("");

    // 把历史串起来：原始 user prompt → 原始报告 → ...历轮追问 → 本次追问
    const history: Message[] = [
      { role: "user", content: initialUserMessage },
      { role: "assistant", content: initialReport },
      ...messages,
    ];

    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);
    setStreaming("");
    setLoading(true);
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const token = localStorage.getItem("token");
      const body: Record<string, any> = {
        stage,
        message: userMessage,
        history,
        model: "kimi-k2.6",
        difficulty: difficulty || "中",
        interviewer_style: interviewerStyle || "严格追问型",
      };
      if (sessionId) body.session_id = sessionId;

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      let final = "";
      await readSseStream(resp, {
        onDelta: (d) => {
          final += d;
          setStreaming((prev) => prev + d);
        },
        onError: (msg) => toast.error(`追问失败：${msg}`),
        signal: abortRef.current.signal,
      });

      if (final) {
        setMessages([...newMessages, { role: "assistant", content: final }]);
      }
      setStreaming("");
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast.error(`请求异常：${e?.message || "未知错误"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!initialReport) return null;

  return (
    <div className="border border-border rounded-md bg-elevated">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full h-9 px-3 flex items-center justify-between border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle hover:text-accent transition-colors"
      >
        <span className="flex items-center gap-2">
          <MessageCircle size={12} strokeWidth={1.5} />
          [ ASK FOLLOW-UP ]
          {messages.length > 0 && (
            <span className="text-accent">[ {String(messages.length).padStart(2, "0")} ]</span>
          )}
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="flex flex-col">
          {(messages.length > 0 || streaming) && (
            <div
              ref={scrollRef}
              className="max-h-[360px] overflow-y-auto p-3 space-y-3 border-b border-border"
            >
              {messages.map((m, i) => (
                <MessageBubble key={i} role={m.role} content={m.content} />
              ))}
              {streaming && <MessageBubble role="assistant" content={streaming} streaming />}
            </div>
          )}

          <div className="p-3 flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder={
                placeholder ||
                (stage === 0
                  ? "围绕情报报告继续追问，例如：Redis 还会怎么考？"
                  : "围绕简历分析继续追问，例如：这条改写能再激进点吗？")
              }
              className="flex-1 bg-overlay border border-border rounded-sm px-2 py-1.5 text-[13px] text-fg outline-none focus:border-accent transition-colors resize-none"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="h-9 px-3 flex items-center gap-1.5 border border-accent text-accent font-mono text-[11px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent hover:text-bg transition-colors disabled:opacity-40 shrink-0"
              title="Enter 发送 · Shift+Enter 换行"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
              SEND
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  role,
  content,
  streaming,
}: {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[85%] bg-accent/10 border border-accent/40 text-fg rounded-sm px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap"
            : "max-w-[92%] bg-overlay border border-border text-fg rounded-sm px-3 py-2 text-[13px] leading-relaxed"
        }
      >
        {isUser ? (
          content
        ) : (
          <>
            <MarkdownRenderer content={content} />
            {streaming && (
              <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-accent align-middle animate-pulse" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
