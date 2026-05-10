import { useState } from "react";
import { useInterview } from "@/contexts/InterviewContext";
import { InterviewLayout } from "./InterviewLayout";
import { ArrowRight, Loader2 } from "lucide-react";

export default function Stage0Intel() {
  const { session, setSession, advanceStage } = useInterview();
  const [company, setCompany] = useState(session?.company || "");
  const [position, setPosition] = useState(session?.position || "");
  const [report, setReport] = useState(session?.intel_report?.markdown || "");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCreateSession = async () => {
    if (!company || !position) return;
    setCreating(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/api/interview/sessions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ company, position }),
      });
      const data = await resp.json();
      setSession({
        id: data.id,
        company: data.company,
        position: data.position,
        current_stage: 0,
        intel_report: {},
        resume_text: "",
        resume_tags: [],
        resume_risks: [],
        target_projects: [],
        stage_histories: {},
        scores: {},
      });
    } finally {
      setCreating(false);
    }
  };

  const handleGenerate = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/api/interview/chat", {
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
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n\n")) {
          if (!line.startsWith("data:")) continue;
          const data = JSON.parse(line.slice(5).trim());
          if (data.delta) text += data.delta;
        }
      }
      setReport(text);
    } catch (e) {
      console.error("Generate failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (!report) return;
    await advanceStage({ intel_report: { markdown: report } });
  };

  const hasSession = !!session;

  return (
    <InterviewLayout>
      <div className="h-full grid grid-cols-1 lg:grid-cols-[400px_1fr]">
        <section className="border-r border-border p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-[14px] font-medium text-fg">情报局</h2>
            <p className="text-[12px] text-fg-subtle mt-1">
              {hasSession
                ? `目标：${session.company} · ${session.position}`
                : "输入目标公司和岗位，获取定制化面经"}
            </p>
          </div>

          {!hasSession && (
            <>
              <div className="space-y-1">
                <label className="block text-[12px] text-fg-muted uppercase tracking-[0.12em] font-mono">目标公司</label>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full bg-overlay border border-border rounded-sm px-3 py-2 text-[14px] outline-none focus:border-accent"
                  placeholder="如：字节跳动"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[12px] text-fg-muted uppercase tracking-[0.12em] font-mono">目标岗位</label>
                <input
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full bg-overlay border border-border rounded-sm px-3 py-2 text-[14px] outline-none focus:border-accent"
                  placeholder="如：后端开发"
                />
              </div>

              <button
                onClick={handleCreateSession}
                disabled={creating || !company || !position}
                className="w-full h-9 flex items-center justify-center gap-2 border border-accent text-accent text-[12px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent hover:text-bg transition-colors disabled:opacity-40"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <>
                  开始面试 <ArrowRight size={14} />
                </>}
              </button>
            </>
          )}

          {hasSession && (
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full h-9 flex items-center justify-center gap-2 border border-accent text-accent text-[12px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent hover:text-bg transition-colors disabled:opacity-40"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <>
                生成情报 <ArrowRight size={14} />
              </>}
            </button>
          )}

          {report && (
            <button
              onClick={handleNext}
              className="w-full h-9 flex items-center justify-center gap-2 bg-accent text-bg text-[12px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent/90 transition-colors"
            >
              进入下一关 <ArrowRight size={14} />
            </button>
          )}
        </section>

        <section className="p-6 overflow-y-auto">
          {report ? (
            <div className="prose prose-sm max-w-none">
              <div dangerouslySetInnerHTML={{ __html: report.replace(/\n/g, "<br/>") }} />
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-fg-subtle text-[12px]">
              {loading ? "正在搜集情报…" : hasSession ? "点击左侧按钮生成情报报告" : "先输入公司和岗位开始面试"}
            </div>
          )}
        </section>
      </div>
    </InterviewLayout>
  );
}
