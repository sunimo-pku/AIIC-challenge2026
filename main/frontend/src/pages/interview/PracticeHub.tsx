import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { usePractice } from "@/contexts/PracticeContext";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, ArrowRight, Upload, Check, Briefcase, History } from "lucide-react";
import { parseJsonResponse } from "@/lib/api";

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

            {/* STAGES 5 关入口 */}
            <section className="border border-border rounded-md bg-elevated">
              <div className="h-8 px-3 flex items-center justify-between border-b border-border text-[12px] font-medium tracking-wide text-fg-subtle">
                <span>STAGES</span>
                <span>[ 05 / 05 ]</span>
              </div>
              <div className="p-4 grid gap-3 grid-cols-1 sm:grid-cols-2">
                {STAGE_DEFS.map((s, i) => (
                  <button
                    key={s.name}
                    type="button"
                    disabled={!ready}
                    onClick={() => navigate(`/interview/practice/stage/${i}`)}
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
                  </button>
                ))}
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
  );
}
