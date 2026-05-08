import { Card } from "@/components/ui/Card";
import { MessageSquare, Volume2, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-12">
      <header className="flex flex-col items-center py-10">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-500 text-4xl shadow-[0_0_32px_rgba(56,189,248,0.3)]">
          🚀
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-text">
          AIIC Challenge
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          项目正式开始：2026-05-10 08:00
        </p>
        <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Zap size={12} />
          测试环境
        </span>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <a
          href="/chat"
          className="group"
        >
          <Card className="flex flex-col items-center p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-[0_0_24px_rgba(56,189,248,0.1)]">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
              <MessageSquare size={28} />
            </div>
            <h2 className="text-lg font-semibold text-text">AI 对话</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              与 Kimi 旗舰模型实时对话
              <br />
              支持流式输出
            </p>
            <span className="mt-4 inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              kimi-k2.6
            </span>
          </Card>
        </a>

        <a href="/tts" className="group">
          <Card className="flex flex-col items-center p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-accent/30 hover:shadow-[0_0_24px_rgba(245,158,11,0.1)]">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent transition-colors group-hover:bg-accent/20">
              <Volume2 size={28} />
            </div>
            <h2 className="text-lg font-semibold text-text">语音合成</h2>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              豆包语音大模型 TTS
              <br />
              多音色可选
            </p>
            <span className="mt-4 inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              豆包语音
            </span>
          </Card>
        </a>
      </div>

      <footer className="mt-10 text-center text-xs text-text-muted">
        公网访问地址：http://39.106.211.238/
      </footer>
    </div>
  );
}
