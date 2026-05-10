import { useState, useRef, useEffect } from "react";
import { useInterview } from "@/contexts/InterviewContext";
import { ChevronDown, ChevronUp, FileText, Save, Upload, Plus, History } from "lucide-react";

const PRESET_COMPANIES = [
  "字节跳动",
  "阿里巴巴",
  "腾讯",
  "美团",
  "快手",
  "百度",
  "拼多多",
  "小红书",
];

const ROLES = [
  { value: "后端开发", label: "后端开发 (Backend)" },
  { value: "前端开发", label: "前端开发 (Frontend)" },
  { value: "算法工程师", label: "算法工程师 (Algorithm)" },
  { value: "客户端开发", label: "客户端开发 (Mobile/Client)" },
  { value: "数据研发", label: "数据研发 (Data Engineer)" },
];

export function InterviewSidebar() {
  const { session, sessions, setSession, selectSession, loadSessions } = useInterview();
  const [expanded, setExpanded] = useState(false);
  const [company, setCompany] = useState(session?.company || "");
  const [position, setPosition] = useState(session?.position || "");
  const [resumeText, setResumeText] = useState(session?.resume_text || "");
  const [resumeFileName, setResumeFileName] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showSessionDropdown, setShowSessionDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sessionDropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompany(session?.company || "");
    setPosition(session?.position || "");
    setResumeText(session?.resume_text || "");
  }, [session]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowCompanyDropdown(false);
      }
      if (sessionDropdownRef.current && !sessionDropdownRef.current.contains(e.target as Node)) {
        setShowSessionDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredCompanies = PRESET_COMPANIES.filter(
    (c) => c.toLowerCase().includes(company.toLowerCase()) && c !== company
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeFileName(file.name);
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
      if (data.content) {
        setResumeText(data.content);
      }
    } catch (err) {
      console.error("PDF upload failed:", err);
    }
  };

  const handleSave = async () => {
    if (!company || !position) return;
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      let sessionId = session?.id;

      if (!sessionId) {
        const resp = await fetch("/interview/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ company, position }),
        });
        const data = await resp.json();
        sessionId = data.id;
        if (resumeText) {
          await fetch(`/interview/sessions/${sessionId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              stage: 0,
              resume_text: resumeText,
            }),
          });
        }
        await loadSessions();
      } else {
        await fetch(`/interview/sessions/${sessionId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            stage: session?.current_stage ?? 0,
            resume_text: resumeText,
          }),
        });
      }

      setSession({
        id: sessionId as number,
        company,
        position,
        current_stage: session?.current_stage ?? 0,
        intel_report: session?.intel_report || {},
        resume_text: resumeText,
        resume_tags: session?.resume_tags || [],
        resume_risks: session?.resume_risks || [],
        target_projects: session?.target_projects || [],
        stage_histories: session?.stage_histories || {},
        scores: session?.scores || {},
        weaknesses: session?.weaknesses || {},
      });
    } finally {
      setSaving(false);
    }
  };

  const handleNewSession = async () => {
    setCompany("");
    setPosition("");
    setResumeText("");
    setResumeFileName("");
    setSession(null);
  };

  return (
    <aside className="hidden lg:flex w-[260px] shrink-0 border-r border-border flex-col bg-bg">
      {/* Session selector */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="relative flex-1" ref={sessionDropdownRef}>
          <button
            onClick={() => setShowSessionDropdown(!showSessionDropdown)}
            className="w-full flex items-center justify-between text-[12px] text-fg truncate"
          >
            <span className="flex items-center gap-1.5">
              <History size={12} className="text-fg-muted shrink-0" />
              <span className="truncate">
                {session ? `${session.company} · ${session.position}` : "选择场次"}
              </span>
            </span>
            <ChevronDown size={12} className="text-fg-muted shrink-0" />
          </button>
          {showSessionDropdown && (
            <div className="absolute z-20 w-full mt-1 bg-elevated border border-border rounded-sm shadow-lg max-h-48 overflow-y-auto">
              <button
                onClick={() => { handleNewSession(); setShowSessionDropdown(false); }}
                className="w-full text-left px-3 py-2 text-[12px] text-accent hover:bg-overlay transition-colors flex items-center gap-1.5"
              >
                <Plus size={12} /> 新建场次
              </button>
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { selectSession(s.id); setShowSessionDropdown(false); }}
                  className={`w-full text-left px-3 py-2 text-[12px] hover:bg-overlay transition-colors ${
                    session?.id === s.id ? "bg-overlay text-fg" : "text-fg-subtle"
                  }`}
                >
                  <div className="truncate">{s.company} · {s.position}</div>
                  <div className="text-[10px] text-fg-muted mt-0.5">Stage {s.current_stage}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary header */}
      <div
        className="px-4 py-3 border-b border-border cursor-pointer flex items-center justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="min-w-0">
          <div className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted">面试设置</div>
          <div className="text-[13px] text-fg truncate mt-0.5">
            {session?.company || "未设置"} · {session?.position || "未设置"}
          </div>
        </div>
        {expanded ? <ChevronUp size={14} className="text-fg-subtle shrink-0" /> : <ChevronDown size={14} className="text-fg-subtle shrink-0" />}
      </div>

      {/* Expandable form */}
      {expanded && (
        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Company Combobox */}
          <div className="space-y-1" ref={dropdownRef}>
            <label className="block text-[11px] text-fg-muted uppercase tracking-[0.12em] font-mono">目标公司</label>
            <div className="relative">
              <input
                value={company}
                onChange={(e) => {
                  setCompany(e.target.value);
                  setShowCompanyDropdown(true);
                }}
                onFocus={() => setShowCompanyDropdown(true)}
                className="w-full bg-overlay border border-border rounded-sm px-3 py-2 text-[13px] outline-none focus:border-accent"
                placeholder="输入或选择公司"
              />
              {showCompanyDropdown && filteredCompanies.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-elevated border border-border rounded-sm shadow-lg max-h-40 overflow-y-auto">
                  {filteredCompanies.map((c) => (
                    <button
                      key={c}
                      className="w-full text-left px-3 py-1.5 text-[13px] hover:bg-overlay transition-colors"
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

          {/* Role Select */}
          <div className="space-y-1">
            <label className="block text-[11px] text-fg-muted uppercase tracking-[0.12em] font-mono">目标岗位</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full bg-overlay border border-border rounded-sm px-3 py-2 text-[13px] outline-none focus:border-accent appearance-none"
            >
              <option value="">选择岗位</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Resume Upload */}
          <div className="space-y-1">
            <label className="block text-[11px] text-fg-muted uppercase tracking-[0.12em] font-mono">简历（PDF）</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-2 px-3 py-2 border border-border bg-overlay rounded-sm text-[13px] text-fg-subtle hover:text-fg hover:border-accent transition-colors"
            >
              <Upload size={14} />
              {resumeFileName || (resumeText ? "已上传" : "上传 PDF")}
            </button>
            {resumeText && (
              <div className="text-[11px] text-fg-subtle line-clamp-3">
                {resumeText.slice(0, 120)}…
              </div>
            )}
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !company || !position}
            className="w-full h-8 flex items-center justify-center gap-2 bg-accent text-bg text-[11px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent/90 transition-colors disabled:opacity-40"
          >
            {saving ? "保存中…" : <><Save size={12} /> 保存</>}
          </button>
        </div>
      )}

      {/* Resume summary when collapsed */}
      {!expanded && session?.resume_text && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 text-[12px] text-fg-subtle">
            <FileText size={12} />
            <span className="truncate">简历已上传</span>
          </div>
        </div>
      )}
    </aside>
  );
}
