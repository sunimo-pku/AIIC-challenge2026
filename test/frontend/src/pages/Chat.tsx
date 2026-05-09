import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { TopBar } from "@/components/TopBar";
import { ModuleCard } from "@/components/ModuleCard";
import { StatusCard } from "@/components/StatusCard";
import { RulerScale } from "@/components/RulerScale";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import { useAuth } from "@/hooks/useAuth";
import {
  useChatSessions,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_TOP_P,
  DEFAULT_MAX_TOKENS,
} from "@/hooks/useChatSessions";
import { Select } from "@/components/ui/Select";
import {
  Square,
  Copy,
  Check,
  Mic,
  Paperclip,
  X,
  Image,
  Plus,
  Trash2,
  MessageSquare,
  LogOut,
  User,
} from "lucide-react";
import { MarkdownRenderer, extractImagesFromMarkdown } from "@/components/MarkdownRenderer";
import { ImageLightbox } from "@/components/ImageLightbox";

function formatTime(d = new Date()) {
  return d.toLocaleTimeString("en-GB", { hour12: false });
}

export default function Chat() {
  const { user, logout, token } = useAuth();
  const {
    sessions,
    activeId,
    messages,
    updateMessages,
    createSession,
    switchSession,
    deleteSession,
    updateSessionParams,
  } = useChatSessions(token);

  // 强制登录：未登录时自动跳转到登录页
  useEffect(() => {
    if (!token) {
      window.location.href = "/login";
    }
  }, [token]);

  const activeSession = sessions.find((s) => s.id === activeId);
  const currentModel = activeSession?.model || DEFAULT_MODEL;
  const currentTemperature = activeSession?.temperature ?? DEFAULT_TEMPERATURE;
  const currentTopP = activeSession?.topP ?? DEFAULT_TOP_P;
  const currentMaxTokens = activeSession?.maxTokens ?? DEFAULT_MAX_TOKENS;


  const modelLabel =
    currentModel === "kimi-k2.6"
      ? "k2.6"
      : currentModel === "deepseek-v4-pro"
      ? "v4-pro"
      : currentModel;
  const botLabel = currentModel.startsWith("deepseek") ? "DeepSeek" : "Kimi";

  // 模型参数限制（来自官方文档）
  const modelConfig = {
    "kimi-k2.6": {
      temperature: { fixed: true, value: 1.0, min: 1.0, max: 1.0, step: 0.1 },
      topP: { fixed: true, value: 0.95, min: 0.95, max: 0.95, step: 0.05 },
      maxTokens: { min: 1, max: 32768 },
    },
    "deepseek-v4-pro": {
      temperature: { fixed: false, value: 1.0, min: 0, max: 2, step: 0.1 },
      topP: { fixed: false, value: 1.0, min: 0, max: 1, step: 0.05 },
      maxTokens: { min: 1, max: 131072 },
    },
  };

  const cfg = modelConfig[currentModel as keyof typeof modelConfig] || modelConfig["deepseek-v4-pro"];
  const maxTokensLimit = cfg.maxTokens.max;

  const [input, setInput] = useState("");
  const [status, setStatus] = useState("就绪");
  const [isComposing, setIsComposing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [latency, setLatency] = useState("—");
  const [tokenCount, setTokenCount] = useState("—");
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [reasoningText, setReasoningText] = useState("");
  const [isReasoning, setIsReasoning] = useState(false);
  const [expandedReasonings, setExpandedReasonings] = useState<Set<number>>(new Set());
  const [modelNotice, setModelNotice] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{
    images: string[];
    index: number;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const handleVoiceComplete = useCallback(async (base64Wav: string) => {
    setIsRecognizing(true);
    setStatus("识别中…");
    try {
      const resp = await fetch("/asr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ audio: base64Wav, format: "wav" }),
      });
      const data = await resp.json();
      if (data.error) {
        setStatus("识别失败");
        setInput((prev) => prev + (prev ? "\n" : "") + data.error);
      } else {
        setStatus("就绪");
        setInput((prev) => prev + (prev ? "\n" : "") + data.text);
      }
    } catch (err: any) {
      setStatus("识别异常");
      setInput((prev) => prev + (prev ? "\n" : "") + "[语音识别失败]");
    } finally {
      setIsRecognizing(false);
    }
  }, []);

  const voice = useVoiceRecorder(handleVoiceComplete);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (imageFiles.length === 0) return;
    const base64s = await Promise.all(imageFiles.map(readFileAsBase64));
    setPendingImages((prev) => [...prev, ...base64s].slice(0, 4));
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.clipboardData.files.length > 0) {
      e.preventDefault();
      handleFiles(e.clipboardData.files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (dropRef.current) {
      dropRef.current.classList.remove("bg-accent-soft");
    }
    handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (dropRef.current) {
      dropRef.current.classList.add("bg-accent-soft");
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (dropRef.current) {
      dropRef.current.classList.remove("bg-accent-soft");
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    const images = pendingImages;
    if ((!text && images.length === 0) || isStreaming) return;

    const startTime = performance.now();
    setInput("");
    setPendingImages([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    const userMsg = {
      role: "user" as const,
      content: text || "[图片]",
      timestamp: formatTime(),
      tokens: text.length,
      images: images.length > 0 ? images : undefined,
      model: currentModel,
    };
    updateMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);
    setStatus("生成中…");
    setLatency("—");
    setReasoningText("");
    setIsReasoning(false);

    abortRef.current = new AbortController();
    let fullText = "";
    let accumulatedReasoning = "";
    let chunkCount = 0;

    // 预先创建空的 bot 消息占位，避免 fetch 失败后无消息可更新
    updateMessages((prev) => [
      ...prev,
      { role: "bot", content: "", timestamp: formatTime(), model: currentModel },
    ]);
    setStreamingText("");

    try {
      const resp = await fetch("/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text || "请描述这张图片",
          images: images.length > 0 ? images : undefined,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
            images: m.images,
          })),
          model: currentModel,
          temperature: currentTemperature,
          top_p: currentTopP,
          max_tokens: currentMaxTokens,
        }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) {
        if (resp.status === 401) {
          window.location.href = "/login";
          return;
        }
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${resp.status}`);
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamDone = false;

      // SSE 事件协议：data: <json>\n\n
      // 必须 JSON 编码，否则 delta 中的 \n\n（标题、---、表格、$$..$$ 两侧）
      // 会被这里 split("\n\n") 误判成消息边界，导致 markdown 块状元素全部错乱。
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const event of events) {
          if (!event.startsWith("data: ")) continue;
          const payload = event.slice(6);
          if (!payload) continue;
          let obj: { delta?: string; reasoning?: string; error?: string; done?: boolean };
          try {
            obj = JSON.parse(payload);
          } catch {
            continue;
          }
          if (obj.error) {
            fullText += (fullText ? "\n\n" : "") + `[ERROR] ${obj.error}`;
            chunkCount++;
            setStreamingText(fullText);
            streamDone = true;
            break;
          }
          if (obj.reasoning) {
            accumulatedReasoning += obj.reasoning;
            setReasoningText((prev) => prev + obj.reasoning!);
            setIsReasoning(true);
          }
          if (obj.delta) {
            setIsReasoning(false);
            fullText += obj.delta;
            chunkCount++;
            setStreamingText(fullText);
          }
          if (obj.done) {
            streamDone = true;
            break;
          }
        }
      }

      // 流式结束，把最终结果和 thinking 写入消息列表
      updateMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          ...next[next.length - 1],
          content: fullText,
          reasoning: accumulatedReasoning || undefined,
          model: currentModel,
        };
        return next;
      });
      setStreamingText("");

      const elapsed = Math.round(performance.now() - startTime);
      setLatency(`${elapsed}ms`);
      setTokenCount(String(fullText.length + chunkCount));
      setStatus("就绪");
    } catch (err: any) {
      if (err.name === "AbortError") {
        updateMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: fullText || "已停止生成",
            reasoning: accumulatedReasoning || undefined,
            model: currentModel,
          };
          return next;
        });
        setStatus("已停止");
      } else {
        updateMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: "请求失败: " + err.message,
            reasoning: accumulatedReasoning || undefined,
            model: currentModel,
          };
          return next;
        });
        setStatus("错误");
      }
    } finally {
      setIsStreaming(false);
      setStreamingText("");
      setReasoningText("");
      setIsReasoning(false);
      abortRef.current = null;
      scrollToBottom();
    }
  };

  const stopGeneration = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  };

  const copyMessage = async (index: number, content: string) => {
    const markCopied = () => {
      setCopiedId(index);
      setTimeout(() => setCopiedId(null), 1500);
    };

    // 优先使用现代 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(content);
        markCopied();
        return;
      } catch {
        // fallback
      }
    }

    // fallback: document.execCommand('copy')
    const textarea = document.createElement("textarea");
    textarea.value = content;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "-9999px";
    textarea.setAttribute("readonly", "");
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, content.length);
    try {
      const ok = document.execCommand("copy");
      if (ok) markCopied();
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const msgCount = messages.filter((m) => m.role === "user").length;
  const activeTitle =
    sessions.find((s) => s.id === activeId)?.title || "会话";

  const openLightbox = useCallback((images: string[], index: number) => {
    setLightbox({ images, index });
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
  }, []);

  const goToPrev = useCallback(() => {
    setLightbox((prev) =>
      prev
        ? {
            ...prev,
            index:
              (prev.index - 1 + prev.images.length) % prev.images.length,
          }
        : null
    );
  }, []);

  const goToNext = useCallback(() => {
    setLightbox((prev) =>
      prev
        ? { ...prev, index: (prev.index + 1) % prev.images.length }
        : null
    );
  }, []);

  const canSend =
    (input.trim() || pendingImages.length > 0) &&
    !isStreaming &&
    !voice.isRecording &&
    !isRecognizing;

  return (
    <div
      className="h-screen flex flex-col bg-bg text-fg overflow-hidden"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <TopBar
        center={
          <span>
            {activeTitle} · {modelLabel} · {isStreaming ? "生成中" : "运行中"}
          </span>
        }
        right={
          <div className="flex items-center gap-2">
            {user && (
              <>
                <span className="hidden sm:inline text-[11px] text-fg-subtle font-mono">
                  <User size={12} className="inline mr-1" strokeWidth={1.5} />
                  {user.username}
                </span>
                <button
                  onClick={logout}
                  className="p-1.5 text-fg-subtle hover:text-error transition-colors"
                  aria-label="退出登录"
                  title="退出登录"
                >
                  <LogOut size={14} strokeWidth={1.5} />
                </button>
              </>
            )}
          </div>
        }
      />

      <div className="flex-1 flex min-h-0">
        {/* 左侧状态栏 */}
        <aside className="hidden lg:flex w-[220px] shrink-0 border-r border-border flex-col overflow-y-auto p-4 gap-4">
          <StatusCard label="模型" value={modelLabel} />
          <StatusCard label="延迟" value={latency} unit="ms" />
          <StatusCard label="Token" value={tokenCount} />
          <RulerScale direction="vertical" className="mt-2" />
        </aside>

        {/* 中间主区域 */}
        <main className="flex-1 min-w-0 flex flex-col p-4 lg:p-6 gap-4">
          {modelNotice && (
            <div className="shrink-0 px-3 py-1.5 text-[12px] text-fg bg-accent-soft/40 border border-accent/20 rounded-sm flex items-center gap-2 transition-opacity duration-300">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              {modelNotice}
            </div>
          )}
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
                        {msg.role === "user"
                          ? "用户"
                          : msg.model
                          ? msg.model.startsWith("deepseek")
                            ? "DeepSeek"
                            : "Kimi"
                          : botLabel}
                      </span>
                      {msg.role === "bot" && msg.model && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-overlay text-fg-subtle border border-border font-mono">
                          {msg.model}
                        </span>
                      )}
                    </div>
                    {msg.role === "bot" && msg.tokens && (
                      <span className="text-[12px] text-fg-subtle">
                        Δ {msg.tokens}t
                      </span>
                    )}
                  </div>

                  {/* 正文 */}
                  <div className="mt-1 pl-[52px] border-l border-accent/40">
                    {/* 图片缩略图 */}
                    {msg.images && msg.images.length > 0 && (
                      <div className="pl-3 mb-2 flex flex-wrap gap-2">
                        {msg.images.map((img, idx) => (
                          <img
                            key={idx}
                            src={img}
                            alt=""
                            className="h-20 w-20 object-cover rounded-sm border border-border cursor-zoom-in"
                            loading="lazy"
                            onClick={() => openLightbox(msg.images!, idx)}
                          />
                        ))}
                      </div>
                    )}
                    <div className="pl-3 text-[15px] leading-relaxed text-fg">
                      {msg.role === "bot" && (
                        <>
                          {/* 流式中的实时思考过程 */}
                          {isStreaming &&
                            i === messages.length - 1 &&
                            reasoningText && (
                              <div className="mb-3">
                                <div className="text-[11px] font-mono text-fg-subtle uppercase tracking-[0.12em] mb-1 flex items-center gap-2">
                                  <span>THINKING</span>
                                  {isReasoning && (
                                    <span className="inline-flex gap-1">
                                      <span className="pulse-dot-1 inline-block w-1 h-1 bg-fg-subtle" />
                                      <span className="pulse-dot-2 inline-block w-1 h-1 bg-fg-subtle" />
                                      <span className="pulse-dot-3 inline-block w-1 h-1 bg-fg-subtle" />
                                    </span>
                                  )}
                                </div>
                                <div className="text-[13px] text-fg-muted italic leading-relaxed border-l border-border pl-3">
                                  {reasoningText}
                                </div>
                              </div>
                            )}
                          {/* 已完成的思考过程（可折叠） */}
                          {!isStreaming && msg.reasoning && (
                            <div className="mb-3">
                              <button
                                onClick={() =>
                                  setExpandedReasonings((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(i)) next.delete(i);
                                    else next.add(i);
                                    return next;
                                  })
                                }
                                className="text-[11px] font-mono text-fg-subtle uppercase tracking-[0.12em] mb-1 flex items-center gap-1.5 hover:text-fg transition-colors"
                              >
                                <span>THINKING</span>
                                <span>
                                  {expandedReasonings.has(i) ? "−" : "+"}
                                </span>
                              </button>
                              {expandedReasonings.has(i) && (
                                <div className="text-[13px] text-fg-muted italic leading-relaxed border-l border-border pl-3">
                                  {msg.reasoning}
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                      {msg.role === "bot" && (msg.content || (isStreaming && i === messages.length - 1)) ? (
                        <MarkdownRenderer
                          content={
                            isStreaming && i === messages.length - 1
                              ? streamingText
                              : msg.content
                          }
                          onImageClick={(src) => {
                            const allImages = extractImagesFromMarkdown(
                              isStreaming && i === messages.length - 1
                                ? streamingText
                                : msg.content
                            );
                            const idx = allImages.indexOf(src);
                            openLightbox(allImages, Math.max(0, idx));
                          }}
                        />
                      ) : msg.content ? (
                        msg.content
                      ) : (
                        <span className="inline-flex gap-1.5 items-center">
                          <span className="pulse-dot-1 inline-block w-1.5 h-1.5 bg-fg-subtle" />
                          <span className="pulse-dot-2 inline-block w-1.5 h-1.5 bg-fg-subtle" />
                          <span className="pulse-dot-3 inline-block w-1.5 h-1.5 bg-fg-subtle" />
                        </span>
                      )}
                      {isStreaming &&
                        msg.role === "bot" &&
                        i === messages.length - 1 && (
                          <span className="cursor-blink text-accent">▎</span>
                        )}
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
          <div ref={dropRef}>
            <ModuleCard
              label={
                voice.isRecording
                  ? "录音中"
                  : isRecognizing
                  ? "识别中"
                  : "输入"
              }
              meta={`${input.length} / 2000`}
              className={cn(
                "focus-within:border-accent transition-colors duration-150",
                voice.isRecording && "border-signal"
              )}
              status={
                voice.error ? (
                  <span className="text-[11px] text-error">{voice.error}</span>
                ) : voice.isRecording ? (
                  <span className="flex items-center gap-2 text-signal">
                    <span className="pulse-dot-1 inline-block w-1 h-1 bg-signal" />
                    <span className="pulse-dot-2 inline-block w-1 h-1 bg-signal" />
                    <span className="pulse-dot-3 inline-block w-1 h-1 bg-signal" />
                    <span className="text-[11px] font-mono">RECORDING</span>
                  </span>
                ) : isRecognizing ? (
                  <span className="flex items-center gap-2 text-accent">
                    <span className="pulse-dot-1 inline-block w-1 h-1 bg-accent" />
                    <span className="pulse-dot-2 inline-block w-1 h-1 bg-accent" />
                    <span className="pulse-dot-3 inline-block w-1 h-1 bg-accent" />
                    <span className="text-[11px] font-mono">RECOGNIZING</span>
                  </span>
                ) : pendingImages.length > 0 ? (
                  <span className="flex items-center gap-1 text-[11px] text-accent">
                    <Image size={12} />
                    {pendingImages.length} 张图片
                  </span>
                ) : (
                  <span className="hidden sm:inline">
                    按 Enter 发送 · Shift+Enter 换行
                  </span>
                )
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
                    disabled={!canSend}
                    className="flex items-center gap-1 text-[12px] text-accent hover:text-accent-strong disabled:text-fg-subtle disabled:opacity-40 transition-colors"
                  >
                    发送 →
                  </button>
                )
              }
            >
              <div className="flex flex-col">
                {/* 已选图片预览 */}
                {pendingImages.length > 0 && (
                  <div className="px-4 pt-3 flex flex-wrap gap-2">
                    {pendingImages.map((img, idx) => (
                      <div key={idx} className="relative h-16 w-16 shrink-0">
                        <img
                          src={img}
                          alt=""
                          className="h-full w-full object-cover rounded-sm border border-border"
                        />
                        <button
                          onClick={() =>
                            setPendingImages((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="absolute -top-1 -right-1 h-4 w-4 bg-error text-bg flex items-center justify-center rounded-none"
                          aria-label="移除图片"
                        >
                          <X size={10} strokeWidth={2} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                  onPaste={handlePaste}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  placeholder={
                    voice.isRecording
                      ? "正在录音，点击麦克风按钮停止…"
                      : isRecognizing
                      ? "语音识别中…"
                      : "在这里输入消息，支持粘贴或拖拽图片…"
                  }
                  disabled={isStreaming || voice.isRecording || isRecognizing}
                  className="bg-transparent text-fg placeholder:text-fg-subtle resize-none min-h-10 max-h-40 px-4 py-3 text-[15px] leading-relaxed outline-none w-full"
                />
                <div className="border-t border-border" />
                <div className="h-9 px-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      aria-label={voice.isRecording ? "停止录音" : "录音"}
                      onClick={voice.toggleRecording}
                      disabled={isStreaming || isRecognizing}
                      className={cn(
                        "h-9 w-9 rounded-sm flex items-center justify-center active:scale-[0.97] transition-all duration-100 relative",
                        voice.isRecording
                          ? "bg-signal text-bg"
                          : "bg-accent text-bg hover:bg-accent-strong disabled:opacity-40"
                      )}
                    >
                      {voice.isRecording ? (
                        <Square size={14} strokeWidth={1.5} />
                      ) : (
                        <Mic size={16} strokeWidth={1.5} />
                      )}
                      {voice.isRecording && (
                        <>
                          <span className="absolute -top-1 -right-1 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-signal opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-signal" />
                          </span>
                          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-signal whitespace-nowrap">
                            {voice.duration}s
                          </span>
                        </>
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFiles(e.target.files)}
                    />
                    <button
                      aria-label="上传图片"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={
                        isStreaming || voice.isRecording || isRecognizing
                      }
                      className={cn(
                        "h-9 w-9 rounded-sm border flex items-center justify-center transition-colors duration-150",
                        pendingImages.length > 0
                          ? "border-accent text-accent bg-accent-soft"
                          : "border-border text-fg-muted hover:text-fg hover:border-fg-subtle/50"
                      )}
                    >
                      <Paperclip size={16} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </div>
            </ModuleCard>
          </div>
        </main>

        {/* 右侧会话列表 */}
        <aside className="hidden xl:flex w-[320px] shrink-0 border-l border-border flex-col overflow-y-auto p-4 gap-4">
          <ModuleCard
            label="会话列表"
            meta={`${sessions.length}`}
            action={
              <button
                onClick={createSession}
                className="flex items-center gap-1 text-[12px] text-accent hover:text-accent-strong transition-colors"
              >
                <Plus size={12} />
                新建
              </button>
            }
          >
            <div className="px-2 py-2 space-y-1">
              {sessions.map((s) => {
                const isActive = s.id === activeId;
                const userMsgs = s.messages.filter((m) => m.role === "user");
                const lastMsg = userMsgs[userMsgs.length - 1];
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "group flex items-center gap-2 px-3 py-2 text-[12px] cursor-pointer transition-colors",
                      isActive
                        ? "bg-elevated text-fg border border-border"
                        : "text-fg-subtle hover:text-fg hover:bg-elevated/50 border border-transparent"
                    )}
                  >
                    <MessageSquare size={14} strokeWidth={1.5} />
                    <div
                      className="flex-1 min-w-0"
                      onClick={() => switchSession(s.id)}
                    >
                      <div className="truncate">{s.title}</div>
                      <div className="text-[10px] text-fg-subtle truncate">
                        {lastMsg
                          ? lastMsg.images && lastMsg.images.length > 0
                            ? `[${lastMsg.images.length} 张图片] ${lastMsg.content}`
                            : lastMsg.content
                          : "无消息"}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(s.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-fg-subtle hover:text-error transition-opacity"
                      aria-label="删除会话"
                    >
                      <Trash2 size={12} strokeWidth={1.5} />
                    </button>
                  </div>
                );
              })}
              {sessions.length === 0 && (
                <div className="text-[12px] text-fg-subtle text-center py-4">
                  暂无会话
                </div>
              )}
            </div>
          </ModuleCard>

          <ModuleCard label="参数" meta="可调">
            <div className="px-4 py-3 space-y-3 text-[12px] text-fg-subtle">
              <div className="space-y-1">
                <span>模型</span>
                <Select
                  value={currentModel}
                  onChange={(e) => {
                    const newModel = e.target.value;
                    if (newModel !== currentModel && messages.length > 0) {
                      setModelNotice(`已切换至 ${newModel}，后续消息将由该模型生成`);
                      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
                      noticeTimerRef.current = setTimeout(() => setModelNotice(null), 4000);
                    }
                    // 空会话（只有欢迎消息）时，同步更新欢迎消息的 model
                    if (
                      newModel !== currentModel &&
                      messages.length === 1 &&
                      messages[0].role === "bot"
                    ) {
                      updateMessages((prev) => {
                        const next = [...prev];
                        next[0] = { ...next[0], model: newModel };
                        return next;
                      });
                    }
                    const newCfg =
                      modelConfig[newModel as keyof typeof modelConfig] ||
                      modelConfig["deepseek-v4-pro"];
                    updateSessionParams({
                      model: newModel,
                      temperature: newCfg.temperature.value,
                      topP: newCfg.topP.value,
                      maxTokens: Math.min(currentMaxTokens, newCfg.maxTokens.max),
                    });
                  }}
                  disabled={isStreaming}
                  className="py-1.5 text-[12px]"
                >
                  <option value="kimi-k2.6">kimi-k2.6</option>
                  <option value="deepseek-v4-pro">deepseek-v4-pro</option>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>温度</span>
                  <span className="text-fg">
                    {currentTemperature.toFixed(2)}
                    {cfg.temperature.fixed && (
                      <span className="text-fg-subtle ml-1">(固定)</span>
                    )}
                  </span>
                </div>
                <input
                  type="number"
                  min={cfg.temperature.min}
                  max={cfg.temperature.max}
                  step={cfg.temperature.step}
                  value={currentTemperature}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v))
                      updateSessionParams({
                        temperature: Math.min(
                          cfg.temperature.max,
                          Math.max(cfg.temperature.min, v)
                        ),
                      });
                  }}
                  disabled={isStreaming || cfg.temperature.fixed}
                  className="w-full bg-overlay border border-border rounded-sm px-2 py-1 text-[12px] text-fg outline-none focus:border-accent disabled:opacity-40"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Top P</span>
                  <span className="text-fg">
                    {currentTopP.toFixed(2)}
                    {cfg.topP.fixed && (
                      <span className="text-fg-subtle ml-1">(固定)</span>
                    )}
                  </span>
                </div>
                <input
                  type="number"
                  min={cfg.topP.min}
                  max={cfg.topP.max}
                  step={cfg.topP.step}
                  value={currentTopP}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v))
                      updateSessionParams({
                        topP: Math.min(cfg.topP.max, Math.max(cfg.topP.min, v)),
                      });
                  }}
                  disabled={isStreaming || cfg.topP.fixed}
                  className="w-full bg-overlay border border-border rounded-sm px-2 py-1 text-[12px] text-fg outline-none focus:border-accent disabled:opacity-40"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>最大长度</span>
                  <span className="text-fg">{currentMaxTokens}</span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={maxTokensLimit}
                  step={1}
                  value={currentMaxTokens}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v))
                      updateSessionParams({
                        maxTokens: Math.min(
                          maxTokensLimit,
                          Math.max(1, v)
                        ),
                      });
                  }}
                  disabled={isStreaming}
                  className="w-full bg-overlay border border-border rounded-sm px-2 py-1 text-[12px] text-fg outline-none focus:border-accent"
                />
              </div>
            </div>
          </ModuleCard>
        </aside>
      </div>

      <ImageLightbox
        images={lightbox?.images ?? []}
        currentIndex={lightbox?.index ?? 0}
        isOpen={!!lightbox}
        onClose={closeLightbox}
        onPrev={goToPrev}
        onNext={goToNext}
      />
    </div>
  );
}
