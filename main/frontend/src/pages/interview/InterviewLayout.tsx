import { useNavigate, useLocation } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { InterviewSidebar } from "@/components/InterviewSidebar";
import { useInterview } from "@/contexts/InterviewContext";

const STAGES = [
  "情报局",
  "简历评估",
  "技术面",
  "情景面",
  "总结",
];

export function InterviewLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { session } = useInterview();

  // 高亮逻辑：优先按 URL 路径中的 stage 数字，fallback 到 session.current_stage
  const stageMatch = location.pathname.match(/\/interview\/stage\/(\d+)/);
  const current = stageMatch ? parseInt(stageMatch[1], 10) : (session?.current_stage ?? 0);

  return (
    <div className="h-screen flex flex-col bg-bg text-fg">
      <TopBar
        center={
          <div className="flex items-center gap-1">
            {STAGES.map((name, i) => (
              <button
                key={name}
                onClick={() => navigate(`/interview/stage/${i}`)}
                className={`px-2 py-0.5 text-[11px] rounded-sm whitespace-nowrap transition-colors ${
                  i === current
                    ? "bg-accent text-bg font-medium"
                    : "text-fg-subtle hover:text-fg hover:bg-elevated"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        }
      />
      <div className="flex-1 flex min-h-0">
        <InterviewSidebar />
        <div className="flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );
}
