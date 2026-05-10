import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "@/contexts/InterviewContext";
import { usePractice } from "@/contexts/PracticeContext";
import { useInterviewMode } from "@/hooks/useInterviewMode";
import { useToast } from "@/components/ToastProvider";
import { InterviewLayout } from "./InterviewLayout";
import { ArrowRight, Loader2, AlertCircle, FileText, Upload } from "lucide-react";
import { readSseStream } from "@/lib/sse";

export default function Stage1Resume() {
  const navigate = useNavigate();
  const toast = useToast();
  const { mode, sessionId } = useInterviewMode();
  const { session, setSession } = useInterview();
  const { profile, updateProfile } = usePractice();
  const isPractice = mode === "practice";

  const company = isPractice ? profile.company : session?.company;
  const position = isPractice ? profile.position : session?.position;
  const resumePath = isPractice ? profile.resume_file_path : session?.resume_file_path;
  const ready = isPractice ? !!company && !!position : !!session && session?.id === sessionId;

  const [tags, setTags] = useState<string[]>(isPractice ? [] : (session?.resume_tags || []));
  const [risks, setRisks] = useState<string[]>(isPractice ? [] : (session?.resume_risks || []));
  const [projects, setProjects] = useState<string[]>(isPractice ? [] : (session?.target_projects || []));
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPractice) {
      // 练习模式不展示历史提取结果（无记忆语义）
      setTags([]);
      setRisks([]);
      setProjects([]);
    } else {
      setTags(session?.resume_tags || []);
      setRisks(session?.resume_risks || []);
      setProjects(session?.target_projects || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPractice, session?.id]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const hasPdf = !!resumePath;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await resp.json();
      if (!data.file_path) {
        toast.error("上传失败");
        return;
      }
      if (isPractice) {
        await updateProfile({ resume_file_path: data.file_path });
      } else if (session) {
        setSession({ ...session, resume_file_path: data.file_path });
        await fetch(`/interview/sessions/${session.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ resume_file_path: data.file_path }),
        });
      }
      toast.success("简历上传成功");
    } catch (err) {
      console.error("PDF upload failed:", err);
      toast.error("简历上传失败");
    }
  };

  const handleAnalyze = async () => {
    if (!ready || !hasPdf) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const endpoint = isPractice ? "/practice/chat" : "/interview/chat";
      const body = isPractice
        ? {
            stage: 1,
            message: "请基于附件 PDF 简历进行分析，按规定 JSON 格式输出。",
            model: "kimi-k2.6",
          }
        : {
            session_id: session!.id,
            stage: 1,
            message: "请基于附件 PDF 简历进行分析，按规定 JSON 格式输出。",
            model: "kimi-k2.6",
            response_format: { type: "json_object" },
          };
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      let raw = "";
      await readSseStream(resp, {
        onDelta: (d) => { raw += d; },
        onError: (msg) => toast.error(`分析失败：${msg}`),
        signal: abortRef.current.signal,
      });

      let parsed: any;
      try {
        // 练习模式没有强制 response_format，可能模型把 JSON 嵌在 ```json fence
        const fenceMatch = raw.match(/```json\s*([\s\S]*?)\s*```/);
        const candidate = fenceMatch ? fenceMatch[1] : raw;
        parsed = JSON.parse(candidate);
      } catch {
        toast.error("AI 输出未能解析为合法 JSON，请重试");
        return;
      }
      const newTags = parsed.tags || parsed.技术标签 || [];
      const newRisks = parsed.risks || parsed.风险点 || [];
      const newProjects = parsed.target_projects || parsed.projects || parsed.核心项目 || [];
      setTags(newTags);
      setRisks(newRisks);
      setProjects(newProjects);

      // 仅模拟模式持久化提取结果
      if (!isPractice && session) {
        const updated = {
          ...session,
          resume_tags: newTags,
          resume_risks: newRisks,
          target_projects: newProjects,
        };
        setSession(updated);

        const token2 = localStorage.getItem("token");
        fetch(`/interview/sessions/${session.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token2}` },
          body: JSON.stringify({
            resume_tags: newTags,
            resume_risks: newRisks,
            target_projects: newProjects,
          }),
        }).catch((e) => {
          console.error("Persist resume analysis failed:", e);
          toast.warning("分析结果已生成，但同步到云端失败");
        });
      }

      toast.success("简历分析完成");
    } catch (e: any) {
      if (e.name !== "AbortError") {
        toast.error(`请求异常：${e?.message || "未知错误"}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNextStage = () => {
    if (isPractice) navigate("/interview/practice/stage/2");
    else if (sessionId) navigate(`/interview/mock/${sessionId}/stage/2`);
  };

  if (!ready) {
    return (
      <InterviewLayout>
        <div className="h-full flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-sm">
            <AlertCircle size={32} className="text-fg-subtle mx-auto" strokeWidth={1.5} />
            <p className="text-[14px] text-fg">
              {isPractice ? "请先在练习入口填写目标信息" : "场次加载失败"}
            </p>
            <button
              onClick={() => navigate(isPractice ? "/interview/practice" : "/interview/mock")}
              className="inline-flex items-center gap-1 border border-accent text-accent font-mono text-[12px] uppercase tracking-[0.12em] rounded-sm px-4 py-2 hover:bg-accent hover:text-bg transition-colors"
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
            <h2 className="text-[14px] font-medium text-fg">简历评估</h2>
            <p className="text-[12px] text-fg-subtle mt-1">
              上传 PDF 简历，AI 自动提取技术标签、风险点与深挖项目
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
          />

          {!hasPdf ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 px-4 py-8 border border-dashed border-border bg-overlay rounded-sm hover:border-accent transition-colors"
            >
              <Upload size={20} className="text-fg-subtle" strokeWidth={1.5} />
              <span className="text-[12px] text-fg-subtle">点击上传 PDF 简历</span>
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 border border-accent/40 bg-accent/10 rounded-sm text-[12px] text-accent">
                <FileText size={14} strokeWidth={1.5} />
                <span className="truncate">{(resumePath || "").split("/").pop()}</span>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] text-fg-subtle underline hover:text-accent transition-colors"
              >
                重新上传
              </button>
            </>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading || !hasPdf}
            className="w-full h-9 flex items-center justify-center gap-2 border border-accent text-accent text-[12px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent hover:text-bg transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <>
              分析简历 <ArrowRight size={14} />
            </>}
          </button>

          {!isPractice && tags.length > 0 && !loading && (
            <button
              onClick={handleNextStage}
              className="w-full h-9 flex items-center justify-center gap-2 border border-accent bg-accent text-bg text-[12px] uppercase tracking-[0.12em] rounded-sm hover:opacity-90 transition-opacity"
            >
              下一关 · 技术面 <ArrowRight size={14} />
            </button>
          )}
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
              {hasPdf ? "点击「分析简历」让 AI 直读 PDF" : "请先上传 PDF 简历"}
            </div>
          )}
        </section>
      </div>
    </InterviewLayout>
  );
}
