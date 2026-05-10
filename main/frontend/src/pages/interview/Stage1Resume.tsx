import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "@/contexts/InterviewContext";
import { useToast } from "@/components/ToastProvider";
import { InterviewLayout } from "./InterviewLayout";
import { ArrowRight, Loader2, AlertCircle, FileText } from "lucide-react";
import { readSseStream } from "@/lib/sse";

export default function Stage1Resume() {
  const navigate = useNavigate();
  const toast = useToast();
  const { session, setSession } = useInterview();
  const [resumeText, setResumeText] = useState(session?.resume_text || "");
  const [tags, setTags] = useState<string[]>(session?.resume_tags || []);
  const [risks, setRisks] = useState<string[]>(session?.resume_risks || []);
  const [projects, setProjects] = useState<string[]>(session?.target_projects || []);
  const [loading, setLoading] = useState(false);

  // 是否已上传 PDF：上传后即使 textarea 为空，也允许触发分析（PDF 由后端送给 Kimi 直读）
  const hasPdf = !!session?.resume_file_path;
  const canAnalyze = !!resumeText.trim() || hasPdf;

  const handleAnalyze = async () => {
    if (!session || !canAnalyze) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      // 当 textarea 为空但有 PDF 时，给模型一个 hint 让它从 PDF 提取
      const message = resumeText.trim()
        ? `请分析以下简历：\n\n${resumeText}`
        : "请基于附件 PDF 简历进行分析，按规定 JSON 格式输出。";
      const resp = await fetch("/interview/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: session.id,
          stage: 1,
          message,
          model: "kimi-k2.6",
          response_format: { type: "json_object" },
        }),
      });

      let raw = "";
      await readSseStream(resp, {
        onDelta: (d) => { raw += d; },
        onError: (msg) => toast.error(`分析失败：${msg}`),
      });

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        toast.error("AI 输出未能解析为合法 JSON，请重试或换一份简历文本");
        return;
      }
      const newTags = parsed.tags || parsed.技术标签 || [];
      const newRisks = parsed.risks || parsed.风险点 || [];
      const newProjects = parsed.target_projects || parsed.projects || parsed.核心项目 || [];
      setTags(newTags);
      setRisks(newRisks);
      setProjects(newProjects);

      const updated = {
        ...session,
        resume_text: resumeText,
        resume_tags: newTags,
        resume_risks: newRisks,
        target_projects: newProjects,
      };
      setSession(updated);

      const token2 = localStorage.getItem("token");
      fetch(`/interview/sessions/${session.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token2}`,
        },
        body: JSON.stringify({
          resume_text: resumeText,
          resume_tags: newTags,
          resume_risks: newRisks,
          target_projects: newProjects,
        }),
      }).catch((e) => {
        console.error("Persist resume analysis failed:", e);
        toast.warning("分析结果已生成，但同步到云端失败");
      });

      toast.success("简历分析完成");
    } catch (e: any) {
      toast.error(`请求异常：${e?.message || "未知错误"}`);
    } finally {
      setLoading(false);
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
      <div className="h-full grid grid-cols-1 lg:grid-cols-[400px_1fr]">
        <section className="border-r border-border p-6 flex flex-col gap-4">
          <div>
            <h2 className="text-[14px] font-medium text-fg">简历评估</h2>
            <p className="text-[12px] text-fg-subtle mt-1">
              {hasPdf ? "已上传 PDF，可直接分析；也可粘贴文本覆盖" : "粘贴简历，或在左侧上传 PDF 让 AI 直接读取"}
            </p>
          </div>

          {hasPdf && (
            <div className="flex items-center gap-2 px-3 py-2 border border-accent/40 bg-accent/10 rounded-sm text-[12px] text-accent">
              <FileText size={14} strokeWidth={1.5} />
              <span className="truncate">已上传 PDF：{session.resume_file_path.split("/").pop()}</span>
            </div>
          )}

          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            className="flex-1 min-h-[200px] bg-overlay border border-border rounded-sm px-3 py-2 text-[14px] outline-none focus:border-accent resize-none"
            placeholder={hasPdf ? "（可选）粘贴简历文本以补充 / 覆盖 PDF 内容…" : "粘贴简历内容…"}
          />

          <button
            onClick={handleAnalyze}
            disabled={loading || !canAnalyze}
            className="w-full h-9 flex items-center justify-center gap-2 border border-accent text-accent text-[12px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent hover:text-bg transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <>
              分析简历 <ArrowRight size={14} />
            </>}
          </button>
        </section>

        <section className="p-6 overflow-y-auto space-y-6">
          {tags.length > 0 && (
            <div>
              <h3 className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted mb-3">技术标签云</h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <span key={t} className="px-2 py-1 text-[12px] border border-border bg-elevated rounded-sm">{t}</span>
                ))}
              </div>
            </div>
          )}

          {risks.length > 0 && (
            <div>
              <h3 className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted mb-3">风险点</h3>
              <ul className="space-y-2">
                {risks.map((r, i) => (
                  <li key={i} className="text-[13px] text-error flex items-start gap-2"><span>⚠️</span><span>{r}</span></li>
                ))}
              </ul>
            </div>
          )}

          {projects.length > 0 && (
            <div>
              <h3 className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted mb-3">深挖项目</h3>
              <ul className="space-y-2">
                {projects.map((p, i) => (
                  <li key={i} className="text-[13px] text-fg flex items-start gap-2"><span>✓</span><span>{p}</span></li>
                ))}
              </ul>
            </div>
          )}

          {tags.length === 0 && !loading && (
            <div className="h-full flex items-center justify-center text-fg-subtle text-[12px]">
              {hasPdf ? "点击「分析简历」让 AI 直读 PDF" : "左侧粘贴简历后进行分析"}
            </div>
          )}
        </section>
      </div>
    </InterviewLayout>
  );
}
