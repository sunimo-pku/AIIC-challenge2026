import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { usePractice } from "@/contexts/PracticeContext";
import { useToast } from "@/components/ToastProvider";
import { ArrowLeft, ArrowRight, Upload, Check, Briefcase, History } from "lucide-react";

const PRESET_COMPANIES = ["字节跳动", "阿里巴巴", "腾讯", "美团", "快手", "百度", "拼多多", "小红书"];
const ROLES = ["后端开发", "前端开发", "算法工程师", "客户端开发", "数据研发"];

const STAGE_DEFS = [
  { name: "面试攻略", desc: "联网生成定制化面经报告" },
  { name: "简历评估", desc: "解析 PDF 提取技术栈与风险点" },
  { name: "技术面", desc: "八股原理 + 项目深挖，连续追问" },
  { name: "情景面", desc: "场景冲突 + STAR 行为面交替" },
  { name: "总结", desc: "综合评分与录用建议" },
];

export default function PracticeHub() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile, loaded, updateProfile } = usePractice();
  const [company, setCompany] = useState(profile.company);
  const [position, setPosition] = useState(profile.position);
  const [resumeName, setResumeName] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [logCount, setLogCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompany(profile.company);
    setPosition(profile.position);
    if (profile.resume_file_path) {
      const parts = profile.resume_file_path.split("/");
      setResumeName(parts[parts.length - 1]);
    } else {
      setResumeName("");
    }
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
    setResumeName(file.name);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await resp.json();
      if (data.file_path) {
        await updateProfile({ resume_file_path: data.file_path });
        toast.success("简历上传成功");
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
                className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle hover:text-accent transition-colors"
              >
                <ArrowLeft size={12} /> [ MISSION SELECT ]
              </button>
              <h1 className="font-display text-[28px] tracking-[0.04em]">
                PRACTICE.MODE
              </h1>
              <p className="text-[13px] text-fg-muted">
                单关精练 · 5 关任选 · 不带前序记录
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-fg-subtle uppercase tracking-[0.12em]">
              <History size={12} />
              <span>历史留档 [ {logCount === null ? "--" : logCount} ]</span>
            </div>
          </header>

          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            {/* TARGET 表单 */}
            <section className="border border-border rounded-md bg-elevated h-fit">
              <div className="h-8 px-3 flex items-center justify-between border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
                <span>[ TARGET ]</span>
                <span>{loaded ? (ready ? "[ READY ]" : "[ DRAFT ]") : "[ LOADING ]"}</span>
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
                    简历 PDF（可选）
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
                    <span className="truncate">{resumeName || "上传 PDF"}</span>
                  </button>
                </div>

                {/* Save */}
                <button
                  onClick={handleSave}
                  className="w-full h-9 flex items-center justify-center gap-2 border border-accent text-accent font-mono text-[12px] uppercase tracking-[0.12em] hover:bg-accent hover:text-bg transition-colors rounded-sm"
                >
                  {savedFlash ? <><Check size={13} /> SAVED</> : <>SAVE TARGET <ArrowRight size={13} /></>}
                </button>
              </div>
            </section>

            {/* STAGES 5 关入口 */}
            <section className="border border-border rounded-md bg-elevated">
              <div className="h-8 px-3 flex items-center justify-between border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
                <span>[ STAGES ]</span>
                <span>[ 05 / 05 ]</span>
              </div>
              <div className="p-4 grid gap-3 grid-cols-1 sm:grid-cols-2">
                {STAGE_DEFS.map((s, i) => (
                  <button
                    key={s.name}
                    type="button"
                    disabled={!ready}
                    onClick={() => navigate(`/interview/practice/stage/${i}`)}
                    className="text-left border border-border rounded-sm p-4 hover:border-accent hover:bg-overlay transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle group-hover:text-accent">
                        [ {String(i).padStart(2, "0")} · {s.name.toUpperCase()} ]
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
                  [ TARGET REQUIRED ] 先在左侧填写公司与岗位才能进入任意关卡
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
