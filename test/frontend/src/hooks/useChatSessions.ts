import { useState, useEffect, useCallback } from "react";

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
}

const STORAGE_KEY = "aiic_chat_sessions";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function makeTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "新会话";
  const text = firstUser.content.replace(/\n/g, " ");
  return text.length > 20 ? text.slice(0, 20) + "…" : text;
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
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

export function useChatSessions() {
  const [sessions, setSessions] = useState<ChatSession[]>(loadSessions);
  const [activeId, setActiveId] = useState<string>("");

  // Initialize active session if empty
  useEffect(() => {
    if (activeId) return;
    const loaded = loadSessions();
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
      };
      setSessions([session]);
      setActiveId(id);
      saveSessions([session]);
    }
  }, [activeId]);

  const activeSession = sessions.find((s) => s.id === activeId);
  const messages = activeSession?.messages ?? [...defaultMessages];

  const updateMessages = useCallback(
    (updater: (prev: Message[]) => Message[]) => {
      setSessions((prev) => {
        const next = prev.map((s) => {
          if (s.id !== activeId) return s;
          const newMessages = updater(s.messages);
          return {
            ...s,
            messages: newMessages,
            title: s.title === "新会话" ? makeTitle(newMessages) : s.title,
            updatedAt: Date.now(),
          };
        });
        saveSessions(next);
        return next;
      });
    },
    [activeId]
  );

  const createSession = useCallback(() => {
    const id = generateId();
    const session: ChatSession = {
      id,
      title: "新会话",
      messages: [...defaultMessages],
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
    updateMessages,
    createSession,
    switchSession,
    deleteSession,
  };
}
