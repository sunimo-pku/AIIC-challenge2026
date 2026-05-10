import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { useInterview } from "@/contexts/InterviewContext";
import { RadarChart } from "@/components/RadarChart";
import { ArrowLeft, Trophy, Award, AlertTriangle, ArrowRight, NotebookPen } from "lucide-react";

const STAGE_NAMES = ["面试攻略", "简历评估", "技术面", "情景面", "总结"];

const RECOMMEND_STYLES: Record<string, { label: string; cls: string }> = {
  "强烈推荐": { label: "STRONG HIRE", cls: "text-accent border-accent" },
  "推荐": { label: "HIRE", cls: "text-accent border-accent" },
  "待定": { label: "HOLD", cls: "text-warn border-warn" },
  "不推荐": { label: "NO HIRE", cls: "text-error border-error" },
};

export default function MockReport() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const { session, selectSession } = useInterview();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const id = sessionId ? parseInt(sessionId, 10) : NaN;
      if (Number.isFinite(id)) {
        await selectSession(id);
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col bg-bg text-fg">
        <TopBar />
        <div className="flex-1 flex items-center justify-center text-[12px] font-medium tracking-wide text-fg-subtle">
          LOADING REPORT...
        </div>
      </div>
    );
  }

  if (!session || String(session.id) !== sessionId) {
    return (
      <div className="h-screen flex flex-col bg-bg text-fg">
        <TopBar />
        <div className="flex-1 flex items-center justify-center text-[12px] text-fg-subtle">
          场次不存在或无权访问
        </div>
      </div>
    );
  }

  // 抽取 Stage 4 总结的 final report（在 stage_reviews["4"] 或 scores 中可能存在）
  const stageReviews = session.stage_reviews || {};
  const scoresDict = session.scores || {};
  const stage4Review = stageReviews["4"] || {};
  // Stage 4 prompt 输出字段：overall_score / recommendation / key_strengths / key_gaps / growth_potential / final_advice
  const finalReport = (scoresDict as any).final_summary || stage4Review;

  // 综合评分（取 stage_reviews 各关 overall_score 平均）
  const reviewScores = Object.entries(stageReviews)
    .filter(([k]) => k !== "4")
    .map(([_, r]: [string, any]) => r?.overall_score)
    .filter((v: any) => typeof v === "number");
  const avgScore =
    typeof finalReport.overall_score === "number"
      ? finalReport.overall_score
      : reviewScores.length
      ? Math.round(reviewScores.reduce((a, b) => a + b, 0) / reviewScores.length)
      : null;

  // 雷达图数据：从 session.scores 中抽 10 个维度
  const RADAR_DIMS = [
    "基础知识掌握度",
    "系统设计与架构能力",
    "代码质量与工程素养",
    "项目深度与Ownership",
    "抗压与应变能力",
    "沟通与协作能力",
    "决策与权衡能力",
    "结构化表达",
    "抗压与情绪管理",
    "自我认知与成长",
  ];
  const radarData: Record<string, number> = {};
  RADAR_DIMS.forEach((dim) => {
    const matches = Object.entries(scoresDict)
      .filter(([k, v]) => k.includes(dim) && typeof v === "number")
      .map(([_, v]) => v as number);
    if (matches.length) {
      radarData[dim] = Math.round(matches.reduce((a, b) => a + b, 0) / matches.length);
    }
  });

  const recommendKey = finalReport.recommendation || "";
  const recommendStyle = RECOMMEND_STYLES[recommendKey] || RECOMMEND_STYLES["推荐"];

  const handleTakeNotes = () => {
    const lines: string[] = [];
    lines.push(`# ${session.company} · ${session.position} · 模拟面试复盘`);
    lines.push("");
    if (avgScore !== null) {
      lines.push(`> 综合评分：**${avgScore} / 100**`);
    }
    if (recommendKey) {
      lines.push(`> 录用建议：**${recommendKey}**`);
    }
    if (Array.isArray(finalReport.key_strengths) && finalReport.key_strengths.length) {
      lines.push("");
      lines.push("## 综合评估给出的强项");
      finalReport.key_strengths.slice(0, 5).forEach((s: string) => lines.push(`- ${s}`));
    }
    if (Array.isArray(finalReport.key_gaps) && finalReport.key_gaps.length) {
      lines.push("");
      lines.push("## 综合评估给出的差距");
      finalReport.key_gaps.slice(0, 5).forEach((s: string) => lines.push(`- ${s}`));
    }
    lines.push("");
    lines.push("## 我自己的真实感受");
    lines.push("- ");
    lines.push("");
    lines.push("## 这次最该补的知识点");
    lines.push("- ");
    lines.push("");
    lines.push("## 下一场怎么打");
    lines.push("- ");
    navigate("/journal/new", {
      state: {
        title: `${session.company} · ${session.position} · 模拟复盘`,
        content: lines.join("\n"),
        mode: "simulation",
        stage: null,
        company: session.company,
        position: session.position,
        ref_session_id: session.id,
      },
    });
  };

  return (
    <div className="h-screen flex flex-col bg-bg text-fg">
      <TopBar />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-10 space-y-8">
          <header className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <button
                onClick={() => navigate("/interview/mock")}
                className="inline-flex items-center gap-1 text-[12px] font-medium tracking-wide text-fg-subtle hover:text-accent transition-colors"
              >
                <ArrowLeft size={12} /> MOCK SESSIONS
              </button>
              <h1 className="font-display text-[28px] tracking-[0.04em]">FINAL REPORT</h1>
              <p className="text-[13px] text-fg-muted">
                {session.company} · {session.position}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleTakeNotes}
                className="inline-flex items-center gap-1.5 border border-border text-fg-muted text-[12px] font-medium tracking-wide rounded-lg px-3 py-2 hover:border-accent hover:text-accent transition-colors"
                title="把这场模拟的复盘写下来"
              >
                <NotebookPen size={12} strokeWidth={1.5} /> TAKE NOTES
              </button>
              <div className={`border px-4 py-2 text-[13px] font-medium tracking-wide ${recommendStyle.cls}`}>
                {recommendStyle.label}
              </div>
            </div>
          </header>

          {/* Hero score */}
          <section className="grid gap-6 md:grid-cols-[280px_1fr]">
            <div className="border border-border rounded-md bg-elevated">
              <div className="h-8 px-3 flex items-center justify-between border-b border-border text-[12px] font-medium tracking-wide text-fg-subtle">
                <span>OVERALL</span>
                <span>/ 100</span>
              </div>
              <div className="p-6 flex flex-col items-center gap-2">
                <div className="font-display text-[80px] leading-none tracking-[0.02em] text-accent">
                  {avgScore ?? "—"}
                </div>
                <div className="text-[12px] font-medium tracking-wide text-fg-subtle">
                  AVG · {Object.keys(stageReviews).length} STAGES
                </div>
              </div>
            </div>

            <div className="border border-border rounded-md bg-elevated">
              <div className="h-8 px-3 flex items-center justify-between border-b border-border text-[12px] font-medium tracking-wide text-fg-subtle">
                <span>DIMENSIONAL.RADAR</span>
                <span>[ {String(Object.keys(radarData).length).padStart(2, "0")} DIMS ]</span>
              </div>
              <div className="p-4 flex items-center justify-center min-h-[260px]">
                {Object.keys(radarData).length >= 3 ? (
                  <RadarChart data={radarData} size={260} />
                ) : (
                  <div className="text-[12px] font-medium tracking-wide text-fg-subtle text-center px-4 leading-relaxed">
                    [ 数据不足 ]
                    <br />
                    <span className="normal-case tracking-normal">
                      至少完成 3 项能力评分后即可生成雷达图
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Strengths / Gaps */}
          {(finalReport.key_strengths?.length || finalReport.key_gaps?.length) && (
            <section className="grid gap-6 md:grid-cols-2">
              <div className="border border-border rounded-md bg-elevated">
                <div className="h-8 px-3 flex items-center justify-between border-b border-border text-[12px] font-medium tracking-wide text-fg-subtle">
                  <span>KEY.STRENGTHS</span>
                  <Award size={11} />
                </div>
                <ul className="p-4 space-y-2 text-[13.5px] leading-relaxed">
                  {(finalReport.key_strengths || []).map((s: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-mono text-[11px] text-accent shrink-0 pt-0.5 tracking-[0.12em]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                  {(!finalReport.key_strengths || finalReport.key_strengths.length === 0) && (
                    <li className="text-[12px] text-fg-subtle font-mono">EMPTY</li>
                  )}
                </ul>
              </div>
              <div className="border border-border rounded-md bg-elevated">
                <div className="h-8 px-3 flex items-center justify-between border-b border-border text-[12px] font-medium tracking-wide text-fg-subtle">
                  <span>KEY.GAPS</span>
                  <AlertTriangle size={11} />
                </div>
                <ul className="p-4 space-y-2 text-[13.5px] leading-relaxed">
                  {(finalReport.key_gaps || []).map((s: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <span className="font-mono text-[11px] text-warn shrink-0 pt-0.5 tracking-[0.12em]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                  {(!finalReport.key_gaps || finalReport.key_gaps.length === 0) && (
                    <li className="text-[12px] text-fg-subtle font-mono">EMPTY</li>
                  )}
                </ul>
              </div>
            </section>
          )}

          {/* Final advice */}
          {(finalReport.final_advice || finalReport.growth_potential) && (
            <section className="border border-border rounded-md bg-elevated">
              <div className="h-8 px-3 flex items-center justify-between border-b border-border text-[12px] font-medium tracking-wide text-fg-subtle">
                <span>FINAL.ADVICE</span>
                <Trophy size={11} />
              </div>
              <div className="p-5 space-y-3 text-[14px] leading-relaxed">
                {finalReport.final_advice && (
                  <p className="text-fg">{finalReport.final_advice}</p>
                )}
                {finalReport.growth_potential && (
                  <p className="text-fg-muted text-[13px]">
                    <span className="text-[12px] font-medium tracking-wide text-fg-subtle mr-2">
                      GROWTH.POTENTIAL
                    </span>
                    {finalReport.growth_potential}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* 5 关分别面评摘要 */}
          <section className="space-y-3">
            <h2 className="text-[12px] font-medium tracking-wide text-fg-subtle">
              STAGE.REVIEWS
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {STAGE_NAMES.map((name, i) => {
                const r = stageReviews[String(i)] || null;
                return (
                  <div key={i} className="border border-border rounded-md bg-elevated">
                    <div className="h-8 px-3 flex items-center justify-between border-b border-border text-[12px] font-medium tracking-wide text-fg-subtle">
                      <span>[ STAGE.{String(i + 1).padStart(2, "0")} · {name} ]</span>
                      <span>
                        {r?.overall_score != null ? `${r.overall_score} / 100` : "[ N/A ]"}
                      </span>
                    </div>
                    <div className="p-3 space-y-2 text-[12.5px] leading-relaxed">
                      {!r ? (
                        <div className="font-mono text-[11px] text-fg-subtle">NOT COMPLETED</div>
                      ) : (
                        <>
                          {r.highlights?.length > 0 && (
                            <div>
                              <div className="text-[12px] font-medium tracking-wide text-accent mb-1">
                                亮点
                              </div>
                              <ul className="space-y-0.5 text-fg">
                                {r.highlights.map((h: string, idx: number) => (
                                  <li key={idx}>· {h}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {r.weaknesses?.length > 0 && (
                            <div>
                              <div className="text-[12px] font-medium tracking-wide text-warn mb-1">
                                弱点
                              </div>
                              <ul className="space-y-0.5 text-fg">
                                {r.weaknesses.map((w: string, idx: number) => (
                                  <li key={idx}>· {w}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {r.key_observations && (
                            <p className="text-fg-muted">{r.key_observations}</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="flex items-center justify-end gap-3">
            <button
              onClick={() => navigate("/interview/mock")}
              className="border border-border text-fg-subtle hover:text-accent hover:border-accent transition-colors px-4 py-2 text-[13px] font-medium tracking-wide rounded-lg"
            >
              BACK TO LIST
            </button>
            <button
              onClick={() => navigate("/interview")}
              className="border border-accent text-accent hover:bg-accent hover:text-white transition-colors px-4 py-2 text-[13px] font-medium tracking-wide rounded-lg flex items-center gap-2"
            >
              [ NEW MOCK · 开启新一轮 ] <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
