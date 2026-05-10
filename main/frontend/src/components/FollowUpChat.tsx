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
  const prevReportRef = useRef(initialReport);
  useEffect(() => {
    if (initialReport && initialReport !== prevReportRef.current) {
      setMessages([]);
      setStreaming("");
      setOpen(false);
      prevReportRef.current = initialReport;
    }
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
    <div className="border border-border/50 rounded-xl bg-elevated shadow-sm overflow-hidden transition-all duration-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full h-12 px-4 flex items-center justify-between border-b border-border/40 text-[13px] font-medium tracking-wide text-fg-subtle hover:text-accent hover:bg-bg/30 transition-all duration-200"
      >
        <span className="flex items-center gap-2">
          <MessageCircle size={14} strokeWidth={1.5} />
          追问助手
          {messages.length > 0 && (
            <span className="text-accent ml-1 bg-accent-soft px-1.5 py-0.5 rounded-md text-[11px]">{messages.length}</span>
          )}
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="flex flex-col">
          {(messages.length > 0 || streaming) && (
            <div
              ref={scrollRef}
              className="max-h-[360px] overflow-y-auto p-4 space-y-4 border-b border-border/40 bg-bg/20"
            >
              {messages.map((m, i) => (
                <MessageBubble key={i} role={m.role} content={m.content} />
              ))}
              {streaming && <MessageBubble role="assistant" content={streaming} streaming />}
            </div>
          )}

          <div className="p-4 flex items-end gap-3 bg-bg/30">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder={
                placeholder ||
                (stage === 0
                  ? "围绕这份面经继续追问，例如：Redis 还会怎么考？"
                  : "围绕简历分析继续追问，例如：这条改写能再激进点吗？")
              }
              className="flex-1 bg-elevated border border-border/50 rounded-xl px-3 py-2.5 text-[14px] text-fg outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all resize-none shadow-sm"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="h-10 px-4 flex items-center gap-1.5 bg-accent text-white font-medium text-[13px] tracking-wide rounded-xl hover:bg-accent-strong transition-all duration-200 disabled:opacity-40 shadow-sm shrink-0"
              title="Enter 发送 · Shift+Enter 换行"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              发送
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
            ? "max-w-[85%] bg-accent text-white shadow-sm rounded-2xl rounded-tr-sm px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap"
            : "max-w-[92%] bg-elevated border border-border/50 shadow-sm text-fg rounded-2xl rounded-tl-sm px-4 py-2.5 text-[14px] leading-relaxed"
        }
      >
        {isUser ? (
          content
        ) : (
          <>
            <MarkdownRenderer content={content} />
            {streaming && (
              <span className="inline-block w-1.5 h-3.5 ml-1 bg-accent align-middle animate-pulse rounded-full" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
