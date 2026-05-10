import { useState, useRef, useEffect } from "react";
import { useInterview } from "@/contexts/InterviewContext";
import { Save, Upload, Plus, History } from "lucide-react";

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
  { value: "后端开发", label: "后端开发" },
  { value: "前端开发", label: "前端开发" },
  { value: "算法工程师", label: "算法工程师" },
  { value: "客户端开发", label: "客户端开发" },
  { value: "数据研发", label: "数据研发" },
];

export function InterviewSidebar() {
  const { session, sessions, setSession, selectSession, loadSessions } = useInterview();
  const [company, setCompany] = useState(session?.company || "");
  const [position, setPosition] = useState(session?.position || "");
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
    if (session?.resume_file_path) {
      const parts = session.resume_file_path.split("/");
      setResumeFileName(parts[parts.length - 1]);
    } else {
      setResumeFileName("");
    }
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
      if (!data.file_path) return;

      // Update local state immediately
      if (session) {
        setSession({ ...session, resume_file_path: data.file_path });
      }

      // Persist to backend immediately (even if no session yet, save to pending)
      if (session?.id) {
        await fetch(`/interview/sessions/${session.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            stage: session.current_stage,
            resume_file_path: data.file_path,
          }),
        });
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
        // If PDF was uploaded before session creation, sync it now
        if (session?.resume_file_path) {
          await fetch(`/interview/sessions/${sessionId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              stage: 0,
              resume_file_path: session.resume_file_path,
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
            resume_file_path: session?.resume_file_path || "",
          }),
        });
      }

      setSession({
        id: sessionId as number,
        company,
        position,
        current_stage: session?.current_stage ?? 0,
        intel_report: session?.intel_report || {},
        resume_text: session?.resume_text || "",
        resume_tags: session?.resume_tags || [],
        resume_risks: session?.resume_risks || [],
        target_projects: session?.target_projects || [],
        stage_histories: session?.stage_histories || {},
        scores: session?.scores || {},
        weaknesses: session?.weaknesses || {},
        stage_reviews: session?.stage_reviews || {},
        resume_file_path: session?.resume_file_path || "",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleNewSession = () => {
    setCompany("");
    setPosition("");
    setResumeFileName("");
    setSession(null);
  };

  return (
    <aside className="hidden lg:flex w-[220px] shrink-0 border-r border-border flex-col overflow-y-auto p-4 gap-4 bg-bg">
      {/* Session selector */}
      <div className="space-y-2">
        <div className="text-[11px] font-mono text-fg-subtle uppercase tracking-[0.12em] flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <History size={12} />
            场次
          </span>
          <button
            onClick={handleNewSession}
            className="flex items-center gap-1 px-2 py-0.5 border border-accent text-accent text-[10px] hover:bg-accent hover:text-bg transition-colors"
          >
            <Plus size={10} />
            新建
          </button>
        </div>
        <div className="relative" ref={sessionDropdownRef}>
          <button
            onClick={() => setShowSessionDropdown(!showSessionDropdown)}
            className="w-full text-left px-2 py-1.5 text-[12px] border border-border bg-overlay text-fg hover:border-fg-subtle/50 transition-colors truncate"
          >
            {session ? `${session.company} · ${session.position}` : "选择场次…"}
          </button>
          {showSessionDropdown && (
            <div className="absolute z-20 w-full mt-1 bg-elevated border border-border shadow-lg max-h-40 overflow-y-auto">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { selectSession(s.id); setShowSessionDropdown(false); }}
                  className={`w-full text-left px-2 py-1.5 text-[12px] hover:bg-overlay transition-colors ${
                    session?.id === s.id ? "bg-overlay text-fg" : "text-fg-subtle"
                  }`}
                >
                  <div className="truncate">{s.company} · {s.position}</div>
                  <div className="text-[10px] text-fg-muted mt-0.5">Stage {s.current_stage}</div>
                </button>
              ))}
              {sessions.length === 0 && (
                <div className="text-[11px] text-fg-subtle text-center py-2">暂无场次</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Company */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-mono text-fg-subtle uppercase tracking-[0.12em]">目标公司</label>
        <div className="relative" ref={dropdownRef}>
          <input
            value={company}
            onChange={(e) => {
              setCompany(e.target.value);
              setShowCompanyDropdown(true);
            }}
            onFocus={() => setShowCompanyDropdown(true)}
            className="w-full bg-overlay border border-border px-2 py-1.5 text-[12px] outline-none focus:border-accent"
            placeholder="输入或选择"
          />
          {showCompanyDropdown && filteredCompanies.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-elevated border border-border shadow-lg max-h-32 overflow-y-auto">
              {filteredCompanies.map((c) => (
                <button
                  key={c}
                  className="w-full text-left px-2 py-1 text-[12px] hover:bg-overlay transition-colors"
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
        <label className="text-[11px] font-mono text-fg-subtle uppercase tracking-[0.12em]">目标岗位</label>
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="w-full bg-overlay border border-border px-2 py-1.5 text-[12px] outline-none focus:border-accent appearance-none"
        >
          <option value="">选择岗位</option>
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Resume */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-mono text-fg-subtle uppercase tracking-[0.12em]">简历 PDF</label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center gap-2 px-2 py-1.5 border border-border bg-overlay text-[12px] text-fg-subtle hover:text-fg hover:border-accent transition-colors"
        >
          <Upload size={12} />
          <span className="truncate">{resumeFileName || "上传 PDF"}</span>
        </button>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || !company || !position}
        className="w-full h-8 flex items-center justify-center gap-2 bg-accent text-bg text-[11px] uppercase tracking-[0.12em] hover:bg-accent/90 transition-colors disabled:opacity-40"
      >
        {saving ? "保存中…" : <><Save size={11} /> 保存</>}
      </button>
    </aside>
  );
}
