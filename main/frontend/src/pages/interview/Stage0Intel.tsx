import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "@/contexts/InterviewContext";
import { useToast } from "@/components/ToastProvider";
import { InterviewLayout } from "./InterviewLayout";
import { ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { readSseStream } from "@/lib/sse";

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
        {/* STYLE */}
        <div className="border border-border rounded-md bg-elevated flex flex-col">
          <div className="h-8 px-3 flex items-center border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
            [ STYLE ]
          </div>
          <div className="px-3 py-3 flex-1 flex items-center">
            <span className="text-[15px] text-accent font-medium">
              {intel.interview_style || "—"}
            </span>
          </div>
        </div>

        {/* DIFFICULTY */}
        <div className="border border-border rounded-md bg-elevated flex flex-col">
          <div className="h-8 px-3 flex items-center border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
            [ DIFFICULTY ]
          </div>
          <div className="px-3 py-3 flex-1 flex items-center justify-between gap-3">
            <span className="text-[15px] text-fg font-medium">
              {intel.difficulty || "—"}
            </span>
            <DifficultyBars value={intel.difficulty} />
          </div>
        </div>

        {/* HIGH-FREQ TOPICS */}
        <div className="border border-border rounded-md bg-elevated md:col-span-2 xl:col-span-1">
          <div className="h-8 px-3 flex items-center justify-between border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
            <span>[ HIGH-FREQ.TOPICS ]</span>
            <span>[ {pad2(topics.length)} ]</span>
          </div>
          <div className="p-3 flex flex-wrap gap-1.5">
            {topics.length === 0 ? (
              <span className="text-[12px] text-fg-subtle font-mono">[ EMPTY ]</span>
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

      {/* PREP.PRIORITY */}
      {prep.length > 0 && (
        <div className="border border-border rounded-md bg-elevated">
          <div className="h-8 px-3 flex items-center justify-between border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
            <span>[ PREP.PRIORITY ]</span>
            <span>[ {pad2(prep.length)} ]</span>
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
  const { session, setSession } = useInterview();
  const [report, setReport] = useState(session?.intel_report?.markdown || "");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const intel: IntelData | null = useMemo(() => {
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
    return tryParseIntelFromMarkdown(report);
  }, [report, session?.intel_report]);

  const cleanReport = useMemo(() => stripJsonFence(report), [report]);
  const hasIntel = !!(
    intel &&
    (intel.interview_style ||
      intel.difficulty ||
      (intel.high_freq_topics && intel.high_freq_topics.length) ||
      (intel.prep_priority && intel.prep_priority.length))
  );

  const handleGenerate = async () => {
    if (!session) return;
    setLoading(true);
    setReport("");
    setStatus("");
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/interview/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: session.id,
          stage: 0,
          message: `请生成 ${session.company} ${session.position} 岗位的面试情报报告`,
          model: "kimi-k2.6",
        }),
      });

      let final = "";
      await readSseStream(resp, {
        onStatus: (s) => setStatus(s),
        onDelta: (d) => {
          final += d;
          setReport((prev: string) => prev + d);
        },
        onError: (msg) => toast.error(`生成失败：${msg}`),
      });

      if (final && session) {
        let intelData: Record<string, any> = { markdown: final };
        try {
          const jsonMatch = final.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            intelData = { ...parsed, markdown: final };
          }
        } catch {}
        const updated = { ...session, intel_report: intelData };
        setSession(updated);
        const token2 = localStorage.getItem("token");
        fetch(`/interview/sessions/${session.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token2}`,
          },
          body: JSON.stringify({
            intel_report: JSON.stringify(intelData),
          }),
        }).catch((e) => {
          console.error("Persist intel failed:", e);
          toast.warning("情报已生成，但同步到云端失败");
        });
      }
    } catch (e: any) {
      toast.error(`请求异常：${e?.message || "未知错误"}`);
    } finally {
      setLoading(false);
      setStatus("");
    }
  };

  if (!session) {
    return (
      <InterviewLayout>
        <div className="h-full flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-sm">
            <AlertCircle size={32} className="text-fg-subtle mx-auto" strokeWidth={1.5} />
            <p className="text-[14px] text-fg">请先完成面试设置</p>
            <p className="text-[12px] text-fg-subtle">需要填写目标公司和岗位后才能生成情报报告</p>
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
      <div className="h-full grid grid-cols-1 lg:grid-cols-[400px_1fr]">
        <section className="border-r border-border p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-[14px] font-medium text-fg">情报局</h2>
            <p className="text-[12px] text-fg-subtle mt-1">
              目标：{session.company} · {session.position}
            </p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full h-9 flex items-center justify-center gap-2 border border-accent text-accent text-[12px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent hover:text-bg transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <>
              生成情报 <ArrowRight size={14} />
            </>}
          </button>

          {status && <div className="text-[11px] text-fg-subtle font-mono">{status}</div>}
        </section>

        <section className="p-6 overflow-y-auto">
          {report ? (
            <div className="space-y-4">
              {hasIntel && <IntelDashboard intel={intel!} />}
              {cleanReport && (
                <div className="border border-border rounded-md bg-elevated">
                  <div className="h-8 px-3 flex items-center justify-between border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
                    <span>[ INTEL.REPORT ]</span>
                    <span>{loading ? "[ STREAMING ]" : "[ READY ]"}</span>
                  </div>
                  <div className="p-4 text-[14px] leading-relaxed">
                    <MarkdownRenderer content={cleanReport} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-fg-subtle text-[12px] font-mono uppercase tracking-[0.12em]">
              {loading ? "[ COLLECTING INTEL... ]" : "[ NO SIGNAL ] · 点击左侧按钮生成情报报告"}
            </div>
          )}
        </section>
      </div>
    </InterviewLayout>
  );
}
