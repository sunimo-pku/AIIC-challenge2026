import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "@/contexts/InterviewContext";
import { useToast } from "@/components/ToastProvider";
import { InterviewLayout } from "./InterviewLayout";
import { ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { readSseStream } from "@/lib/sse";

export default function Stage0Intel() {
  const navigate = useNavigate();
  const toast = useToast();
  const { session, setSession } = useInterview();
  const [report, setReport] = useState(session?.intel_report?.markdown || "");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

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
            <div className="text-[14px] leading-relaxed">
              <MarkdownRenderer content={report} />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-fg-subtle text-[12px]">
              {loading ? "正在搜集情报…" : "点击左侧按钮生成情报报告"}
            </div>
          )}
        </section>
      </div>
    </InterviewLayout>
  );
}
