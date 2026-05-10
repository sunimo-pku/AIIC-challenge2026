import { useNavigate } from "react-router-dom";
import { useInterview } from "@/contexts/InterviewContext";
import { InterviewLayout } from "./InterviewLayout";
import { Briefcase } from "lucide-react";

const STAGE_CARDS = [
  { name: "情报局", stage: 0, desc: "定制化面经报告" },
  { name: "简历评估", stage: 1, desc: "技术标签与风险点" },
  { name: "基础面", stage: 2, desc: "底层原理快问快答" },
  { name: "深挖面", stage: 3, desc: "项目连续追问 + 雷达图" },
  { name: "交叉面", stage: 4, desc: "场景冲突权衡" },
  { name: "HR 面", stage: 5, desc: "STAR 行为面试" },
  { name: "终面", stage: 6, desc: "高管宏观视野" },
];

export default function InterviewSetup() {
  const navigate = useNavigate();
  const { session } = useInterview();

  const hasSetup = session && session.company && session.position;

  return (
    <InterviewLayout>
      <div className="h-full flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center space-y-2">
            <h1 className="font-display text-[28px] tracking-[0.04em]">MOCK MATE</h1>
            <p className="text-[14px] text-fg-muted">
              {hasSetup
                ? `当前目标：${session.company} · ${session.position}`
                : "请在左侧栏填写面试目标信息"}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STAGE_CARDS.map((s) => (
              <button
                key={s.name}
                onClick={() => navigate(`/interview/stage/${s.stage}`)}
                disabled={!hasSetup}
                className="text-left border border-border bg-elevated rounded-sm p-4 hover:bg-elevated/80 transition-colors space-y-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-2">
                  <Briefcase size={14} className="text-fg-muted" strokeWidth={1.5} />
                  <span className="text-[13px] font-medium text-fg">{s.name}</span>
                </div>
                <p className="text-[12px] text-fg-subtle">{s.desc}</p>
              </button>
            ))}
          </div>

          {!hasSetup && (
            <div className="text-center text-[12px] text-fg-subtle">
              先点击左上角展开左侧栏，填写公司和岗位后即可开始练习
            </div>
          )}
        </div>
      </div>
    </InterviewLayout>
  );
}
