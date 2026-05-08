import { useState, useEffect } from "react";
import { TopBar } from "@/components/TopBar";
import { ModuleCard } from "@/components/ModuleCard";
import { MessageSquare, Volume2, ArrowRight } from "lucide-react";

const missions = [
  {
    id: "chat",
    title: "AI 对话",
    subtitle: "Kimi K2.6 流式输出",
    href: "/chat",
    icon: MessageSquare,
  },
  {
    id: "tts",
    title: "语音合成",
    subtitle: "豆包 TTS 多音色",
    href: "/tts",
    icon: Volume2,
  },
];

function MissionRow({
  index,
  title,
  subtitle,
  href,
  icon: Icon,
}: {
  index: number;
  title: string;
  subtitle: string;
  href: string;
  icon: React.ElementType;
}) {
  const num = String(index).padStart(2, "0");
  return (
    <a
      href={href}
      className="group flex items-center gap-4 px-4 py-3 border-b border-border/50 last:border-b-0 transition-colors duration-150 hover:bg-overlay/40"
    >
      <span className="text-[12px] text-fg-subtle w-6 shrink-0">
        {num}
      </span>
      <Icon size={16} className="text-fg-muted shrink-0" strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] text-fg leading-tight">{title}</div>
        <div className="text-[12px] text-fg-subtle mt-0.5">
          {subtitle}
        </div>
      </div>
      <ArrowRight
        size={14}
        className="text-fg-subtle opacity-0 group-hover:opacity-100 transition-opacity duration-150 shrink-0"
        strokeWidth={1.5}
      />
    </a>
  );
}

export default function Home() {
  const [timestamp, setTimestamp] = useState("");

  useEffect(() => {
    const update = () =>
      setTimestamp(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-bg text-fg">
      <TopBar />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[3fr_2fr] min-h-0">
        {/* 左侧品牌区 */}
        <section className="border-r border-border p-8 lg:p-12 flex flex-col justify-between overflow-y-auto">
          <div className="reveal" style={{ animationDelay: "0ms" }}>
            <div className="text-[12px] text-fg-subtle">
              项目代号 002
            </div>
          </div>

          <div className="reveal my-8" style={{ animationDelay: "60ms" }}>
            <h1 className="font-display text-[40px] sm:text-[56px] lg:text-[80px] leading-none tracking-[0.04em]">
              AIIC
              <br />
              CHALLENGE
            </h1>
            <div className="mt-6 max-w-md">
              <p className="text-fg-muted text-[15px] leading-relaxed">
                多模态语音工作站
              </p>
              <p className="mt-2 text-[12px] text-fg-subtle">
                Kimi K2.6 + 豆包语音 · 流式对话 + TTS 合成
              </p>
            </div>
          </div>

          <div className="reveal" style={{ animationDelay: "120ms" }}>
            <div className="text-[12px] text-fg-subtle">
              状态 · 运行中 · {timestamp}
            </div>
            <div className="mt-2 text-[12px] text-fg-subtle/60">
              v0.2.0 · 测试版本
            </div>
          </div>
        </section>

        {/* 右侧任务列表 */}
        <section className="overflow-y-auto p-6 lg:p-8">
          <div className="reveal" style={{ animationDelay: "180ms" }}>
            <ModuleCard label="功能列表" meta={`${missions.length} 项`}>
              <div className="py-1">
                {missions.map((m, i) => (
                  <MissionRow key={m.id} index={i + 1} {...m} />
                ))}
              </div>
            </ModuleCard>
          </div>
        </section>
      </div>
    </div>
  );
}
