import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "@/contexts/InterviewContext";
import { usePractice } from "@/contexts/PracticeContext";
import { useInterviewMode } from "@/hooks/useInterviewMode";
import { useToast } from "@/components/ToastProvider";
import { InterviewLayout } from "./InterviewLayout";
import { RadarChart } from "@/components/RadarChart";
import { Send, ArrowRight, Loader2, AlertCircle, CheckCircle, Flag, Save, RotateCcw, Play, History, Eye, X, Mic, MicOff } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { readSseStream } from "@/lib/sse";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";

interface TemplateBProps {
  stage: number;
  title: string;
  subtitle: string;
  showRadar: boolean;
  showCodeInput: boolean;
  showScenario: boolean;
  scenarioText?: string;
  voiceMode?: boolean;
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  audio_meta?: { duration: number; word_count: number };
}

function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function TemplateB({ stage, title, subtitle, showRadar, showCodeInput, showScenario, scenarioText, voiceMode }: TemplateBProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const { mode, sessionId } = useInterviewMode();
  const { session, setSession } = useInterview();
  const { profile } = usePractice();

  // 数据源
  const isPractice = mode === "practice";
  const company = isPractice ? profile.company : session?.company;
  const position = isPractice ? profile.position : session?.position;
  const ready = isPractice
    ? !!company && !!position
    : !!session && session?.id === sessionId;

  // 消息状态：simulation 从 session 同步；practice 本地内存
  const [messages, setMessages] = useState<Msg[]>(
    isPractice ? [] : (session?.stage_histories?.[String(stage)] || [])
  );
  const [input, setInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [scores, setScores] = useState<Record<string, number>>(
    isPractice ? {} : (session?.scores || {})
  );
  const [generatingReview, setGeneratingReview] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [logSaved, setLogSaved] = useState(false);
  const [practiceReview, setPracticeReview] = useState<any>(null);
  const [history, setHistory] = useState<Array<{ id: number; msg_count: number; ended_at: string | null; company: string; position: string }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [reviewingLogId, setReviewingLogId] = useState<number | null>(null);
  const [asrLoading, setAsrLoading] = useState(false);
  const [lastAudioDuration, setLastAudioDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const currentReview = isPractice ? practiceReview : session?.stage_reviews?.[String(stage)];
  const hasMessages = messages.length > 0;

  // 模式/关卡切换时重置消息
  useEffect(() => {
    if (isPractice) {
      setMessages([]);
      setScores({});
      setLogSaved(false);
      setReviewingLogId(null);
    } else {
      setMessages(session?.stage_histories?.[String(stage)] || []);
      setScores(session?.scores || {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPractice, session?.id, stage]);

  // 练习模式：拉取当前关卡的历史 log 列表
  const loadHistory = async () => {
    if (!isPractice) return;
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`/practice/logs?stage=${stage}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setHistory(data);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (isPractice) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPractice, stage, logSaved]);

  const handleViewLog = async (logId: number) => {
    if (streaming) return;
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`/practice/logs/${logId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setMessages(data.messages || []);
        setReviewingLogId(logId);
        setScores({});
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleExitReview = () => {
    setMessages([]);
    setReviewingLogId(null);
    setScores({});
  };

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingText]);

  // Voice input: record → ASR → send
  const handleVoiceComplete = async (base64Wav: string) => {
    setAsrLoading(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/asr", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audio: base64Wav, format: "wav" }),
      });
      const data = await resp.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        const wordCount = data.text?.length || 0;
        const utterances = data.utterances || [];
        const avgSpeechRate = utterances.length > 0
          ? Math.round(utterances.reduce((sum: number, u: any) => sum + (u.speech_rate || 0), 0) / utterances.length * 10) / 10
          : 0;
        const avgVolume = utterances.length > 0
          ? Math.round(utterances.reduce((sum: number, u: any) => sum + (u.volume || 0), 0) / utterances.length)
          : 0;
        const emotions = utterances.map((u: any) => u.emotion).filter(Boolean);
        const dominantEmotion = emotions.length > 0
          ? emotions.sort((a: string, b: string) => emotions.filter((e: string) => e === a).length - emotions.filter((e: string) => e === b).length).pop()
          : "";
        await handleSend(data.text, {
          duration: lastAudioDuration,
          word_count: wordCount,
          utterances: utterances.map((u: any) => ({
            text: u.text,
            emotion: u.emotion,
            speech_rate: u.speech_rate,
            volume: u.volume,
          })),
          avg_speech_rate: avgSpeechRate,
          avg_volume: avgVolume,
          dominant_emotion: dominantEmotion,
        });
      }
    } catch (e: any) {
      toast.error(`语音识别失败: ${e?.message || "未知错误"}`);
    } finally {
      setAsrLoading(false);
      setLastAudioDuration(0);
    }
  };

  const voice = useVoiceRecorder(handleVoiceComplete);

  // TTS: play assistant reply automatically in voice mode
  const playTts = async (text: string) => {
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: text.slice(0, 800), speaker: "zh_female_qingchezizi_moon_bigtts" }),
      });
      const data = await resp.json();
      if (data.audio_base64) {
        const url = `data:audio/mp3;base64,${data.audio_base64}`;
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play().catch(() => {});
        }
      }
    } catch (e) {
      console.error("TTS failed:", e);
    }
  };

  const handleSend = async (text: string, audioMeta?: {
    duration: number;
    word_count: number;
    utterances?: Array<{ text: string; emotion: string; speech_rate: number; volume: number }>;
    avg_speech_rate?: number;
    avg_volume?: number;
    dominant_emotion?: string;
  }) => {
    if (!text.trim() || streaming || !ready || reviewingLogId) return;
    const userMsg: Msg = { role: "user", content: text, ...(audioMeta ? { audio_meta: audioMeta } : {}) };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setCodeInput("");
    setStreaming(true);
    setStreamingText("");
    setLogSaved(false);

    try {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const token = localStorage.getItem("token");
      const endpoint = isPractice ? "/practice/chat" : "/interview/chat";
      const baseBody = isPractice
        ? { stage, message: text, history: newMessages.slice(0, -1), model: "kimi-k2.6" }
        : { session_id: session!.id, stage, message: text, history: newMessages.slice(0, -1), model: "kimi-k2.6" };
      const body = audioMeta ? { ...baseBody, audio_meta: audioMeta } : baseBody;
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
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

      const updatedMessages: Msg[] = [...newMessages, { role: "assistant", content: assistantText }];
      setMessages(updatedMessages);
      setStreamingText("");

      // Auto-play TTS in voice mode
      if (voiceMode && assistantText) {
        playTts(assistantText);
      }

      // 解析 JSON 评分块（共用逻辑，practice/simulation 都需要展示雷达）
      const baseScores = isPractice ? scores : (session?.scores || {});
      const newScores: Record<string, number> = { ...baseScores };
      const radarLocal: Record<string, number> = isPractice ? {} : { ...scores };
      try {
        const jsonBlocks = [...assistantText.matchAll(/```json\s*([\s\S]*?)\s*```/g)];
        for (const block of jsonBlocks) {
          const parsed = JSON.parse(block[1]);
          if (parsed["基础知识掌握度"] !== undefined) {
            newScores[`stage_${stage}_基础知识掌握度`] = parsed["基础知识掌握度"];
            newScores[`stage_${stage}_系统设计与架构能力`] = parsed["系统设计与架构能力"];
            newScores[`stage_${stage}_代码质量与工程素养`] = parsed["代码质量与工程素养"];
            newScores[`stage_${stage}_项目深度与Ownership`] = parsed["项目深度与Ownership"];
            newScores[`stage_${stage}_抗压与应变能力`] = parsed["抗压与应变能力"];
            radarLocal["基础知识"] = parsed["基础知识掌握度"];
            radarLocal["系统设计"] = parsed["系统设计与架构能力"];
            radarLocal["代码质量"] = parsed["代码质量与工程素养"];
            radarLocal["项目深度"] = parsed["项目深度与Ownership"];
            radarLocal["抗压能力"] = parsed["抗压与应变能力"];
          }
          if (parsed["沟通与协作能力"] !== undefined) {
            newScores[`stage_${stage}_沟通与协作能力`] = parsed["沟通与协作能力"];
            newScores[`stage_${stage}_决策与权衡能力`] = parsed["决策与权衡能力"];
            newScores[`stage_${stage}_结构化表达`] = parsed["结构化表达"];
            newScores[`stage_${stage}_抗压与情绪管理`] = parsed["抗压与情绪管理"];
            newScores[`stage_${stage}_自我认知与成长`] = parsed["自我认知与成长"];
            radarLocal["沟通协作"] = parsed["沟通与协作能力"];
            radarLocal["决策权衡"] = parsed["决策与权衡能力"];
            radarLocal["结构化表达"] = parsed["结构化表达"];
            radarLocal["抗压情绪"] = parsed["抗压与情绪管理"];
            radarLocal["自我认知"] = parsed["自我认知与成长"];
          }
          if (parsed["表达流畅度"] !== undefined) {
            newScores[`stage_${stage}_表达流畅度`] = parsed["表达流畅度"];
            newScores[`stage_${stage}_结构化表达`] = parsed["结构化表达"];
            newScores[`stage_${stage}_语言得体性`] = parsed["语言得体性"];
            newScores[`stage_${stage}_情绪稳定性`] = parsed["情绪稳定性"];
            newScores[`stage_${stage}_语速控制`] = parsed["语速控制"];
            radarLocal["表达流畅"] = parsed["表达流畅度"];
            radarLocal["结构化"] = parsed["结构化表达"];
            radarLocal["得体性"] = parsed["语言得体性"];
            radarLocal["情绪稳定"] = parsed["情绪稳定性"];
            radarLocal["语速控制"] = parsed["语速控制"];
          }
          if (parsed["overall_score"] !== undefined) {
            newScores[`stage_${stage}_overall_score`] = parsed["overall_score"];
            radarLocal["总体评分"] = parsed["overall_score"];
          }
        }
        if (Object.keys(radarLocal).length > 0) {
          setScores(radarLocal);
        }
      } catch {}

      // 持久化：仅 simulation 模式写回 session
      if (!isPractice && session) {
        const newStageHistories = { ...(session.stage_histories || {}), [String(stage)]: updatedMessages };
        setSession({ ...session, scores: newScores, stage_histories: newStageHistories });
        const token2 = localStorage.getItem("token");
        fetch(`/interview/sessions/${session.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token2}` },
          body: JSON.stringify({ scores: newScores, stage_histories: newStageHistories }),
        }).catch(console.error);
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast.error(`请求异常：${e?.message || "未知错误"}`);
      }
    } finally {
      setStreaming(false);
      setStreamingText("");
    }
  };

  const handleEndRound = async () => {
    if (!hasMessages || generatingReview) return;
    setGeneratingReview(true);
    try {
      const token = localStorage.getItem("token");
      if (isPractice) {
        const resp = await fetch("/practice/stage-review", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ stage, messages }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          toast.error(data.detail || "面评报告生成失败");
          return;
        }
        setPracticeReview(data);
        toast.success("面评报告已生成");
      } else {
        if (!session) return;
        const resp = await fetch("/interview/stage-review", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ session_id: session.id, stage }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          toast.error(data.detail || "面评报告生成失败");
          return;
        }
        const newReviews = { ...(session.stage_reviews || {}), [String(stage)]: data };
        const newCompletedCount = Object.keys(newReviews).length;
        const newCurrentStage = Math.min(newCompletedCount, 4);
        setSession({ ...session, stage_reviews: newReviews, current_stage: newCurrentStage });
        fetch(`/interview/sessions/${session.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ stage: newCurrentStage }),
        }).catch(console.error);
        toast.success("面评报告已生成");
      }
    } catch (e: any) {
      toast.error(`生成失败：${e?.message || "未知错误"}`);
    } finally {
      setGeneratingReview(false);
    }
  };

  const handleSaveLog = async () => {
    if (!isPractice || !hasMessages || savingLog) return;
    setSavingLog(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/practice/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stage, messages }),
      });
      if (resp.ok) {
        setLogSaved(true);
        toast.success("已保存到练习历史");
      } else {
        const data = await resp.json().catch(() => ({}));
        toast.error(data.detail || "保存失败");
      }
    } finally {
      setSavingLog(false);
    }
  };

  const handleResetPractice = () => {
    if (!isPractice || streaming) return;
    if (!confirm("清空当前对话重新练？已保存到「练习历史」的记录不会丢。")) return;
    setMessages([]);
    setScores({});
    setLogSaved(false);
    setReviewingLogId(null);
  };

  const handleNextStage = () => {
    if (isPractice) {
      navigate(`/interview/practice/stage/${Math.min(stage + 1, 4)}`);
    } else if (sessionId) {
      const nextStage = stage + 1;
      if (nextStage > 4) {
        navigate(`/interview/mock/${sessionId}/report`);
      } else {
        navigate(`/interview/mock/${sessionId}/stage/${nextStage}`);
      }
    }
  };

  if (!ready) {
    return (
      <InterviewLayout>
        <div className="h-full flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-sm">
            <AlertCircle size={32} className="text-fg-subtle mx-auto" strokeWidth={1.5} />
            <p className="text-[14px] text-fg">
              {isPractice ? "请先填写练习目标" : "场次加载失败或目标信息不完整"}
            </p>
            <button
              onClick={() => navigate(isPractice ? "/interview/practice" : "/interview/mock")}
              className="inline-flex items-center gap-1 border border-accent text-accent font-mono text-[12px] uppercase tracking-[0.12em] rounded-sm px-4 py-2 hover:bg-accent hover:text-bg transition-colors"
            >
              {isPractice ? "回练习入口" : "回模拟列表"} <ArrowRight size={14} />
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
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-[14px] font-medium text-fg">{title}</h2>
              <p className="text-[12px] text-fg-subtle">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              {isPractice ? (
                <>
                  {hasMessages && !streaming && (
                    <>
                      <button
                        onClick={handleResetPractice}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-fg-subtle text-[11px] hover:border-accent hover:text-accent transition-colors"
                      >
                        <RotateCcw size={12} /> 重练本关
                      </button>
                      <button
                        onClick={handleEndRound}
                        disabled={generatingReview}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-accent text-accent text-[11px] hover:bg-accent hover:text-bg transition-colors disabled:opacity-40"
                      >
                        {generatingReview ? <Loader2 size={12} className="animate-spin" /> : <Flag size={12} />}
                        {practiceReview ? "重新生成面评" : "结束本轮"}
                      </button>
                      <button
                        onClick={handleSaveLog}
                        disabled={savingLog || logSaved}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-accent text-accent text-[11px] hover:bg-accent hover:text-bg transition-colors disabled:opacity-40"
                      >
                        {savingLog ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                        {logSaved ? "已留档" : "留档"}
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
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
                  {currentReview && (
                    <button
                      onClick={handleNextStage}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-accent bg-accent text-bg text-[11px] hover:opacity-90 transition-opacity"
                    >
                      {stage >= 4 ? "查看复盘" : "下一关"} <ArrowRight size={12} />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {reviewingLogId && (
            <div className="px-4 py-2 bg-accent/10 border-b border-accent/40 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px] text-accent min-w-0">
                <Eye size={12} strokeWidth={1.5} />
                <span className="truncate">
                  复习中：练习历史 #{String(reviewingLogId).padStart(3, "0")}（只读 · 不会污染本次练习）
                </span>
              </div>
              <button
                onClick={handleExitReview}
                className="flex items-center gap-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-subtle hover:text-accent transition-colors shrink-0"
              >
                <X size={11} /> EXIT
              </button>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !streaming && (
              <div className="h-full flex items-center justify-center">
                <div className="text-center max-w-sm space-y-4">
                  <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
                    [ INTERVIEWER · STANDBY ]
                  </div>
                  <p className="text-[13px] text-fg-muted leading-relaxed">
                    {showScenario && scenarioText
                      ? "已为你准备好场景题。点击下方按钮，面试官会出题并发起追问。"
                      : "面试官已就位。点击下方按钮开始 — AI 会主动出第一道题，你只管答。"}
                  </p>
                  <button
                    onClick={() => {
                      handleSend("开始面试");
                    }}
                    disabled={streaming || generatingReview}
                    className="inline-flex items-center gap-2 border border-accent bg-accent text-bg font-mono text-[12px] uppercase tracking-[0.12em] rounded-sm px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    <Play size={13} strokeWidth={1.5} />
                    开始面试
                  </button>
                  <p className="text-[11px] text-fg-subtle font-mono">
                    [ ENTER 发送 / SHIFT+ENTER 换行 ]
                  </p>
                </div>
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
            {voiceMode ? (
              /* Voice input mode */
              <div className="flex flex-col items-center gap-3 py-2">
                <button
                  onClick={() => {
                    if (voice.isRecording) {
                      setLastAudioDuration(voice.duration);
                      voice.stopRecording();
                    } else {
                      voice.startRecording();
                    }
                  }}
                  disabled={streaming || asrLoading || !!reviewingLogId}
                  className={`h-14 w-14 rounded-full flex items-center justify-center transition-all ${
                    voice.isRecording
                      ? "bg-error text-bg animate-pulse"
                      : "bg-accent text-bg hover:opacity-90"
                  } disabled:opacity-40`}
                >
                  {voice.isRecording ? <MicOff size={22} /> : <Mic size={22} />}
                </button>
                <div className="text-[12px] text-fg-subtle font-mono">
                  {voice.isRecording
                    ? `录音中 ${voice.duration}s · 点击停止`
                    : asrLoading
                    ? "语音识别中…"
                    : streaming
                    ? "面试官思考中…"
                    : "按住麦克风说话"}
                </div>
                {voice.error && (
                  <div className="text-[11px] text-error">{voice.error}</div>
                )}
                {/* Hidden audio element for TTS */}
                <audio ref={audioRef} className="hidden" />
              </div>
            ) : (
              /* Text input mode */
              <>
                {showCodeInput && (
                  <textarea value={codeInput} onChange={(e) => setCodeInput(e.target.value)}
                    className="w-full bg-overlay border border-border rounded-sm px-3 py-2 text-[12px] font-mono outline-none focus:border-accent resize-none h-20"
                    placeholder="粘贴代码片段（可选）…" />
                )}
                <div className="flex gap-2">
                  <input value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend(input)}
                    disabled={!!reviewingLogId}
                    className="flex-1 bg-overlay border border-border rounded-sm px-3 py-2 text-[14px] outline-none focus:border-accent disabled:opacity-40"
                    placeholder={reviewingLogId ? "复习模式 · 不可输入（点上方 EXIT 退出）" : "输入回答…"} />
                  <button onClick={() => handleSend(codeInput ? `[代码]\n${codeInput}\n\n${input}` : input)}
                    disabled={streaming || !input.trim() || !!reviewingLogId}
                    className="h-9 px-3 flex items-center justify-center border border-accent text-accent rounded-sm hover:bg-accent hover:text-bg transition-colors disabled:opacity-40">
                    <Send size={14} />
                  </button>
                </div>
              </>
            )}
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
                  ? (isPractice ? "对话结束后点击左上角「结束本轮」生成面评报告" : "对话结束后点击左上角「结束本轮」生成面评报告并解锁下一关")
                  : "开始对话后，可在此生成结构化面评报告"}
              </div>
            )
          }

          {/* Practice 模式：练习历史侧栏 */}
          {isPractice && (
            <div className="border border-border bg-elevated rounded-sm">
              <div className="h-8 px-3 flex items-center justify-between border-b border-border">
                <div className="flex items-center gap-1.5">
                  <History size={11} className="text-fg-subtle" strokeWidth={1.5} />
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-muted">
                    PRACTICE HISTORY
                  </span>
                  <span className="font-mono text-[10px] text-fg-subtle">
                    [ {String(history.length).padStart(2, "0")} ]
                  </span>
                </div>
                {historyLoading && <Loader2 size={11} className="animate-spin text-fg-subtle" />}
              </div>
              {history.length === 0 ? (
                <div className="p-3 text-[11.5px] text-fg-subtle leading-relaxed">
                  这一关还没留档。练完点右上角「留档」就会出现在这里，下次能回来对照看。
                </div>
              ) : (
                <ul className="divide-y divide-border max-h-[340px] overflow-y-auto">
                  {history.map((h) => {
                    const isActive = reviewingLogId === h.id;
                    return (
                      <li key={h.id}>
                        <button
                          onClick={() => handleViewLog(h.id)}
                          disabled={streaming}
                          className={`w-full text-left px-3 py-2 transition-colors ${
                            isActive ? "bg-overlay border-l-2 border-l-accent" : "hover:bg-overlay/60 border-l-2 border-l-transparent"
                          } disabled:opacity-40`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10.5px] text-fg-muted">
                              #{String(h.id).padStart(3, "0")}
                            </span>
                            <span className="font-mono text-[10px] text-fg-subtle">
                              {h.ended_at ? formatTimeShort(h.ended_at) : "—"}
                            </span>
                          </div>
                          <div className="mt-1 text-[11.5px] text-fg-muted truncate">
                            {h.company || "—"} · {h.position || "—"}
                            <span className="ml-2 text-fg-subtle">
                              {h.msg_count} 条
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="px-3 py-2 border-t border-border text-[11px] text-fg-subtle leading-relaxed">
                {hasMessages
                  ? reviewingLogId
                    ? "正在复习历史记录（输入已禁用）"
                    : "点右上角「留档」保存这次练习"
                  : "随便练。不带前序面试官的弱点记录。"}
              </div>
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
