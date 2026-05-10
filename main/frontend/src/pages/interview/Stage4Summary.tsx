import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "@/contexts/InterviewContext";
import { useInterviewMode } from "@/hooks/useInterviewMode";
import { InterviewLayout } from "./InterviewLayout";
import { useToast } from "@/components/ToastProvider";
import { Loader2, ArrowRight, AlertCircle, CheckCircle, XCircle, MinusCircle, Sparkles } from "lucide-react";
import { loadInterviewSettings } from "@/lib/interviewSettings";

export default function Stage4Summary() {
  const navigate = useNavigate();
  const toast = useToast();
  const { mode, sessionId } = useInterviewMode();
  const { session, setSession } = useInterview();
  const isPractice = mode === "practice";

  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  // Load existing report from session
  useEffect(() => {
    if (session?.stage_reviews?.["4"]) {
      setReport(session.stage_reviews["4"]);
    }
  }, [session?.stage_reviews]);

  const handleGenerate = async () => {
    if (!session || isPractice) return;
    setLoading(true);
    const settings = loadInterviewSettings();
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/interview/final-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          session_id: session.id,
          difficulty: settings.difficulty,
          interviewer_style: settings.style,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error(data.detail || "报告生成失败");
        return;
      }
      setReport(data);
      // Update session
      const newReviews = { ...(session.stage_reviews || {}), "4": data };
      setSession({ ...session, stage_reviews: newReviews });
      toast.success("综合复盘报告已生成");
    } catch (e: any) {
      toast.error(`生成失败：${e?.message || "未知错误"}`);
    } finally {
      setLoading(false);
    }
  };

  const getRecIcon = (rec: string) => {
    if (rec?.includes("强烈推荐")) return <CheckCircle size={16} className="text-accent" />;
    if (rec?.includes("推荐")) return <CheckCircle size={16} className="text-accent/80" />;
    if (rec?.includes("待定")) return <MinusCircle size={16} className="text-warning" />;
    return <XCircle size={16} className="text-error" />;
  };

  const getRecColor = (rec: string) => {
    if (rec?.includes("强烈推荐")) return "text-accent";
    if (rec?.includes("推荐")) return "text-accent/80";
    if (rec?.includes("待定")) return "text-warning";
    return "text-error";
  };

  if (isPractice) {
    return (
      <InterviewLayout>
        <div className="h-full flex items-center justify-center p-6">
          <div className="text-center max-w-sm space-y-4">
            <AlertCircle size={32} className="text-fg-subtle mx-auto" strokeWidth={1.5} />
            <p className="text-[14px] text-fg">练习模式不生成综合复盘报告</p>
            <p className="text-[12px] text-fg-subtle leading-relaxed">
              练习模式每关独立、互不关联。如需跨关综合评估，请用「模拟模式」跑一整轮。
            </p>
            <button
              onClick={() => navigate("/interview/practice/stage/3")}
              className="inline-flex items-center gap-1 border border-accent text-accent font-mono text-[12px] uppercase tracking-[0.12em] rounded-sm px-4 py-2 hover:bg-accent hover:text-bg transition-colors"
            >
              返回情景面 <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </InterviewLayout>
    );
  }

  if (!session || session.id !== sessionId) {
    return (
      <InterviewLayout>
        <div className="h-full flex items-center justify-center p-6">
          <div className="text-center max-w-sm space-y-4">
            <AlertCircle size={32} className="text-fg-subtle mx-auto" strokeWidth={1.5} />
            <p className="text-[14px] text-fg">场次加载失败</p>
          </div>
        </div>
      </InterviewLayout>
    );
  }

  return (
    <InterviewLayout>
      <div className="h-full overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-[16px] font-medium text-fg">综合复盘报告</h1>
              <p className="text-[12px] text-fg-subtle">
                {session.company} · {session.position}
              </p>
            </div>
            {!report && (
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="inline-flex items-center gap-2 border border-accent bg-accent text-bg font-mono text-[12px] uppercase tracking-[0.12em] rounded-sm px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {loading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                生成综合报告
              </button>
            )}
          </div>

          {!report && !loading && (
            <div className="border border-dashed border-border rounded-sm p-8 text-center space-y-3">
              <Sparkles size={28} className="text-fg-subtle mx-auto" strokeWidth={1.5} />
              <p className="text-[13px] text-fg-muted">
                完成技术面与情景面后，点击上方按钮生成综合复盘报告。
              </p>
              <p className="text-[11px] text-fg-subtle font-mono">
                综合「技术深度」与「情景表达」两条主线，给出整体评价与改进建议
              </p>
            </div>
          )}

          {loading && (
            <div className="border border-border rounded-sm p-8 text-center space-y-3">
              <Loader2 size={28} className="text-accent mx-auto animate-spin" />
              <p className="text-[13px] text-fg-muted">正在生成你的综合复盘，请稍候…</p>
            </div>
          )}

          {report && (
            <>
              {/* Overall */}
              <div className="border border-border bg-elevated rounded-sm p-5 space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h2 className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted">总体评价</h2>
                  <div className="flex items-center gap-1.5">
                    {getRecIcon(report.overall_recommendation)}
                    <span className={`text-[13px] font-medium ${getRecColor(report.overall_recommendation)}`}>
                      {report.overall_recommendation || "暂无"}
                    </span>
                  </div>
                </div>
                {report.overall_score !== undefined && (
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-fg-subtle">综合评分</span>
                    <span className="text-[24px] font-mono font-bold text-fg">{report.overall_score}</span>
                    <span className="text-[12px] text-fg-subtle">/ 100</span>
                  </div>
                )}
                {report.key_observations && (
                  <p className="text-[13px] text-fg leading-relaxed">{report.key_observations}</p>
                )}
              </div>

              {/* Technical Assessment */}
              {report.technical_assessment && (
                <div className="border border-border bg-elevated rounded-sm p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted">技术面评估</h2>
                    {report.technical_assessment.score !== undefined && (
                      <span className="text-[14px] font-mono font-bold text-fg">{report.technical_assessment.score}/100</span>
                    )}
                  </div>
                  {report.technical_assessment.strengths?.length > 0 && (
                    <div>
                      <div className="text-[11px] text-fg-muted uppercase tracking-[0.12em] font-mono mb-1.5">优势</div>
                      <ul className="space-y-1">
                        {report.technical_assessment.strengths.map((s: string, i: number) => (
                          <li key={i} className="text-[12px] text-accent flex items-start gap-1.5">
                            <span>+</span><span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {report.technical_assessment.weaknesses?.length > 0 && (
                    <div>
                      <div className="text-[11px] text-fg-muted uppercase tracking-[0.12em] font-mono mb-1.5">薄弱点</div>
                      <ul className="space-y-1">
                        {report.technical_assessment.weaknesses.map((w: string, i: number) => (
                          <li key={i} className="text-[12px] text-error flex items-start gap-1.5">
                            <span>−</span><span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Expression Assessment */}
              {report.expression_assessment && (
                <div className="border border-border bg-elevated rounded-sm p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted">表达面评估</h2>
                    {report.expression_assessment.score !== undefined && (
                      <span className="text-[14px] font-mono font-bold text-fg">{report.expression_assessment.score}/100</span>
                    )}
                  </div>
                  {report.expression_assessment.strengths?.length > 0 && (
                    <div>
                      <div className="text-[11px] text-fg-muted uppercase tracking-[0.12em] font-mono mb-1.5">优势</div>
                      <ul className="space-y-1">
                        {report.expression_assessment.strengths.map((s: string, i: number) => (
                          <li key={i} className="text-[12px] text-accent flex items-start gap-1.5">
                            <span>+</span><span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {report.expression_assessment.weaknesses?.length > 0 && (
                    <div>
                      <div className="text-[11px] text-fg-muted uppercase tracking-[0.12em] font-mono mb-1.5">薄弱点</div>
                      <ul className="space-y-1">
                        {report.expression_assessment.weaknesses.map((w: string, i: number) => (
                          <li key={i} className="text-[12px] text-error flex items-start gap-1.5">
                            <span>−</span><span>{w}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Action Items */}
              {report.action_items?.length > 0 && (
                <div className="border border-border bg-elevated rounded-sm p-5 space-y-3">
                  <h2 className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted">改进建议</h2>
                  <ol className="space-y-2">
                    {report.action_items.map((item: string, i: number) => (
                      <li key={i} className="text-[12px] text-fg leading-relaxed flex items-start gap-2">
                        <span className="font-mono text-fg-subtle shrink-0">{String(i + 1).padStart(2, "0")}</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Critical Moments */}
              {report.critical_moments?.length > 0 && (
                <div className="border border-border bg-elevated rounded-sm p-5 space-y-3">
                  <h2 className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted">关键时刻</h2>
                  <ul className="space-y-1.5">
                    {report.critical_moments.map((m: string, i: number) => (
                      <li key={i} className="text-[11px] text-fg-subtle flex items-start gap-1.5">
                        <span>•</span><span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </InterviewLayout>
  );
}
