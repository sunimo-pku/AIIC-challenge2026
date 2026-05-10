import { createContext, useContext, useState, useCallback } from "react";

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
}

interface InterviewContextType {
  session: InterviewSession | null;
  setSession: (s: InterviewSession | null) => void;
  advanceStage: (data?: Partial<InterviewSession>) => Promise<void>;
  reset: () => void;
}

const InterviewContext = createContext<InterviewContextType | null>(null);

export function InterviewProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<InterviewSession | null>(null);

  const advanceStage = useCallback(async (data?: Partial<InterviewSession>) => {
    if (!session) return;
    const nextStage = session.current_stage + 1;
    const updated = { ...session, ...data, current_stage: nextStage };
    setSession(updated);
    // Sync to backend
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
        }),
      });
    } catch (e) {
      console.error("Failed to sync stage:", e);
    }
  }, [session]);

  const reset = useCallback(() => setSession(null), []);

  return (
    <InterviewContext.Provider value={{ session, setSession, advanceStage, reset }}>
      {children}
    </InterviewContext.Provider>
  );
}

export function useInterview() {
  const ctx = useContext(InterviewContext);
  if (!ctx) throw new Error("useInterview must be used within InterviewProvider");
  return ctx;
}
