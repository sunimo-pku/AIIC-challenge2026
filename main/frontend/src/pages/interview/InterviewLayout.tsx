import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { StageSidebar } from "@/components/StageSidebar";
import { useInterview } from "@/contexts/InterviewContext";
import { useInterviewMode } from "@/hooks/useInterviewMode";
import { Lock } from "lucide-react";
import { useToast } from "@/components/ToastProvider";

const STAGES = ["面试攻略", "简历评估", "技术面", "情景面", "总结"];

export function InterviewLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { session, selectSession } = useInterview();
  const { mode, sessionId, stage } = useInterviewMode();
  const toast = useToast();

  // 用户通过书签/直链直接进入 /interview/mock/:id/stage/n 时，
  // 若当前 active session 与 URL sessionId 不一致，自动拉取并切换。
  useEffect(() => {
    if (mode === "simulation" && sessionId && session?.id !== sessionId) {
      selectSession(sessionId).catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, sessionId]);

  const completedStages =
    mode === "simulation" ? Object.keys(session?.stage_reviews || {}).length : 0;
  const maxUnlocked = mode === "simulation" ? Math.min(completedStages, 4) : 4;
  const current = stage;

  const handleNav = (i: number) => {
    if (mode === "practice") {
      navigate(`/interview/practice/stage/${i}`);
    } else if (sessionId) {
      // 模拟模式：未解锁关卡禁止前进
      if (i > maxUnlocked) {
        toast.warning(`需先完成第 ${maxUnlocked + 1} 关「${STAGES[maxUnlocked]}」才能解锁`);
        return;
      }
      navigate(`/interview/mock/${sessionId}/stage/${i}`);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-bg text-fg">
      <TopBar
        center={
          <div className="flex items-center gap-1">
            {/* 模式标签 */}
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-subtle border border-border px-1.5 py-0.5 mr-2">
              [ {mode === "practice" ? "PRACTICE" : "MOCK"} ]
            </span>
            {STAGES.map((name, i) => {
              const isCurrent = i === current;
              const locked = mode === "simulation" && i > maxUnlocked;
              return (
                <button
                  key={name}
                  onClick={() => handleNav(i)}
                  disabled={locked}
                  title={locked ? `需完成第 ${maxUnlocked + 1} 关解锁` : undefined}
                  className={`px-2 py-0.5 text-[11px] rounded-sm whitespace-nowrap transition-colors flex items-center gap-1 ${
                    isCurrent
                      ? "bg-accent text-bg font-medium"
                      : locked
                      ? "text-fg-subtle/50 cursor-not-allowed"
                      : "text-fg-subtle hover:text-fg hover:bg-elevated"
                  }`}
                >
                  {name}
                  {locked && <Lock size={9} strokeWidth={1.5} />}
                </button>
              );
            })}
          </div>
        }
      />
      <div className="flex-1 flex min-h-0">
        <StageSidebar />
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );
}
