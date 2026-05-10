import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "@/contexts/InterviewContext";
import { useToast } from "@/components/ToastProvider";
import { InterviewLayout } from "./InterviewLayout";
import { RadarChart } from "@/components/RadarChart";
import { Send, ArrowRight, Loader2, AlertCircle, CheckCircle, Flag } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { readSseStream } from "@/lib/sse";

interface TemplateBProps {
  stage: number;
  title: string;
  subtitle: string;
  showRadar: boolean;
  showCodeInput: boolean;
  showScenario: boolean;
  scenarioText?: string;
}

export default function TemplateB({ stage, title, subtitle, showRadar, showCodeInput, showScenario, scenarioText }: TemplateBProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { session, setSession } = useInterview();
  const [messages, setMessages] = useState<any[]>(session?.stage_histories?.[String(stage)] || []);
  const [input, setInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [scores, setScores] = useState<Record<string, number>>(session?.scores || {});
  const [generatingReview, setGeneratingReview] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const currentReview = session?.stage_reviews?.[String(stage)];
  const hasMessages = messages.length > 0;

  // session 切换时同步消息历史
  useEffect(() => {
    setMessages(session?.stage_histories?.[String(stage)] || []);
  }, [session?.id, stage]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSend = async (text: string) => {
    if (!text.trim() || streaming || !session) return;
    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setCodeInput("");
    setStreaming(true);
    setStreamingText("");

    try {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const token = localStorage.getItem("token");
      const resp = await fetch("/interview/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: session.id,
          stage,
          message: text,
          history: newMessages.slice(0, -1),
          model: "kimi-k2.6",
        }),
        signal: abortRef.current.signal,
      });

      let assistantText = "";
      await readSseStream(resp, {
        signal: abortRef.current.signal,
        onDelta: (d) => {
          assistantText += d;
          setStreamingText((prev) => prev + d);
        },
        onError: (msg) => toast.error(`对话失败：${msg}`),
      });

      const updatedMessages = [...newMessages, { role: "assistant", content: assistantText }];
      setMessages(updatedMessages);
      setStreamingText("");

      // 提取 JSON 评分块（适配不同 stage 的评分维度）
      let newScores = { ...(session.scores || {}) };
      try {
        const jsonBlocks = [...assistantText.matchAll(/```json\s*([\s\S]*?)\s*```/g)];
        for (const block of jsonBlocks) {
          const parsed = JSON.parse(block[1]);
          const radarData: Record<string, number> = {};
          // Stage 2 技术面维度
          if (parsed["基础知识掌握度"] !== undefined) {
            newScores[`stage_${stage}_基础知识掌握度`] = parsed["基础知识掌握度"];
            newScores[`stage_${stage}_系统设计与架构能力`] = parsed["系统设计与架构能力"];
            newScores[`stage_${stage}_代码质量与工程素养`] = parsed["代码质量与工程素养"];
            newScores[`stage_${stage}_项目深度与Ownership`] = parsed["项目深度与Ownership"];
            newScores[`stage_${stage}_抗压与应变能力`] = parsed["抗压与应变能力"];
            radarData["基础知识"] = parsed["基础知识掌握度"];
            radarData["系统设计"] = parsed["系统设计与架构能力"];
            radarData["代码质量"] = parsed["代码质量与工程素养"];
            radarData["项目深度"] = parsed["项目深度与Ownership"];
            radarData["抗压能力"] = parsed["抗压与应变能力"];
          }
          // Stage 3 情景面维度
          if (parsed["沟通与协作能力"] !== undefined) {
            newScores[`stage_${stage}_沟通与协作能力`] = parsed["沟通与协作能力"];
            newScores[`stage_${stage}_决策与权衡能力`] = parsed["决策与权衡能力"];
            newScores[`stage_${stage}_结构化表达`] = parsed["结构化表达"];
            newScores[`stage_${stage}_抗压与情绪管理`] = parsed["抗压与情绪管理"];
            newScores[`stage_${stage}_自我认知与成长`] = parsed["自我认知与成长"];
            radarData["沟通协作"] = parsed["沟通与协作能力"];
            radarData["决策权衡"] = parsed["决策与权衡能力"];
            radarData["结构化表达"] = parsed["结构化表达"];
            radarData["抗压情绪"] = parsed["抗压与情绪管理"];
            radarData["自我认知"] = parsed["自我认知与成长"];
          }
          // Stage 4 总结
          if (parsed["overall_score"] !== undefined) {
            newScores[`stage_${stage}_overall_score`] = parsed["overall_score"];
            radarData["总体评分"] = parsed["overall_score"];
          }
          if (Object.keys(radarData).length > 0) {
            setScores(radarData);
          }
        }
      } catch {}

      const newStageHistories = { ...(session.stage_histories || {}), [String(stage)]: updatedMessages };
      setSession({
        ...session,
        scores: newScores,
        stage_histories: newStageHistories,
      });
      const token2 = localStorage.getItem("token");
      fetch(`/interview/sessions/${session.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token2}`,
        },
        body: JSON.stringify({
          scores: newScores,
          stage_histories: newStageHistories,
        }),
      }).catch(console.error);
    } catch (e: any) {
      toast.error(`请求异常：${e?.message || "未知错误"}`);
    } finally {
      setStreaming(false);
      setStreamingText("");
    }
  };

  const handleEndRound = async () => {
    if (!session || !hasMessages || generatingReview) return;
    setGeneratingReview(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/interview/stage-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: session.id, stage }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        toast.error(data.detail || "面评报告生成失败");
        return;
      }
      const newReviews = { ...(session.stage_reviews || {}), [String(stage)]: data };
      setSession({ ...session, stage_reviews: newReviews });
      toast.success("面评报告已生成");
    } catch (e: any) {
      toast.error(`生成失败：${e?.message || "未知错误"}`);
    } finally {
      setGeneratingReview(false);
    }
  };

  if (!session) {
    return (
      <InterviewLayout>
        <div className="h-full flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-sm">
            <AlertCircle size={32} className="text-fg-subtle mx-auto" strokeWidth={1.5} />
            <p className="text-[14px] text-fg">请先完成面试设置</p>
            <button
              onClick={() => navigate("/interview")}
              className="inline-flex items-center gap-1 border border-accent text-accent font-mono text-[12px] uppercase tracking-[0.12em] rounded-sm px-4 py-2 hover:bg-accent hover:text-bg transition-colors"
            >
              去设置 <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </InterviewLayout>
    );
  }

  return (
    <InterviewLayout>
      <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_360px]">
        {/* Left: Chat */}
        <section className="flex flex-col min-h-0 border-r border-border">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-medium text-fg">{title}</h2>
              <p className="text-[12px] text-fg-subtle">{subtitle}</p>
            </div>
            {hasMessages && !streaming && (
              <button
                onClick={handleEndRound}
                disabled={generatingReview}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-accent text-accent text-[11px] hover:bg-accent hover:text-bg transition-colors disabled:opacity-40"
              >
                {generatingReview ? <Loader2 size={12} className="animate-spin" /> : <Flag size={12} />}
                {currentReview ? "重新生成面评" : "结束本轮"}
              </button>
            )}
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !streaming && (
              <div className="text-center text-fg-subtle text-[12px] py-12">
                {showScenario ? scenarioText : "面试官已就位，请开始对话"}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 text-[13px] leading-relaxed ${
                  m.role === "user" ? "bg-accent text-bg rounded-sm" : "bg-elevated border border-border rounded-sm"
                }`}>
                  {m.role === "assistant" ? <MarkdownRenderer content={m.content} /> : <div className="whitespace-pre-wrap">{m.content}</div>}
                </div>
              </div>
            ))}
            {streaming && (
              <div className="flex justify-start">
                <div className="max-w-[80%] bg-elevated border border-border rounded-sm px-3 py-2 text-[13px] leading-relaxed">
                  {streamingText
                    ? <MarkdownRenderer content={streamingText} />
                    : <Loader2 size={14} className="animate-spin text-fg-subtle" />}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border space-y-2">
            {showCodeInput && (
              <textarea value={codeInput} onChange={(e) => setCodeInput(e.target.value)}
                className="w-full bg-overlay border border-border rounded-sm px-3 py-2 text-[12px] font-mono outline-none focus:border-accent resize-none h-20"
                placeholder="粘贴代码片段（可选）…" />
            )}
            <div className="flex gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend(input)}
                className="flex-1 bg-overlay border border-border rounded-sm px-3 py-2 text-[14px] outline-none focus:border-accent"
                placeholder="输入回答…" />
              <button onClick={() => handleSend(codeInput ? `[代码]\n${codeInput}\n\n${input}` : input)}
                disabled={streaming}
                className="h-9 px-3 flex items-center justify-center border border-accent text-accent rounded-sm hover:bg-accent hover:text-bg transition-colors disabled:opacity-40">
                <Send size={14} />
              </button>
            </div>
          </div>
        </section>

        {/* Right: Panel */}
        <section className="flex flex-col min-h-0 overflow-y-auto p-4 gap-4">
          {showScenario && scenarioText && (
            <div className="border border-border bg-elevated rounded-sm p-4">
              <h3 className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted mb-2">场景设定</h3>
              <p className="text-[13px] text-fg leading-relaxed whitespace-pre-wrap">{scenarioText}</p>
            </div>
          )}

          {/* Stage Review */}
          {currentReview ? (
            <div className="border border-border bg-elevated rounded-sm p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-accent" />
                <h3 className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted">面评报告</h3>
              </div>
              {currentReview.overall_score !== undefined && (
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-fg-subtle">总体评分</span>
                  <span className="text-fg font-mono text-[14px] font-bold">{currentReview.overall_score}/100</span>
                </div>
              )}
              {currentReview.weaknesses?.length > 0 && (
                <div>
                  <div className="text-[11px] text-fg-muted uppercase tracking-[0.12em] font-mono mb-1">弱点</div>
                  <ul className="space-y-1">
                    {currentReview.weaknesses.map((w: string, i: number) => (
                      <li key={i} className="text-[12px] text-error flex items-start gap-1.5">
                        <span>•</span><span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {currentReview.highlights?.length > 0 && (
                <div>
                  <div className="text-[11px] text-fg-muted uppercase tracking-[0.12em] font-mono mb-1">亮点</div>
                  <ul className="space-y-1">
                    {currentReview.highlights.map((h: string, i: number) => (
                      <li key={i} className="text-[12px] text-accent flex items-start gap-1.5">
                        <span>•</span><span>{h}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {currentReview.key_observations && (
                <div>
                  <div className="text-[11px] text-fg-muted uppercase tracking-[0.12em] font-mono mb-1">关键观察</div>
                  <p className="text-[12px] text-fg leading-relaxed">{currentReview.key_observations}</p>
                </div>
              )}
              {currentReview.critical_moments?.length > 0 && (
                <div>
                  <div className="text-[11px] text-fg-muted uppercase tracking-[0.12em] font-mono mb-1">关键对话</div>
                  <ul className="space-y-1">
                    {currentReview.critical_moments.map((m: string, i: number) => (
                      <li key={i} className="text-[11px] text-fg-subtle flex items-start gap-1.5">
                        <span>•</span><span>{m}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-border rounded-sm p-4 text-[12px] text-fg-subtle">
              {hasMessages
                ? "对话结束后点击左上角「结束本轮」生成面评报告"
                : "开始对话后，可在此生成结构化面评报告"}
            </div>
          )}

          {/* Radar Chart */}
          {showRadar && Object.keys(scores).length > 0 && (
            <div className="border border-border bg-elevated rounded-sm p-4">
              <h3 className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted mb-2">能力评估</h3>
              <RadarChart data={scores} size={220} />
              <div className="mt-3 space-y-1">
                {Object.entries(scores).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-[12px]">
                    <span className="text-fg-subtle">{k}</span>
                    <span className="text-fg font-mono">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </InterviewLayout>
  );
}
