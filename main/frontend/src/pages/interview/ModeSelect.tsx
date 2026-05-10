import { useNavigate } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { ArrowRight, Target, Trophy } from "lucide-react";

export default function ModeSelect() {
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col bg-bg text-fg">
      <TopBar />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-12 lg:py-16 space-y-12">
          {/* Brand 头 */}
          <header className="space-y-4">
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
              [ MOCK MATE · MISSION SELECT ]
            </div>
            <h1 className="font-display text-[40px] lg:text-[56px] leading-[1.05] tracking-[0.04em]">
              选择今天的<br />练习方式
            </h1>
            <p className="text-[14px] text-fg-muted max-w-2xl leading-relaxed">
              MOCK MATE 提供两种互补的训练模式。「练习」用于针对单一关卡反复打磨；「模拟」用于在真实对抗强度下完整跑通一次面试，最后拿到结构化复盘报告。
            </p>
          </header>

          {/* 二选一卡片 */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* 练习模式 */}
            <button
              type="button"
              onClick={() => navigate("/interview/practice")}
              className="group text-left border border-border rounded-md bg-elevated hover:border-accent transition-colors duration-150 flex flex-col"
            >
              <div className="h-9 px-4 flex items-center justify-between border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle group-hover:text-accent">
                <span>[ PRACTICE.MODE ]</span>
                <span>[ FREE ]</span>
              </div>
              <div className="p-6 lg:p-8 flex-1 flex flex-col gap-6">
                <Target size={28} strokeWidth={1.5} className="text-accent" />
                <div>
                  <h2 className="text-[22px] font-medium text-fg">单关精练</h2>
                  <p className="text-[13px] text-fg-muted mt-2 leading-relaxed">
                    选任意一关直接开练。只需要面试目标（公司·岗位·简历），不带任何前序关卡的弱点记录。
                    适合「专攻 STAR」「连刷 5 道场景题」「找面试感」等高频对练场景。
                  </p>
                </div>
                <ul className="text-[12.5px] text-fg space-y-1.5 font-mono">
                  <li>· 5 关任意进入，无需前置</li>
                  <li>· 同一关可反复重练，不互相污染</li>
                  <li>· 每次练习可一键留档到「练习历史」</li>
                </ul>
                <div className="mt-auto flex items-center justify-between border-t border-border pt-4 font-mono text-[12px] uppercase tracking-[0.12em] text-accent">
                  <span>ENTER</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            </button>

            {/* 模拟模式 */}
            <button
              type="button"
              onClick={() => navigate("/interview/mock")}
              className="group text-left border border-border rounded-md bg-elevated hover:border-accent transition-colors duration-150 flex flex-col"
            >
              <div className="h-9 px-4 flex items-center justify-between border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle group-hover:text-accent">
                <span>[ MOCK.MODE ]</span>
                <span>[ LINEAR · 5 STAGES ]</span>
              </div>
              <div className="p-6 lg:p-8 flex-1 flex flex-col gap-6">
                <Trophy size={28} strokeWidth={1.5} className="text-accent" />
                <div>
                  <h2 className="text-[22px] font-medium text-fg">完整模拟</h2>
                  <p className="text-[13px] text-fg-muted mt-2 leading-relaxed">
                    一次性完整跑完 5 关：面试攻略 → 简历评估 → 技术面 → 情景面 → 总结。
                    后一关面试官能看到前一关你被问倒的题、被表扬的点，会针对性施压。结束后获得一份结构化复盘报告。
                  </p>
                </div>
                <ul className="text-[12.5px] text-fg space-y-1.5 font-mono">
                  <li>· 必须依次完成，无法跳关</li>
                  <li>· 跨关累积情报、简历、面评与评分</li>
                  <li>· 跑完输出完整复盘 + 录用建议</li>
                </ul>
                <div className="mt-auto flex items-center justify-between border-t border-border pt-4 font-mono text-[12px] uppercase tracking-[0.12em] text-accent">
                  <span>ENTER</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
