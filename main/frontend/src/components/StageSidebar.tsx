import { useNavigate } from "react-router-dom";
import { useInterview } from "@/contexts/InterviewContext";
import { usePractice } from "@/contexts/PracticeContext";
import { useInterviewMode } from "@/hooks/useInterviewMode";
import { ArrowLeft, Briefcase, FileText, CheckCircle, Lock } from "lucide-react";

const STAGE_NAMES = ["面试攻略", "简历评估", "技术面", "情景面", "总结"];

/**
 * Stage 页面专用 sidebar，**不做编辑操作**——目标 / 场次的编辑都收回到对应 Hub 页面。
 * 这里只展示当前模式的运行时元信息（公司、岗位、简历状态、进度），让面试主流程聚焦。
 */
export function StageSidebar() {
  const navigate = useNavigate();
  const { mode, sessionId, stage } = useInterviewMode();
  const { session } = useInterview();
  const { profile } = usePractice();

  const company = mode === "practice" ? profile.company : session?.company;
  const position = mode === "practice" ? profile.position : session?.position;
  const resumePath =
    mode === "practice" ? profile.resume_file_path : session?.resume_file_path;
  const resumeName = resumePath ? resumePath.split("/").pop() : "";

  const completedStages =
    mode === "simulation"
      ? Object.keys(session?.stage_reviews || {}).length
      : 0;

  const goHub = () => {
    if (mode === "practice") navigate("/interview/practice");
    else if (sessionId) navigate("/interview/mock");
    else navigate("/interview");
  };

  return (
    <aside className="hidden lg:flex w-[220px] shrink-0 border-r border-border flex-col overflow-y-auto p-4 gap-5 bg-bg">
      {/* 模式徽章 + 返回 */}
      <button
        onClick={goHub}
        className="w-full flex items-center justify-between gap-2 px-2 py-1.5 border border-border hover:border-accent transition-colors group"
        aria-label="返回模式入口"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle group-hover:text-accent">
          [ {mode === "practice" ? "PRACTICE" : "MOCK"} ]
        </span>
        <ArrowLeft size={11} className="text-fg-subtle group-hover:text-accent" />
      </button>

      {/* TARGET */}
      <section>
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle mb-2">
          [ TARGET ]
        </div>
        <div className="space-y-1.5">
          <div className="flex items-start gap-1.5 text-[12.5px] text-fg">
            <Briefcase size={11} className="text-fg-subtle shrink-0 mt-0.5" strokeWidth={1.5} />
            <span className="break-all">{company || "—"}</span>
          </div>
          <div className="text-[12px] text-fg-muted pl-4">
            {position || "—"}
          </div>
          <div className="flex items-start gap-1.5 text-[11.5px] text-fg-subtle pt-1.5 border-t border-border mt-2">
            <FileText size={11} className="shrink-0 mt-0.5" strokeWidth={1.5} />
            <span className="break-all">{resumeName || "未上传简历"}</span>
          </div>
        </div>
      </section>

      {/* PROGRESS（仅模拟模式）*/}
      {mode === "simulation" && (
        <section>
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle mb-2 flex items-center justify-between">
            <span>[ PROGRESS ]</span>
            <span>{String(completedStages).padStart(2, "0")} / 05</span>
          </div>
          <ul className="space-y-1">
            {STAGE_NAMES.map((name, i) => {
              const reviewed = !!session?.stage_reviews?.[String(i)];
              const locked = i > completedStages;
              const isCurrent = i === stage;
              return (
                <li
                  key={i}
                  className={`flex items-center gap-2 text-[12px] px-2 py-1 rounded-sm border ${
                    isCurrent
                      ? "border-accent text-accent bg-accent-soft"
                      : locked
                      ? "border-border text-fg-subtle"
                      : "border-border text-fg"
                  }`}
                >
                  <span className="font-mono text-[10.5px] tracking-[0.12em] shrink-0">
                    {String(i).padStart(2, "0")}
                  </span>
                  <span className="flex-1 truncate">{name}</span>
                  {reviewed ? (
                    <CheckCircle size={11} className="text-accent" strokeWidth={1.5} />
                  ) : locked ? (
                    <Lock size={11} className="text-fg-subtle" strokeWidth={1.5} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* 练习模式提示 */}
      {mode === "practice" && (
        <section>
          <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle mb-2">
            [ NOTE ]
          </div>
          <p className="text-[11.5px] text-fg-muted leading-relaxed">
            练习模式下，本关对话不会注入前序面试官的弱点记录。完成后可在底部「留档」按钮保存到练习历史。
          </p>
        </section>
      )}
    </aside>
  );
}
