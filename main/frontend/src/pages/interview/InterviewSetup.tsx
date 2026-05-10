import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { useInterview } from "@/contexts/InterviewContext";
import {
  Briefcase,
  FileText,
  Code2,
  MessageSquare,
  ShieldAlert,
  Crown,
  ArrowRight,
  Loader2,
  Settings,
} from "lucide-react";

const STAGES = [
  { icon: Briefcase, name: "情报局", path: "/interview/stage/0", desc: "定制化面经报告", color: "border-blue-400/30" },
  { icon: FileText, name: "简历评估", path: "/interview/stage/1", desc: "技术标签与风险点", color: "border-emerald-400/30" },
  { icon: Code2, name: "基础面", path: "/interview/stage/2", desc: "底层原理快问快答", color: "border-amber-400/30" },
  { icon: MessageSquare, name: "深挖面", path: "/interview/stage/3", desc: "项目连续追问 + 雷达图", color: "border-rose-400/30" },
  { icon: ShieldAlert, name: "交叉面", path: "/interview/stage/4", desc: "场景冲突权衡", color: "border-violet-400/30" },
  { icon: FileText, name: "HR 面", path: "/interview/stage/5", desc: "STAR 行为面试", color: "border-cyan-400/30" },
  { icon: Crown, name: "终面", path: "/interview/stage/6", desc: "高管宏观视野", color: "border-orange-400/30" },
];

export default function InterviewSetup() {
  const navigate = useNavigate();
  const { session, setSession } = useInterview();
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [resume, setResume] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Load existing session data if available
  useEffect(() => {
    if (session) {
      setCompany(session.company || "");
      setPosition(session.position || "");
      setResume(session.resume_text || "");
      setSaved(true);
    }
  }, [session]);

  const handleSave = async () => {
    if (!company || !position) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      let sessionId: number = session?.id ?? 0;

      if (!sessionId) {
        // Create new session
        const resp = await fetch("/interview/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ company, position }),
        });
        const data = await resp.json();
        sessionId = data.id as number;
      }

      // Update session with all data
      await fetch(`/interview/sessions/${sessionId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stage: 0,
          resume_text: resume,
        }),
      });

      setSession({
        id: sessionId,
        company,
        position,
        current_stage: 0,
        intel_report: session?.intel_report || {},
        resume_text: resume,
        resume_tags: session?.resume_tags || [],
        resume_risks: session?.resume_risks || [],
        target_projects: session?.target_projects || [],
        stage_histories: session?.stage_histories || {},
        scores: session?.scores || {},
      });
      setSaved(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-bg text-fg">
      <TopBar />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Settings size={18} className="text-fg-muted" strokeWidth={1.5} />
            <div>
              <h1 className="text-[18px] font-medium text-fg">面试设置</h1>
              <p className="text-[12px] text-fg-subtle">填写目标信息，然后选择任意关卡开始练习</p>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-4 border border-border bg-elevated rounded-sm p-6">
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

            <div className="space-y-1">
              <label className="block text-[12px] text-fg-muted uppercase tracking-[0.12em] font-mono">简历内容（可选）</label>
              <textarea
                value={resume}
                onChange={(e) => setResume(e.target.value)}
                className="w-full bg-overlay border border-border rounded-sm px-3 py-2 text-[14px] outline-none focus:border-accent resize-none h-32"
                placeholder="粘贴简历内容，用于简历评估和深挖面…"
              />
            </div>

            <button
              onClick={handleSave}
              disabled={loading || !company || !position}
              className="w-full h-9 flex items-center justify-center gap-2 bg-accent text-bg text-[12px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent/90 transition-colors disabled:opacity-40"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <>
                {saved ? "更新信息" : "保存并开始"} <ArrowRight size={14} />
              </>}
            </button>
          </div>

          {/* Stage Grid */}
          {saved && (
            <div className="space-y-3">
              <h2 className="text-[14px] font-medium text-fg">选择关卡</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {STAGES.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.name}
                      onClick={() => navigate(s.path)}
                      className={`text-left border ${s.color} bg-elevated rounded-sm p-4 hover:bg-elevated/80 transition-colors space-y-2`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={16} className="text-fg-muted" strokeWidth={1.5} />
                        <span className="text-[13px] font-medium text-fg">{s.name}</span>
                      </div>
                      <p className="text-[12px] text-fg-subtle">{s.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
