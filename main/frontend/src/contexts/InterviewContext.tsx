import { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface InterviewSession {
  id: number;
  company: string;
  position: string;
  current_stage: number;
  intel_report: Record<string, any>;
  resume_text: string;
  resume_tags: string[];
  resume_risks: string[];
  target_projects: string[];
  stage_histories: Record<string, any[]>;
  scores: Record<string, number>;
  weaknesses: Record<string, string[]>;
  stage_reviews: Record<string, any>;
  // 各关"非对话型结构化产出"——例如 stage 1 简历评估输出的修改建议卡片 + 原始 JSON。
  // 目的是让用户切走再回来时，整页内容（含次要面板）完整还原，不会"少了一段"。
  stage_artifacts: Record<string, any>;
  resume_file_path: string;
}

interface InterviewContextType {
  session: InterviewSession | null;
  sessions: InterviewSession[];
  setSession: (s: InterviewSession | null) => void;
  loadSessions: () => Promise<void>;
  selectSession: (id: number) => Promise<void>;
  advanceStage: (data?: Partial<InterviewSession>) => Promise<void>;
  reset: () => void;
}

const InterviewContext = createContext<InterviewContextType | null>(null);

const SESSION_ID_KEY = "mockmate_active_session_id";

export function InterviewProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<InterviewSession | null>(null);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);

  const loadSessions = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/interview/sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setSessions(data);
      return data;
    } catch (e) {
      console.error("Failed to load sessions:", e);
      return [];
    }
  }, []);

  const selectSession = useCallback(async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`/interview/sessions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (data.error) {
        setSessionState(null);
        localStorage.removeItem(SESSION_ID_KEY);
        return;
      }
      const s: InterviewSession = {
        id: data.id,
        company: data.company,
        position: data.position,
        current_stage: data.current_stage,
        intel_report: data.intel_report || {},
        resume_text: data.resume_text || "",
        resume_tags: data.resume_tags || [],
        resume_risks: data.resume_risks || [],
        target_projects: data.target_projects || [],
        stage_histories: data.stage_histories || {},
        scores: data.scores || {},
        weaknesses: data.weaknesses || {},
        stage_reviews: data.stage_reviews || {},
        stage_artifacts: data.stage_artifacts || {},
        resume_file_path: data.resume_file_path || "",
      };
      setSessionState(s);
      localStorage.setItem(SESSION_ID_KEY, String(id));
    } catch (e) {
      console.error("Failed to select session:", e);
    }
  }, []);

  const setSession = useCallback((s: InterviewSession | null) => {
    setSessionState(s);
    if (s) {
      localStorage.setItem(SESSION_ID_KEY, String(s.id));
    } else {
      localStorage.removeItem(SESSION_ID_KEY);
    }
  }, []);

  // Load sessions on mount, then restore last active session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await loadSessions();
      if (cancelled) return;
      const savedId = localStorage.getItem(SESSION_ID_KEY);
      if (savedId) {
        const id = parseInt(savedId, 10);
        if (all.find((s: any) => s.id === id)) {
          await selectSession(id);
        }
      } else if (all.length > 0) {
        await selectSession(all[0].id);
      }
    })();
    return () => { cancelled = true; };
  }, [loadSessions, selectSession]);

  const advanceStage = useCallback(async (data?: Partial<InterviewSession>) => {
    if (!session) return;
    const nextStage = session.current_stage + 1;
    const updated = { ...session, ...data, current_stage: nextStage };
    setSessionState(updated);
    try {
      const token = localStorage.getItem("token");
      // 后端 `UpdateStageReq` 里 scores / weaknesses / stage_reviews / target_projects /
      // resume_tags / resume_risks 都是 dict / list 类型，必须直接以对象字面量发送；
      // 之前误用 JSON.stringify 把 dict 序列化成了字符串，Pydantic 直接 422。
      // intel_report 在后端是 Optional[str]，沿用 stringify 可保留它的 raw markdown 维度。
      const payload: Record<string, unknown> = {
        stage: nextStage,
      };
      if (updated.intel_report !== undefined) {
        payload.intel_report =
          typeof updated.intel_report === "string"
            ? updated.intel_report
            : JSON.stringify(updated.intel_report);
      }
      if (updated.resume_text !== undefined) payload.resume_text = updated.resume_text;
      if (updated.resume_tags !== undefined) payload.resume_tags = updated.resume_tags;
      if (updated.resume_risks !== undefined) payload.resume_risks = updated.resume_risks;
      if (updated.target_projects !== undefined) payload.target_projects = updated.target_projects;
      if (updated.scores !== undefined) payload.scores = updated.scores;
      if (updated.weaknesses !== undefined) payload.weaknesses = updated.weaknesses;
      if (updated.stage_reviews !== undefined) payload.stage_reviews = updated.stage_reviews;
      if (updated.stage_artifacts !== undefined) payload.stage_artifacts = updated.stage_artifacts;
      if (updated.resume_file_path !== undefined) payload.resume_file_path = updated.resume_file_path;

      await fetch(`/interview/sessions/${session.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error("Failed to sync stage:", e);
    }
  }, [session]);

  const reset = useCallback(() => {
    setSessionState(null);
    localStorage.removeItem(SESSION_ID_KEY);
  }, []);

  return (
    <InterviewContext.Provider value={{ session, sessions, setSession, loadSessions, selectSession, advanceStage, reset }}>
      {children}
    </InterviewContext.Provider>
  );
}

export function useInterview() {
  const ctx = useContext(InterviewContext);
  if (!ctx) throw new Error("useInterview must be used within InterviewProvider");
  return ctx;
}
