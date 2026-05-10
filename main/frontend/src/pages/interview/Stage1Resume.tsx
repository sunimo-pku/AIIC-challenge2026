import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useInterview } from "@/contexts/InterviewContext";
import { usePractice } from "@/contexts/PracticeContext";
import { useInterviewMode } from "@/hooks/useInterviewMode";
import { useToast } from "@/components/ToastProvider";
import { InterviewLayout } from "./InterviewLayout";
import { ArrowRight, Loader2, AlertCircle, FileText, Upload, Copy, Check, NotebookPen, RefreshCw, Globe2 } from "lucide-react";
import { readSseStream } from "@/lib/sse";
import { FollowUpChat } from "@/components/FollowUpChat";
import { loadInterviewSettings } from "@/lib/interviewSettings";
import { parseJsonResponse } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

function formatRelTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

interface ResumeSuggestion {
  original: string;
  issue: string;
  rewrite: string;
  category?: string;
}

export default function Stage1Resume() {
  const navigate = useNavigate();
  const toast = useToast();
  const { mode, sessionId } = useInterviewMode();
  const { session, setSession } = useInterview();
  const { profile, loadProfile } = usePractice();
  const { user, refetchUser } = useAuth();
  const isPractice = mode === "practice";

  const company = isPractice ? profile.company : session?.company;
  const position = isPractice ? profile.position : session?.position;
  // 简历路径优先用 session/profile 自己挂的（每场快照），缺失时回退到用户级主简历。
  // 这样 mock 模式刷新进入第一关时，即便 session.resume_file_path 还没同步，也能用主简历兜底。
  const resumePath =
    (isPractice ? profile.resume_file_path : session?.resume_file_path) || user?.resume_file_path || "";
  const ready = isPractice ? !!company && !!position : !!session && session?.id === sessionId;

  // 模拟模式下：从 session.stage_artifacts["1"] 读上一次分析留下的修改建议 / raw JSON，
  // 防止用户切走页面再回来时"修改建议卡片"和"追问对话框初始上下文"莫名其妙消失。
  const persistedArtifact = (!isPractice && session?.stage_artifacts?.["1"]) || null;
  const [tags, setTags] = useState<string[]>(isPractice ? [] : (session?.resume_tags || []));
  const [risks, setRisks] = useState<string[]>(isPractice ? [] : (session?.resume_risks || []));
  const [projects, setProjects] = useState<string[]>(isPractice ? [] : (session?.target_projects || []));
  const [suggestions, setSuggestions] = useState<ResumeSuggestion[]>(
    persistedArtifact?.suggestions || []
  );
  const [rawJson, setRawJson] = useState<string>(persistedArtifact?.raw_json || "");
  const [loading, setLoading] = useState(false);
  // 练习模式按 (公司, 岗位) 维度的画像缓存状态
  const [intelReady, setIntelReady] = useState(false);
  const [evalCachedAt, setEvalCachedAt] = useState<string | null>(null);
  const [evalStale, setEvalStale] = useState(false);
  const [ctxLoading, setCtxLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isPractice) {
      // 练习模式：先清空，然后异步拉缓存。命中即填，没命中维持空。
      setTags([]);
      setRisks([]);
      setProjects([]);
      setSuggestions([]);
      setRawJson("");
      setIntelReady(false);
      setEvalCachedAt(null);
      setEvalStale(false);
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
              setIntelReady(!!data.intel);
              const ev = data.resume_eval;
              setEvalStale(!!data.resume_eval_stale);
              if (ev && !data.resume_eval_stale) {
                setTags(Array.isArray(ev.tags) ? ev.tags : []);
                setRisks(Array.isArray(ev.risks) ? ev.risks : []);
                setProjects(Array.isArray(ev.target_projects) ? ev.target_projects : []);
                setSuggestions(Array.isArray(ev.suggestions) ? ev.suggestions : []);
                setRawJson(ev.raw_json || "");
                setEvalCachedAt(data.resume_eval_at);
              }
            }
          } catch { /* 失败不阻塞用户重新生成 */ }
          finally { setCtxLoading(false); }
        })();
      }
    } else {
      setTags(session?.resume_tags || []);
      setRisks(session?.resume_risks || []);
      setProjects(session?.target_projects || []);
      // 切到模拟模式 / 切场次时也恢复对应 session 的 artifact，
      // 而不是无条件清空——这是 v1 版本"内容回来后变少"的根因。
      const a = session?.stage_artifacts?.["1"] || null;
      setSuggestions(a?.suggestions || []);
      setRawJson(a?.raw_json || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPractice, session?.id, company, position]);

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
      const data = await parseJsonResponse<any>(resp);
      if (!data.file_path) {
        toast.error("上传失败");
        return;
      }
      // 后端已自动覆盖 User.resume_file_path（主简历）和 PracticeProfile.resume_file_path。
      // 还需要把当前正在做的这场 InterviewSession.resume_file_path 也同步到新 PDF——
      // 不然 stage 2/3 注入简历时仍然用的是旧快照。
      if (isPractice) {
        await Promise.all([refetchUser(), loadProfile()]);
      } else if (session) {
        setSession({ ...session, resume_file_path: data.file_path });
        await Promise.all([
          fetch(`/interview/sessions/${session.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ resume_file_path: data.file_path }),
          }),
          refetchUser(),
        ]);
      }
      toast.success("主简历已更新");
    } catch (err) {
      console.error("PDF upload failed:", err);
      toast.error("简历上传失败");
    }
  };

  const handleAnalyze = async () => {
    if (!ready || !hasPdf) return;
    // 练习模式硬性依赖：没有面经画像就拦下，让简历评估能结合"这家公司爱考什么"
    if (isPractice && !intelReady) {
      toast.error("练习模式下简历评估要先有面试攻略，正在跳到 Stage 0…");
      setTimeout(() => navigate("/interview/practice/stage/0"), 600);
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    const settings = loadInterviewSettings();
    try {
      const token = localStorage.getItem("token");
      const endpoint = isPractice ? "/practice/chat" : "/interview/chat";
      const body = isPractice
        ? {
            stage: 1,
            message: "请基于附件 PDF 简历进行分析，按规定 JSON 格式输出。",
            model: "kimi-k2.6",
            difficulty: settings.difficulty,
            interviewer_style: settings.style,
          }
        : {
            session_id: session!.id,
            stage: 1,
            message: "请基于附件 PDF 简历进行分析，按规定 JSON 格式输出。",
            model: "kimi-k2.6",
            response_format: { type: "json_object" },
            difficulty: settings.difficulty,
            interviewer_style: settings.style,
          };
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      // 练习模式下后端 stage 1 缺面经也会返回 400 + practice_context_missing，
      // 这里也拦一层（万一前端 intelReady 状态 stale）
      if (!resp.ok && isPractice) {
        try {
          const errBody = await resp.clone().json();
          const detail = errBody?.detail;
          if (detail && typeof detail === "object" && detail.code === "practice_context_missing") {
            toast.error(detail.message || "请先完成面试攻略");
            setTimeout(() => navigate("/interview/practice/stage/0"), 600);
            return;
          }
        } catch { /* 解析失败走标准错误路径 */ }
      }

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
        toast.error("本次返回的格式异常，请重试");
        return;
      }
      const newTags = parsed.tags || parsed.技术标签 || [];
      const newRisks = parsed.risks || parsed.风险点 || [];
      const newProjects = parsed.target_projects || parsed.projects || parsed.核心项目 || [];
      const rawSuggestions = parsed.suggestions || parsed.修改建议 || [];
      const newSuggestions: ResumeSuggestion[] = Array.isArray(rawSuggestions)
        ? rawSuggestions
            .filter((s: any) => s && (s.rewrite || s.改写 || s.建议改写))
            .map((s: any) => ({
              original: s.original || s.原文 || "",
              issue: s.issue || s.问题 || "",
              rewrite: s.rewrite || s.改写 || s.建议改写 || "",
              category: s.category || s.分类 || "",
            }))
        : [];
      setTags(newTags);
      setRisks(newRisks);
      setProjects(newProjects);
      setSuggestions(newSuggestions);
      setRawJson(raw);

      // 持久化简历评估结果：
      // - 模拟模式 → InterviewSession.resume_tags/risks/target_projects + stage_artifacts["1"]
      // - 练习模式 → PracticeContext.resume_eval_json（按 (公司, 岗位) 缓存，
      //               让 stage 2 / stage 3 chat 能注入 resume_tags / target_projects 画像）
      if (!isPractice && session) {
        // 关键：suggestions 卡片 + rawJson 也一并存进 stage_artifacts["1"]，
        // 否则切走再回来 useState 销毁，前端面板会少一段（这正是 v1 的 bug）。
        const newArtifacts = {
          ...(session.stage_artifacts || {}),
          "1": { suggestions: newSuggestions, raw_json: raw },
        };
        const updated = {
          ...session,
          resume_tags: newTags,
          resume_risks: newRisks,
          target_projects: newProjects,
          stage_artifacts: newArtifacts,
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
            stage_artifacts: newArtifacts,
          }),
        }).catch((e) => {
          console.error("Persist resume analysis failed:", e);
          toast.warning("分析结果已生成，但同步到云端失败");
        });
      } else if (isPractice && company && position) {
        // 标注本地缓存时间，让"已缓存"状态立刻可见（不必等下次进入页面再 GET 一遍）
        setEvalCachedAt(new Date().toISOString());
        setEvalStale(false);
        const token2 = localStorage.getItem("token");
        fetch("/practice/context/resume-eval", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token2}` },
          body: JSON.stringify({
            company,
            position,
            resume_eval: {
              tags: newTags,
              risks: newRisks,
              target_projects: newProjects,
              score: parsed.score ?? null,
              suggestions: newSuggestions,
              raw_json: raw,
            },
          }),
        }).catch((e) => {
          console.error("Persist practice resume-eval failed:", e);
          toast.warning("评估结果已生成，但同步到云端失败（不影响本次查看，但 stage 2/3 仍会提示需要简历评估）");
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

  const handleTakeNotes = () => {
    const summaryParts: string[] = [];
    if (tags.length) summaryParts.push(`> 提取标签：${tags.slice(0, 8).join(" · ")}`);
    if (risks.length) summaryParts.push(`> 风险点：${risks.slice(0, 3).join(" / ")}`);
    if (suggestions.length) summaryParts.push(`> 共生成 ${suggestions.length} 条修改建议`);
    const summary = summaryParts.length ? summaryParts.join("\n") + "\n\n" : "";
    const template = `# ${company} · ${position} · 简历复盘\n\n${summary}## 我决定改的简历内容\n- \n\n## 我担心被深挖的点\n- \n\n## 还要补的项目细节\n- \n`;
    navigate("/journal/new", {
      state: {
        title: `${company} · ${position} · 简历复盘`,
        content: template,
        mode: isPractice ? "practice" : "simulation",
        stage: 1,
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
              {isPractice ? "请先在练习入口填写目标信息" : "场次加载失败"}
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
            <h2 className="text-[14px] font-medium text-fg">简历评估</h2>
            <p className="text-[12px] text-fg-subtle mt-1 leading-relaxed">
              上传 PDF 简历，自动拆解出：
              <br />· 你的技术标签
              <br />· 简历上可能被深挖的项目
              <br />· 措辞 / 表述上的风险点（带改写建议）
            </p>
            <p className="text-[10.5px] text-fg-subtle mt-2 leading-relaxed">
              PDF 仅用于本次分析，仅本人可见
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
              className="w-full flex flex-col items-center justify-center gap-2 px-4 py-8 border border-dashed border-border bg-overlay rounded-lg hover:border-accent transition-colors"
            >
              <Upload size={20} className="text-fg-subtle" strokeWidth={1.5} />
              <span className="text-[12px] text-fg-subtle">点击上传 PDF 简历</span>
            </button>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 border border-accent/40 bg-accent/10 rounded-lg text-[12px] text-accent">
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

          {/* 练习模式硬性依赖：先有面经画像 → 评估才能结合"这家公司视角"，否则就是通用评估 */}
          {isPractice && !ctxLoading && !intelReady && (
            <div className="px-3 py-2 border border-warn/40 bg-warn/10 rounded-lg text-[11.5px] text-warn leading-relaxed">
              <div className="flex items-center gap-1.5 mb-1 font-medium">
                <AlertCircle size={11} strokeWidth={1.5} />
                需要先完成面试攻略
              </div>
              <p className="mb-2">练习模式下，简历评估会结合「{company} · {position}」的面经画像，给出更针对性的建议（哪些薄弱项是这家公司高频考点）。</p>
              <button
                type="button"
                onClick={() => navigate("/interview/practice/stage/0")}
                className="inline-flex items-center gap-1 text-warn hover:text-accent transition-colors font-mono uppercase tracking-[0.12em] text-[10.5px]"
              >
                <Globe2 size={11} strokeWidth={1.5} /> 去 Stage 0 · 面试攻略 <ArrowRight size={11} />
              </button>
            </div>
          )}

          {/* 缓存命中提示 / 简历过期提示 */}
          {isPractice && evalCachedAt && !loading && !evalStale && (
            <div className="px-3 py-2 border border-accent/40 bg-accent/10 rounded-lg text-[11.5px] text-accent leading-relaxed">
              已缓存 · {formatRelTime(evalCachedAt)} · 直接看右侧结果即可
            </div>
          )}
          {isPractice && evalStale && !loading && (
            <div className="px-3 py-2 border border-warn/40 bg-warn/10 rounded-lg text-[11.5px] text-warn leading-relaxed">
              主简历已变更，请重新评估以保证 stage 2/3 注入的靶子还是当前简历的项目
            </div>
          )}

          {ctxLoading && (
            <div className="text-[11px] text-fg-subtle font-mono flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin" /> CHECKING CACHE...
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading || !hasPdf || (isPractice && !intelReady)}
            className="w-full h-9 flex items-center justify-center gap-2 border border-accent text-accent text-[12px] uppercase tracking-[0.12em] rounded-lg hover:bg-accent hover:text-white transition-colors disabled:opacity-40"
          >
            {loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isPractice && (evalCachedAt || evalStale) ? (
              <><RefreshCw size={13} strokeWidth={1.5} /> {evalStale ? "重新评估（简历已变更）" : "重新评估简历"}</>
            ) : (
              <>分析简历 <ArrowRight size={14} /></>
            )}
          </button>

          {tags.length > 0 && !loading && (
            <button
              onClick={handleTakeNotes}
              className="w-full h-9 flex items-center justify-center gap-2 border border-border text-fg-muted text-[12px] uppercase tracking-[0.12em] rounded-lg hover:border-accent hover:text-accent transition-colors"
            >
              <NotebookPen size={13} strokeWidth={1.5} />
              记笔记
            </button>
          )}

          {!isPractice && tags.length > 0 && !loading && (
            <button
              onClick={handleNextStage}
              className="w-full h-9 flex items-center justify-center gap-2 border border-accent bg-accent text-white text-[12px] uppercase tracking-[0.12em] rounded-lg hover:opacity-90 transition-opacity"
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
                  <span key={t} className="px-2 py-1 text-[12px] border border-border bg-elevated rounded-lg">{t}</span>
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

          {suggestions.length > 0 && (
            <div>
              <h3 className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted mb-3 flex items-center gap-2">
                <span>简历修改建议</span>
                <span className="text-fg-subtle">{String(suggestions.length).padStart(2, "0")}</span>
              </h3>
              <ol className="space-y-3">
                {suggestions.map((s, i) => (
                  <SuggestionCard key={i} index={i} item={s} />
                ))}
              </ol>
            </div>
          )}

          {rawJson && tags.length > 0 && (
            <FollowUpChat
              endpoint={isPractice ? "/practice/chat" : "/interview/chat"}
              stage={1}
              sessionId={isPractice ? null : (sessionId ?? null)}
              initialReport={rawJson}
              initialUserMessage="请基于附件 PDF 简历进行分析，按规定 JSON 格式输出。"
              placeholder="围绕简历分析继续追问，例如：第 2 条建议能再激进点吗？"
            />
          )}

          {tags.length === 0 && !loading && (
            <div className="h-full flex items-center justify-center text-fg-subtle text-[12px]">
              {hasPdf ? "点击「分析简历」开始拆解这份简历" : "请先上传 PDF 简历"}
            </div>
          )}
        </section>
      </div>
    </InterviewLayout>
  );
}

function SuggestionCard({ index, item }: { index: number; item: ResumeSuggestion }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(item.rewrite);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // 部分浏览器在非 https 下没有 clipboard API，静默失败即可
    }
  };
  return (
    <li className="border border-border rounded-md bg-elevated">
      <div className="h-8 px-3 flex items-center justify-between border-b border-border">
        <span className="text-[12px] font-medium tracking-wide text-fg-subtle">
          [ #{String(index + 1).padStart(2, "0")} ]
          {item.category && <span className="ml-2 text-accent">· {item.category}</span>}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[12px] font-medium tracking-wide text-fg-subtle hover:text-accent transition-colors"
          title="复制改写后的版本"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>
      <div className="p-3 space-y-2.5">
        {item.original && (
          <div>
            <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-fg-subtle mb-1">
              ORIGINAL
            </div>
            <div className="text-[12.5px] text-fg-muted line-through decoration-fg-subtle/40 leading-relaxed">
              {item.original}
            </div>
          </div>
        )}
        {item.issue && (
          <div>
            <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-error/80 mb-1">
              ISSUE
            </div>
            <div className="text-[12.5px] text-error leading-relaxed">{item.issue}</div>
          </div>
        )}
        <div>
          <div className="text-[10.5px] font-mono uppercase tracking-[0.12em] text-accent mb-1">
            REWRITE
          </div>
          <div className="text-[13.5px] text-fg leading-relaxed font-medium">
            {item.rewrite}
          </div>
        </div>
      </div>
    </li>
  );
}
