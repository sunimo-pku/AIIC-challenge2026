import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { usePractice } from "@/contexts/PracticeContext";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, ArrowRight, Upload, Check, Briefcase, History, AlertCircle, FileText, Globe2, RefreshCw } from "lucide-react";
import { parseJsonResponse } from "@/lib/api";

interface PracticeContextView {
  intel: any | null;
  intel_at: string | null;
  resume_eval: any | null;
  resume_eval_at: string | null;
  resume_path_at_eval?: string;
  resume_eval_stale?: boolean;
}

function formatRelTime(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

const PRESET_COMPANIES = ["字节跳动", "阿里巴巴", "腾讯", "美团", "快手", "百度", "拼多多", "小红书"];
const ROLES = ["后端开发", "前端开发", "算法工程师", "客户端开发", "数据研发"];

const STAGE_DEFS = [
  { name: "面试攻略", desc: "这家公司这个岗位最近怎么考" },
  { name: "简历评估", desc: "拆解你的简历，找出会被深挖的点" },
  { name: "技术面", desc: "原理八股 + 项目深挖，被追问到底" },
  { name: "情景面", desc: "突发场景题 + STAR 法答题" },
  { name: "总结", desc: "综合评分与录用建议（仅模拟模式）" },
];

export default function PracticeHub() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile, loaded, updateProfile, loadProfile } = usePractice();
  const { refetchUser } = useAuth();
  const [company, setCompany] = useState(profile.company);
  const [position, setPosition] = useState(profile.position);
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [logCount, setLogCount] = useState<number | null>(null);
  const [ctxView, setCtxView] = useState<PracticeContextView | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // profile.resume_file_path 来自后端 GET /practice/profile：自身为空时会回退 User.resume_file_path，
  // 因此这里直接派生即可，不再需要 useState 维护一份本地拷贝。
  const resumeName = profile.resume_file_path
    ? profile.resume_file_path.split("/").pop() || ""
    : "";

  useEffect(() => {
    setCompany(profile.company);
    setPosition(profile.position);
  }, [profile]);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        const resp = await fetch("/practice/logs", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok) {
          const data = await resp.json();
          setLogCount(Array.isArray(data) ? data.length : 0);
        }
      } catch {
        setLogCount(0);
      }
    })();
  }, []);

  // 拉取当前 (公司, 岗位) 维度的画像缓存：面经 + 简历评估
  // - 没填公司岗位 / 还没保存 → 不查
  // - 简历换过（resume_eval_stale=true）→ banner 提示重做
  const loadContext = async () => {
    if (!profile.company || !profile.position) {
      setCtxView(null);
      return;
    }
    setCtxLoading(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(
        `/practice/context?company=${encodeURIComponent(profile.company)}&position=${encodeURIComponent(profile.position)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (resp.ok) {
        const data = await resp.json();
        setCtxView(data);
      } else {
        setCtxView(null);
      }
    } catch {
      setCtxView(null);
    } finally {
      setCtxLoading(false);
    }
  };

  useEffect(() => {
    loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.company, profile.position, profile.resume_file_path]);

  const filteredCompanies = PRESET_COMPANIES.filter(
    (c) => c.toLowerCase().includes(company.toLowerCase()) && c !== company
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await parseJsonResponse<any>(resp);
      if (data.file_path) {
        // 后端已同步覆盖 User.resume_file_path 和 PracticeProfile.resume_file_path。
        // 双 refetch 让 useAuth + PracticeContext 都拿到新路径；其他页面下次进来也是最新的。
        await Promise.all([refetchUser(), loadProfile()]);
        toast.success("主简历已更新");
      }
    } catch {
      toast.error("简历上传失败");
    }
  };

  const handleSave = async () => {
    if (!company.trim() || !position.trim()) {
      toast.warning("请先填写公司与岗位");
      return;
    }
    await updateProfile({ company: company.trim(), position: position.trim() });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1200);
  };

  const ready = !!profile.company && !!profile.position;
  const intelReady = !!ctxView?.intel;
  const resumeEvalReady = !!ctxView?.resume_eval && !ctxView?.resume_eval_stale;
  const targetingReady = ready && intelReady && resumeEvalReady;

  return (
    <div className="h-screen flex flex-col bg-bg text-fg">
      <TopBar />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-10 space-y-8">
          {/* 头部 */}
          <header className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <button
                onClick={() => navigate("/interview")}
                className="inline-flex items-center gap-1 text-[12px] font-medium tracking-wide text-fg-subtle hover:text-accent transition-colors"
              >
                <ArrowLeft size={12} /> MISSION SELECT
              </button>
              <h1 className="font-display text-[28px] tracking-[0.04em]">
                PRACTICE.MODE
              </h1>
              <p className="text-[13px] text-fg-muted">
                单关精练 · 5 关任选 · 每次独立计分
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-fg-subtle uppercase tracking-[0.12em]">
              <History size={12} />
              <span>练习历史 {logCount === null ? "--" : logCount}</span>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            {/* TARGET 表单 */}
            <section className="border border-border rounded-md bg-elevated h-fit">
              <div className="h-8 px-3 flex items-center justify-between border-b border-border text-[12px] font-medium tracking-wide text-fg-subtle">
                <span>TARGET</span>
                <span>{loaded ? (ready ? "READY" : "DRAFT") : "LOADING"}</span>
              </div>
              <div className="p-4 space-y-4">
                {/* Company */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-fg-subtle uppercase tracking-[0.12em]">
                    目标公司
                  </label>
                  <div className="relative">
                    <input
                      value={company}
                      onChange={(e) => {
                        setCompany(e.target.value);
                        setShowCompanyDropdown(true);
                      }}
                      onFocus={() => setShowCompanyDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 150)}
                      className="w-full bg-overlay border border-border px-2.5 py-2 text-[13px] outline-none focus:border-accent rounded"
                      placeholder="输入或选择公司"
                    />
                    {showCompanyDropdown && filteredCompanies.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-elevated border border-border max-h-40 overflow-y-auto rounded">
                        {filteredCompanies.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className="w-full text-left px-2.5 py-1.5 text-[12.5px] hover:bg-overlay transition-colors"
                            onClick={() => {
                              setCompany(c);
                              setShowCompanyDropdown(false);
                            }}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Role */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-fg-subtle uppercase tracking-[0.12em]">
                    目标岗位
                  </label>
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full bg-overlay border border-border px-2.5 py-2 text-[13px] outline-none focus:border-accent rounded appearance-none"
                  >
                    <option value="">选择岗位</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Resume */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-fg-subtle uppercase tracking-[0.12em]">
                    主简历 PDF
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2 px-2.5 py-2 border border-border bg-overlay text-[13px] text-fg-subtle hover:text-fg hover:border-accent transition-colors rounded"
                  >
                    <Upload size={13} />
                    <span className="truncate">{resumeName || "上传主简历"}</span>
                  </button>
                  <p className="text-[10.5px] text-fg-subtle leading-relaxed">
                    每个账号一份主简历，模拟模式 / 练习模式共享，重新上传即替换
                  </p>
                </div>

                {/* Save */}
                <button
                  onClick={handleSave}
                  className="w-full h-9 flex items-center justify-center gap-2 border border-accent text-accent text-[13px] font-medium tracking-wide hover:bg-accent hover:text-white transition-colors rounded-lg"
                >
                  {savedFlash ? <><Check size={13} /> SAVED</> : <>SAVE TARGET <ArrowRight size={13} /></>}
                </button>
              </div>
            </section>

            <div className="space-y-6">
              {/* PRIMING 画像卡片：技术面 / 情景面前置依赖 */}
              {ready && (
                <section className="border border-border rounded-md bg-elevated">
                  <div className="h-8 px-3 flex items-center justify-between border-b border-border text-[12px] font-medium tracking-wide text-fg-subtle">
                    <span>PRIMING · 技术面 / 情景面前置画像</span>
                    <button
                      type="button"
                      onClick={loadContext}
                      disabled={ctxLoading}
                      className="flex items-center gap-1 text-[10.5px] text-fg-subtle hover:text-accent transition-colors disabled:opacity-40 font-mono"
                      title="重新拉取缓存状态"
                    >
                      <RefreshCw size={10} className={ctxLoading ? "animate-spin" : ""} /> REFRESH
                    </button>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-[11.5px] text-fg-subtle leading-relaxed">
                      技术面 / 情景面会按 <span className="text-fg">{profile.company} · {profile.position}</span> 的画像出题。
                      请先完成下面两块（按 (公司, 岗位) 缓存，下次进入会复用，不用重做）：
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* 面经画像 */}
                      <button
                        type="button"
                        onClick={() => navigate("/interview/practice/stage/0")}
                        className={`text-left border rounded-lg p-3 transition-colors duration-150 group ${
                          intelReady ? "border-accent/40 hover:border-accent" : "border-warn/40 hover:border-warn"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.12em] uppercase">
                            <Globe2 size={11} strokeWidth={1.5} />
                            INTEL
                          </span>
                          {intelReady ? (
                            <span className="flex items-center gap-1 text-[11px] text-accent font-mono"><Check size={11} /> READY</span>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] text-warn font-mono"><AlertCircle size={11} /> NEEDED</span>
                          )}
                        </div>
                        <div className="text-[13px] text-fg font-medium">面试攻略</div>
                        <div className="text-[11.5px] text-fg-subtle mt-0.5">
                          {intelReady ? `已缓存 · ${formatRelTime(ctxView?.intel_at ?? null)}` : "去 Stage 0 跑一次攻略"}
                        </div>
                      </button>
                      {/* 简历评估画像 */}
                      <button
                        type="button"
                        onClick={() => navigate("/interview/practice/stage/1")}
                        className={`text-left border rounded-lg p-3 transition-colors duration-150 group ${
                          resumeEvalReady ? "border-accent/40 hover:border-accent" : "border-warn/40 hover:border-warn"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="flex items-center gap-1.5 font-mono text-[11px] tracking-[0.12em] uppercase">
                            <FileText size={11} strokeWidth={1.5} />
                            RESUME
                          </span>
                          {resumeEvalReady ? (
                            <span className="flex items-center gap-1 text-[11px] text-accent font-mono"><Check size={11} /> READY</span>
                          ) : ctxView?.resume_eval_stale ? (
                            <span className="flex items-center gap-1 text-[11px] text-warn font-mono"><AlertCircle size={11} /> STALE</span>
                          ) : (
                            <span className="flex items-center gap-1 text-[11px] text-warn font-mono"><AlertCircle size={11} /> NEEDED</span>
                          )}
                        </div>
                        <div className="text-[13px] text-fg font-medium">简历评估</div>
                        <div className="text-[11.5px] text-fg-subtle mt-0.5">
                          {ctxView?.resume_eval_stale
                            ? "主简历已变更，请重做评估"
                            : resumeEvalReady
                              ? `已缓存 · ${formatRelTime(ctxView?.resume_eval_at ?? null)}`
                              : "去 Stage 1 跑一次评估"}
                        </div>
                      </button>
                    </div>
                    {targetingReady && (
                      <div className="text-[11px] font-mono text-accent">
                        TARGETING READY · 技术面 / 情景面会精准结合这家公司面经 + 你的简历靶子出题
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* STAGES 5 关入口 */}
              <section className="border border-border rounded-md bg-elevated">
                <div className="h-8 px-3 flex items-center justify-between border-b border-border text-[12px] font-medium tracking-wide text-fg-subtle">
                  <span>STAGES</span>
                  <span>[ 05 / 05 ]</span>
                </div>
                <div className="p-4 grid gap-3 grid-cols-1 sm:grid-cols-2">
                  {STAGE_DEFS.map((s, i) => {
                    const needsPriming = i === 2 || i === 3;
                    const blocked = !ready || (needsPriming && !targetingReady);
                    const blockedReason = !ready
                      ? "先填公司岗位"
                      : needsPriming && !intelReady && !resumeEvalReady
                        ? "需要先完成攻略 + 简历评估"
                        : needsPriming && !intelReady
                          ? "需要先完成面试攻略"
                          : needsPriming && !resumeEvalReady
                            ? (ctxView?.resume_eval_stale ? "主简历已变更，请重做简历评估" : "需要先完成简历评估")
                            : "";
                    return (
                      <button
                        key={s.name}
                        type="button"
                        disabled={blocked}
                        onClick={() => navigate(`/interview/practice/stage/${i}`)}
                        title={blocked ? blockedReason : undefined}
                        className="text-left border border-border rounded-lg p-4 hover:border-accent hover:bg-overlay transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[12px] font-medium tracking-wide text-fg-subtle group-hover:text-accent">
                            [ {String(i + 1).padStart(2, "0")} · {s.name.toUpperCase()} ]
                          </span>
                          <Briefcase size={12} className="text-fg-muted" strokeWidth={1.5} />
                        </div>
                        <div className="text-[14.5px] text-fg font-medium">{s.name}</div>
                        <p className="text-[12px] text-fg-subtle mt-1 leading-relaxed">{s.desc}</p>
                        {blocked && needsPriming && (
                          <div className="mt-2 text-[10.5px] text-warn font-mono uppercase tracking-[0.12em]">
                            {blockedReason}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                {!ready && (
                  <div className="px-4 pb-4 text-[11.5px] font-mono text-fg-subtle">
                    TARGET REQUIRED 先在左侧填写公司与岗位才能进入任意关卡
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
