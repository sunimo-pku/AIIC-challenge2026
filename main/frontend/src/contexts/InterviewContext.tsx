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

export function InterviewProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);

  const loadSessions = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/interview/sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setSessions(data);
    } catch (e) {
      console.error("Failed to load sessions:", e);
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
        setSession(null);
        return;
      }
      setSession({
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
      });
    } catch (e) {
      console.error("Failed to select session:", e);
    }
  }, []);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const advanceStage = useCallback(async (data?: Partial<InterviewSession>) => {
    if (!session) return;
    const nextStage = session.current_stage + 1;
    const updated = { ...session, ...data, current_stage: nextStage };
    setSession(updated);
    try {
      const token = localStorage.getItem("token");
      await fetch(`/interview/sessions/${session.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stage: nextStage,
          intel_report: updated.intel_report ? JSON.stringify(updated.intel_report) : undefined,
          resume_text: updated.resume_text || undefined,
          resume_tags: updated.resume_tags || undefined,
          resume_risks: updated.resume_risks || undefined,
          target_projects: updated.target_projects || undefined,
          scores: updated.scores ? JSON.stringify(updated.scores) : undefined,
          weaknesses: updated.weaknesses ? JSON.stringify(updated.weaknesses) : undefined,
        }),
      });
    } catch (e) {
      console.error("Failed to sync stage:", e);
    }
  }, [session]);

  const reset = useCallback(() => setSession(null), []);

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
