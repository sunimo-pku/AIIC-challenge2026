import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "@/contexts/InterviewContext";
import { usePractice } from "@/contexts/PracticeContext";
import { useInterviewMode } from "@/hooks/useInterviewMode";
import { useToast } from "@/components/ToastProvider";
import { InterviewLayout } from "./InterviewLayout";
import { ArrowRight, Loader2, AlertCircle, Save, NotebookPen, RefreshCw } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { readSseStream } from "@/lib/sse";
import { FollowUpChat } from "@/components/FollowUpChat";
import { loadInterviewSettings } from "@/lib/interviewSettings";

function formatRelTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

interface IntelData {
  interview_style?: string;
  high_freq_topics?: string[];
  difficulty?: string;
  prep_priority?: string[];
}

const DIFFICULTY_LEVEL: Record<string, number> = { 简单: 1, 中等: 2, 困难: 3 };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function stripJsonFence(md: string): string {
  const closed = md.replace(/```json\s*[\s\S]*?\s*```/g, "").trimEnd();
  if (closed !== md) return closed;
  const idx = md.lastIndexOf("```json");
  return idx >= 0 ? md.slice(0, idx).trimEnd() : md;
}

function tryParseIntelFromMarkdown(md: string): IntelData | null {
  const m = md.match(/```json\s*([\s\S]*?)\s*```/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function DifficultyBars({ value }: { value?: string }) {
  const filled = DIFFICULTY_LEVEL[value ?? ""] ?? 0;
  return (
    <div className="flex items-center gap-0.5" aria-label={`difficulty ${value ?? "unknown"}`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-3.5 ${i < filled ? "bg-accent" : "bg-border"}`}
        />
      ))}
    </div>
  );
}

function IntelDashboard({ intel }: { intel: IntelData }) {
  const topics = intel.high_freq_topics ?? [];
  const prep = intel.prep_priority ?? [];
  return (
    <div className="space-y-3">
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-[160px_180px_1fr]">
        <div className="border border-border rounded-md bg-elevated flex flex-col">
          <div className="h-8 px-3 flex items-center border-b border-border text-[12px] font-medium tracking-wide text-fg-subtle">
            STYLE
          </div>
          <div className="px-3 py-3 flex-1 flex items-center">
            <span className="text-[15px] text-accent font-medium">
              {intel.interview_style || "—"}
            </span>
          </div>
        </div>

        <div className="border border-border rounded-md bg-elevated flex flex-col">
          <div className="h-8 px-3 flex items-center border-b border-border text-[12px] font-medium tracking-wide text-fg-subtle">
            DIFFICULTY
          </div>
          <div className="px-3 py-3 flex-1 flex items-center justify-between gap-3">
            <span className="text-[15px] text-fg font-medium">
              {intel.difficulty || "—"}
            </span>
            <DifficultyBars value={intel.difficulty} />
          </div>
        </div>

        <div className="border border-border rounded-md bg-elevated md:col-span-2 xl:col-span-1">
          <div className="h-8 px-3 flex items-center justify-between border-b border-border text-[12px] font-medium tracking-wide text-fg-subtle">
            <span>[ HIGH-FREQ.TOPICS ]</span>
            <span>{pad2(topics.length)}</span>
          </div>
          <div className="p-3 flex flex-wrap gap-1.5">
            {topics.length === 0 ? (
              <span className="text-[12px] text-fg-subtle font-mono">EMPTY</span>
            ) : (
              topics.map((t, i) => (
                <span
                  key={`${t}-${i}`}
                  className="border border-border px-2 py-0.5 text-[12px] text-fg-muted hover:border-accent hover:text-accent transition-colors duration-150"
                >
                  {t}
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {prep.length > 0 && (
        <div className="border border-border rounded-md bg-elevated">
          <div className="h-8 px-3 flex items-center justify-between border-b border-border text-[12px] font-medium tracking-wide text-fg-subtle">
            <span>PREP.PRIORITY</span>
            <span>{pad2(prep.length)}</span>
          </div>
          <ol className="p-3 space-y-2">
            {prep.map((p, i) => (
              <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed">
                <span className="font-mono text-[11px] text-accent pt-0.5 shrink-0 tracking-[0.12em]">
                  {pad2(i + 1)}
                </span>
                <span className="text-fg">{p}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function Stage0Intel() {
  const navigate = useNavigate();
  const toast = useToast();
  const { mode, sessionId } = useInterviewMode();
  const { session, setSession } = useInterview();
  const { profile } = usePractice();
  const isPractice = mode === "practice";

  const company = isPractice ? profile.company : session?.company;
  const position = isPractice ? profile.position : session?.position;
  const ready = isPractice ? !!company && !!position : !!session && session?.id === sessionId;

  const practiceCacheKey = useMemo(() => {
    if (!isPractice || !company || !position) return "";
    return `stage0_practice_${company}_${position}`;
  }, [isPractice, company, position]);

  const [report, setReport] = useState(() => {
    if (!isPractice) return session?.intel_report?.markdown || "";
    // 练习模式：先从 localStorage 恢复（处理生成中途切走再切回）
    if (!practiceCacheKey) return "";
    try {
      return localStorage.getItem(practiceCacheKey) || "";
    } catch {
      return "";
    }
  });
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingLog, setSavingLog] = useState(false);
  const [logSaved, setLogSaved] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 练习模式：生成过程中实时写入 localStorage，切走再切回可恢复
  useEffect(() => {
    if (isPractice && practiceCacheKey && report) {
      localStorage.setItem(practiceCacheKey, report);
    }
  }, [isPractice, practiceCacheKey, report]);

  // 模式/场次切换时重置 + 练习模式拉一次按 (公司, 岗位) 维度的攻略缓存
  useEffect(() => {
    if (isPractice) {
      // 不再无条件清空：localStorage 缓存会在 mount 时恢复；
      // 只有当用户切到另一家公司/岗位时才需要清空（由 practiceCacheKey 变化触发本 effect）
      setLogSaved(false);
      setCachedAt(null);
      // 练习模式有缓存就直接展示——不让用户每次进来都重新跑一次（联网搜要 30+ 秒）
      if (company && position) {
        (async () => {
          setCtxLoading(true);
          try {
            const token = localStorage.getItem("token");
            const resp = await fetch(
              `/practice/context?company=${encodeURIComponent(company)}&position=${encodeURIComponent(position)}`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (resp.ok) {
              const data = await resp.json();
              if (data.intel?.raw_markdown) {
                setReport(data.intel.raw_markdown);
                setCachedAt(data.intel_at);
              }
            }
          } catch { /* 失败不阻塞用户重新生成 */ }
          finally { setCtxLoading(false); }
        })();
      }
    } else {
      setReport(session?.intel_report?.markdown || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPractice, session?.id, company, position]);

  // 路由切换时不再 abort SSE，允许后台继续完成
  useEffect(() => {
    return () => {
      // abortRef.current?.abort();
    };
  }, []);

  const intel: IntelData | null = useMemo(() => {
    if (!isPractice) {
      const persisted = session?.intel_report;
      if (
        persisted &&
        (persisted.interview_style ||
          (Array.isArray(persisted.high_freq_topics) && persisted.high_freq_topics.length) ||
          persisted.difficulty ||
          (Array.isArray(persisted.prep_priority) && persisted.prep_priority.length))
      ) {
        return persisted as IntelData;
      }
    }
    return tryParseIntelFromMarkdown(report);
  }, [isPractice, report, session?.intel_report]);

  const cleanReport = useMemo(() => stripJsonFence(report), [report]);
  const hasIntel = !!(
    intel &&
    (intel.interview_style ||
      intel.difficulty ||
      (intel.high_freq_topics && intel.high_freq_topics.length) ||
      (intel.prep_priority && intel.prep_priority.length))
  );

  const handleGenerate = async () => {
    if (!ready) return;
    if (practiceCacheKey) localStorage.removeItem(practiceCacheKey);
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    setReport("");
    setStatus("");
    setLogSaved(false);
    const settings = loadInterviewSettings();
    try {
      const token = localStorage.getItem("token");
      const endpoint = isPractice ? "/practice/chat" : "/interview/chat";
      const body = isPractice
        ? {
            stage: 0,
            message: `请生成 ${company} ${position} 岗位的面试攻略报告`,
            model: "kimi-k2.6",
            difficulty: settings.difficulty,
            interviewer_style: settings.style,
          }
        : {
            session_id: session!.id,
            stage: 0,
            message: `请生成 ${session!.company} ${session!.position} 岗位的面试攻略报告`,
            model: "kimi-k2.6",
            difficulty: settings.difficulty,
            interviewer_style: settings.style,
          };
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      let final = "";
      await readSseStream(resp, {
        onStatus: (s) => setStatus(s),
        onDelta: (d) => {
          final += d;
          if (mountedRef.current) setReport((prev: string) => prev + d);
        },
        onError: (msg) => toast.error(`生成失败：${msg}`),
        signal: abortRef.current.signal,
      });

      // 持久化攻略：模拟模式 → InterviewSession.intel_report；
      //              练习模式 → PracticeContext.intel_json（按 (公司, 岗位) 缓存，
      //              让 stage 2 / stage 3 chat 能注入面经画像）
      if (final) {
        let intelParsed: Record<string, any> = {};
        try {
          const jsonMatch = final.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) intelParsed = JSON.parse(jsonMatch[1]);
        } catch {}

        if (!isPractice && session) {
          const intelData = { ...intelParsed, markdown: final };
          setSession({ ...session, intel_report: intelData });
          const token2 = localStorage.getItem("token");
          fetch(`/interview/sessions/${session.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token2}` },
            body: JSON.stringify({ intel_report: JSON.stringify(intelData) }),
          }).catch((e) => {
            console.error("Persist intel failed:", e);
            toast.warning("攻略已生成，但同步到云端失败");
          });
        } else if (isPractice && company && position) {
          // 标注本地"刚刚生成"的时间戳，免得用户多看一眼会怀疑"是不是又跑了一次"
          setCachedAt(new Date().toISOString());
          const token2 = localStorage.getItem("token");
          fetch("/practice/context/intel", {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token2}` },
            body: JSON.stringify({
              company,
              position,
              intel: {
                interview_style: intelParsed.interview_style || "",
                high_freq_topics: intelParsed.high_freq_topics || [],
                difficulty: intelParsed.difficulty || "",
                prep_priority: intelParsed.prep_priority || [],
                raw_markdown: final,
              },
            }),
          }).catch((e) => {
            console.error("Persist practice intel failed:", e);
            toast.warning("攻略已生成，但同步到云端失败（不影响本次查看，但 stage 2/3 仍会提示需要面经）");
          });
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast.error(`请求异常：${e?.message || "未知错误"}`);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setStatus("");
      }
    }
  };

  const handleSaveLog = async () => {
    if (!isPractice || !report || savingLog) return;
    setSavingLog(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/practice/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          stage: 0,
          messages: [
            { role: "user", content: `请生成 ${company} ${position} 岗位的面试攻略报告` },
            { role: "assistant", content: report },
          ],
        }),
      });
      if (resp.ok) {
        setLogSaved(true);
        toast.success("已存档到练习历史");
      }
    } finally {
      setSavingLog(false);
    }
  };

  const handleNextStage = () => {
    if (isPractice) navigate("/interview/practice/stage/1");
    else if (sessionId) navigate(`/interview/mock/${sessionId}/stage/1`);
  };

  const handleTakeNotes = () => {
    const summaryLines: string[] = [];
    if (intel?.interview_style) summaryLines.push(`> 风格：${intel.interview_style}`);
    if (intel?.difficulty) summaryLines.push(`> 难度：${intel.difficulty}`);
    if (intel?.high_freq_topics?.length) {
      summaryLines.push(`> 高频考点：${intel.high_freq_topics.slice(0, 5).join(" · ")}`);
    }
    const summary = summaryLines.length ? summaryLines.join("\n") + "\n\n" : "";
    const template = `# ${company} · ${position} · 面试攻略复盘\n\n${summary}## 这家公司面试风格我的理解\n- \n\n## 我感觉吃力的考点\n- \n\n## 我打算重点准备\n- \n`;
    navigate("/journal/new", {
      state: {
        title: `${company} · ${position} · 面试攻略`,
        content: template,
        mode: isPractice ? "practice" : "simulation",
        stage: 0,
        company,
        position,
        ref_session_id: isPractice ? null : sessionId ?? null,
      },
    });
  };

  if (!ready) {
    return (
      <InterviewLayout>
        <div className="h-full flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-sm">
            <AlertCircle size={32} className="text-fg-subtle mx-auto" strokeWidth={1.5} />
            <p className="text-[14px] text-fg">
              {isPractice ? "请先在练习入口填写目标公司与岗位" : "场次加载失败"}
            </p>
            <button
              onClick={() => navigate(isPractice ? "/interview/practice" : "/interview/mock")}
              className="inline-flex items-center gap-1 border border-accent text-accent text-[13px] font-medium tracking-wide rounded-lg px-4 py-2 hover:bg-accent hover:text-white transition-colors"
            >
              {isPractice ? "去练习入口" : "回模拟列表"} <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </InterviewLayout>
    );
  }

  return (
    <InterviewLayout>
      <div className="h-full grid grid-cols-1 lg:grid-cols-[400px_1fr]">
        <section className="border-r border-border p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-[14px] font-medium text-fg">面试攻略</h2>
            <p className="text-[12px] text-fg-subtle mt-1">
              目标：{company} · {position}
            </p>
          </div>

          <p className="text-[12px] text-fg-muted leading-relaxed">
            联网搜近半年的真实面经，给你画一张「面试画像」：这家公司这个岗位爱考什么、爱挖什么、近期高频考点。
            <br />
            <span className="text-fg-subtle">约 30–40 秒</span>
          </p>

          {/* 练习模式命中缓存时给一个明确的"已缓存"提示，避免用户以为没保存重复生成 */}
          {isPractice && cachedAt && !loading && (
            <div className="px-3 py-2 border border-accent/40 bg-accent/10 rounded-lg text-[11.5px] text-accent leading-relaxed">
              已缓存 · {formatRelTime(cachedAt)} · 直接看下方报告即可，stage 1/2/3 也已结合本攻略
            </div>
          )}

          {ctxLoading && !report && (
            <div className="text-[11px] text-fg-subtle font-mono flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" /> CHECKING CACHE...
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full h-9 flex items-center justify-center gap-2 border border-accent text-accent text-[12px] uppercase tracking-[0.12em] rounded-lg hover:bg-accent hover:text-white transition-colors disabled:opacity-40"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isPractice && cachedAt ? (
              <><RefreshCw size={13} strokeWidth={1.5} /> 重新生成攻略</>
            ) : (
              <>生成攻略 <ArrowRight size={14} /></>
            )}
          </button>

          {status && <div className="text-[11px] text-fg-subtle font-mono">{status}</div>}

          {/* 模式相关动作 */}
          {!loading && report && (
            <>
              <button
                onClick={handleTakeNotes}
                className="w-full h-9 flex items-center justify-center gap-2 border border-border text-fg-muted text-[12px] uppercase tracking-[0.12em] rounded-lg hover:border-accent hover:text-accent transition-colors"
              >
                <NotebookPen size={13} strokeWidth={1.5} />
                记笔记
              </button>
              {isPractice ? (
                <button
                  onClick={handleSaveLog}
                  disabled={savingLog || logSaved}
                  className="w-full h-9 flex items-center justify-center gap-2 border border-border text-fg-subtle text-[12px] uppercase tracking-[0.12em] rounded-lg hover:border-accent hover:text-accent transition-colors disabled:opacity-40"
                >
                  {savingLog ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  {logSaved ? "已存档" : "存档"}
                </button>
              ) : (
                <button
                  onClick={handleNextStage}
                  className="w-full h-9 flex items-center justify-center gap-2 border border-accent bg-accent text-white text-[12px] uppercase tracking-[0.12em] rounded-lg hover:opacity-90 transition-opacity"
                >
                  下一关 · 简历评估 <ArrowRight size={14} />
                </button>
              )}
            </>
          )}
        </section>

        <section className="p-6 overflow-y-auto">
          {report ? (
            <div className="space-y-4">
              {hasIntel && <IntelDashboard intel={intel!} />}
              {cleanReport && (
                <div className="border border-border rounded-md bg-elevated">
                  <div className="h-8 px-3 flex items-center justify-between border-b border-border text-[12px] font-medium tracking-wide text-fg-subtle">
                    <span>INTEL.REPORT</span>
                    <span>{loading ? "STREAMING" : "READY"}</span>
                  </div>
                  <div className="p-4 text-[14px] leading-relaxed">
                    <MarkdownRenderer content={cleanReport} />
                  </div>
                </div>
              )}
              {!loading && report && (
                <FollowUpChat
                  endpoint={isPractice ? "/practice/chat" : "/interview/chat"}
                  stage={0}
                  sessionId={isPractice ? null : (sessionId ?? null)}
                  initialReport={report}
                  initialUserMessage={`请生成 ${company} ${position} 岗位的面试攻略报告`}
                  placeholder="围绕这份面经继续追问，例如：Redis 还会怎么考？"
                  difficulty={loadInterviewSettings().difficulty}
                  interviewerStyle={loadInterviewSettings().style}
                />
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-fg-subtle text-[12px] font-mono uppercase tracking-[0.12em]">
              {loading ? "COLLECTING INTEL..." : "NO SIGNAL · 点击左侧按钮，开始整理这家公司的面经画像"}
            </div>
          )}
        </section>
      </div>
    </InterviewLayout>
  );
}
