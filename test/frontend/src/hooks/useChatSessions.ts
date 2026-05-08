import { useState, useEffect, useCallback, useRef } from "react";
import { get, set } from "idb-keyval";

export interface Message {
  role: "user" | "bot";
  content: string;
  timestamp: string;
  tokens?: number;
  latency?: number;
  images?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
}

const STORAGE_KEY = "aiic_chat_sessions";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** 兜底标题：提取第一条用户消息的关键词 */
function fallbackTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "新会话";
  let text = firstUser.content.replace(/\n/g, " ").trim();
  // Skip common prefixes
  const prefixes = [
    "请",
    "帮我",
    "你好",
    "我想",
    "请问",
    "能不能",
    "可以",
    "麻烦",
  ];
  for (const p of prefixes) {
    if (text.startsWith(p)) {
      text = text.slice(p.length).trim();
      break;
    }
  }
  if (firstUser.images && firstUser.images.length > 0) {
    text = "[图片] " + text;
  }
  return text.length > 16 ? text.slice(0, 16) + "…" : text || "新会话";
}

/** 异步调用后端生成智能标题 */
async function smartTitle(firstMessage: string): Promise<string | null> {
  try {
    const resp = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `请用6到10个字总结以下问题的核心主题，只输出标题本身，不要加引号、标点和多余解释：${firstMessage}`,
      }),
    });
    const data = await resp.json();
    const title = data.reply?.trim() || "";
    // Clean up: remove quotes, brackets, limit length
    const cleaned = title
      .replace(/[""''「」【】\[\]]/g, "")
      .replace(/[。！？.!?]$/, "")
      .trim();
    if (cleaned.length >= 2 && cleaned.length <= 20) {
      return cleaned;
    }
    return null;
  } catch {
    return null;
  }
}

async function loadSessions(): Promise<ChatSession[]> {
  try {
    const data = await get<ChatSession[]>(STORAGE_KEY);
    if (data && Array.isArray(data)) return data;
  } catch {
    // ignore
  }
  return [];
}

async function saveSessions(sessions: ChatSession[]) {
  try {
    await set(STORAGE_KEY, sessions);
  } catch {
    // ignore (quota exceeded)
  }
}

const defaultMessages: Message[] = [
  {
    role: "bot",
    content:
      "你好！我是 Kimi，有什么可以帮你的吗？可以发送图片让我分析，也可以语音输入。",
    timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
    tokens: 24,
  },
];

export const DEFAULT_MODEL = "kimi-k2.6";
export const DEFAULT_TEMPERATURE = 1.0;
export const DEFAULT_TOP_P = 0.9;
export const DEFAULT_MAX_TOKENS = 8192;
export const MAX_TOKENS_LIMIT = 8192;

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [initialized, setInitialized] = useState(false);
  const generatingRef = useRef<Set<string>>(new Set());

  // Async load from IndexedDB on mount
  useEffect(() => {
    let mounted = true;
    loadSessions().then((loaded) => {
      if (!mounted) return;
      if (loaded.length > 0) {
        setSessions(loaded);
        setActiveId(loaded[0].id);
      } else {
        const id = generateId();
        const session: ChatSession = {
          id,
          title: "新会话",
          messages: [...defaultMessages],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          model: DEFAULT_MODEL,
          temperature: DEFAULT_TEMPERATURE,
          topP: DEFAULT_TOP_P,
          maxTokens: DEFAULT_MAX_TOKENS,
        };
        setSessions([session]);
        setActiveId(id);
        saveSessions([session]);
      }
      setInitialized(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const activeSession = sessions.find((s) => s.id === activeId);
  const messages = activeSession?.messages ?? [...defaultMessages];

  const maybeGenerateTitle = useCallback(
    async (sessionId: string, currentMessages: Message[]) => {
      if (generatingRef.current.has(sessionId)) return;
      const firstUser = currentMessages.find((m) => m.role === "user");
      if (!firstUser) return;

      generatingRef.current.add(sessionId);
      const aiTitle = await smartTitle(firstUser.content);
      const finalTitle = aiTitle || fallbackTitle(currentMessages);

      setSessions((prev) => {
        const target = prev.find((s) => s.id === sessionId);
        if (!target || target.title !== "新会话") return prev;
        const next = prev.map((s) =>
          s.id === sessionId ? { ...s, title: finalTitle } : s
        );
        saveSessions(next);
        return next;
      });
      generatingRef.current.delete(sessionId);
    },
    []
  );

  const updateMessages = useCallback(
    (updater: (prev: Message[]) => Message[]) => {
      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id !== activeId) return s;
          const newMessages = updater(s.messages);
          const needTitle =
            s.title === "新会话" && newMessages.some((m) => m.role === "user");
          if (needTitle && !generatingRef.current.has(s.id)) {
            // Schedule title generation asynchronously
            setTimeout(() => maybeGenerateTitle(s.id, newMessages), 100);
          }
          return {
            ...s,
            messages: newMessages,
            updatedAt: Date.now(),
          };
        });
        saveSessions(next);
        return next;
      });
    },
    [activeId, maybeGenerateTitle]
  );

  const createSession = useCallback(() => {
    const id = generateId();
    const session: ChatSession = {
      id,
      title: "新会话",
      messages: [...defaultMessages],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: DEFAULT_MODEL,
      temperature: DEFAULT_TEMPERATURE,
      topP: DEFAULT_TOP_P,
      maxTokens: DEFAULT_MAX_TOKENS,
    };
    setSessions((prev) => {
      const next = [session, ...prev];
      saveSessions(next);
      return next;
    });
    setActiveId(id);
    return id;
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveId(id);
  }, []);

  const updateSessionParams = useCallback(
    (params: Partial<Pick<ChatSession, "model" | "temperature" | "topP" | "maxTokens">>) => {
      setSessions((prev) => {
        const next = prev.map((s) =>
          s.id === activeId ? { ...s, ...params, updatedAt: Date.now() } : s
        );
        saveSessions(next);
        return next;
      });
    },
    [activeId]
  );

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        let next = prev.filter((s) => s.id !== id);
        if (next.length === 0) {
          const newId = generateId();
          const session: ChatSession = {
            id: newId,
            title: "新会话",
            messages: [...defaultMessages],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            model: DEFAULT_MODEL,
            temperature: DEFAULT_TEMPERATURE,
            topP: DEFAULT_TOP_P,
            maxTokens: DEFAULT_MAX_TOKENS,
          };
          next = [session];
          setActiveId(newId);
        } else if (activeId === id) {
          setActiveId(next[0].id);
        }
        saveSessions(next);
        return next;
      });
    },
    [activeId]
  );

  return {
    sessions,
    activeId,
    messages,
    initialized,
    updateMessages,
    createSession,
    switchSession,
    deleteSession,
    updateSessionParams,
  };
}
