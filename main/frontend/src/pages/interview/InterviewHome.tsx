import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { useInterview } from "@/contexts/InterviewContext";
import { ArrowRight, Briefcase, Code2, MessageSquare, FileText, ShieldAlert, Crown } from "lucide-react";

const STAGES = [
  { icon: Briefcase, name: "情报局", desc: "定制化面经报告" },
  { icon: FileText, name: "简历评估", desc: "技术标签与风险点" },
  { icon: Code2, name: "基础面", desc: "底层原理快问快答" },
  { icon: MessageSquare, name: "深挖面", desc: "项目连续追问" },
  { icon: ShieldAlert, name: "交叉面", desc: "场景冲突权衡" },
  { icon: FileText, name: "HR 面", desc: "STAR 行为面试" },
  { icon: Crown, name: "终面", desc: "高管宏观视野" },
];

export default function InterviewHome() {
  const navigate = useNavigate();
  const { setSession } = useInterview();
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!company || !position) return;
    setLoading(true);
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
      navigate("/interview/stage/0");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-bg text-fg">
      <TopBar />
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-xl space-y-8">
          <div className="text-center space-y-2">
            <h1 className="font-display text-[32px] tracking-[0.04em]">MOCK MATE</h1>
            <p className="text-[14px] text-fg-muted">AI 模拟面试官 · 7 关全流程闯关</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STAGES.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="border border-border bg-elevated rounded-sm p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon size={14} className="text-fg-muted" strokeWidth={1.5} />
                    <span className="text-[12px] font-medium text-fg">{s.name}</span>
                  </div>
                  <p className="text-[11px] text-fg-subtle">{s.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
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
              onClick={handleStart}
              disabled={loading || !company || !position}
              className="w-full h-10 flex items-center justify-center gap-2 bg-accent text-bg text-[12px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent/90 transition-colors disabled:opacity-40"
            >
              {loading ? "创建中…" : <>开始面试 <ArrowRight size={14} /></>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
