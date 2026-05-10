import { useState, useRef, useEffect } from "react";
import { useInterview } from "@/contexts/InterviewContext";
import { InterviewLayout } from "./InterviewLayout";
import { RadarChart } from "@/components/RadarChart";
import { Send, ArrowRight, Loader2 } from "lucide-react";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

interface TemplateBProps {
  stage: number;
  title: string;
  subtitle: string;
  showRadar: boolean;
  showCodeInput: boolean;
  showScenario: boolean;
  scenarioText?: string;
}

export default function TemplateB({ stage, title, subtitle, showRadar, showCodeInput, showScenario, scenarioText }: TemplateBProps) {
  const { session, advanceStage } = useInterview();
  const [messages, setMessages] = useState<any[]>(session?.stage_histories?.[String(stage)] || []);
  const [input, setInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [scores, setScores] = useState<Record<string, number>>(session?.scores || {});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setCodeInput("");
    setStreaming(true);

    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/interview/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          session_id: session!.id,
          stage,
          message: text,
          history: newMessages.slice(0, -1),
          model: "kimi-k2.6",
        }),
      });
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n\n")) {
          if (!line.startsWith("data:")) continue;
          const data = JSON.parse(line.slice(5).trim());
          if (data.delta) assistantText += data.delta;
        }
      }
      setMessages([...newMessages, { role: "assistant", content: assistantText }]);

      // Try extract scores from response for stage 3
      if (stage === 3) {
        try {
          const scoreMatch = assistantText.match(/(\d{2,3})\s*\/\s*100/g);
          if (scoreMatch) {
            const labels = ["基础知识", "系统设计", "代码质量", "抗压能力", "沟通表达"];
            const newScores: Record<string, number> = {};
            scoreMatch.slice(0, 5).forEach((m, i) => {
              newScores[labels[i]] = parseInt(m);
            });
            setScores(newScores);
          }
        } catch {}
      }
    } finally {
      setStreaming(false);
    }
  };

  const handleNext = async () => {
    await advanceStage({ scores });
  };

  return (
    <InterviewLayout>
      <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_360px]">
        {/* Left: Chat */}
        <section className="flex flex-col min-h-0 border-r border-border">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-[14px] font-medium text-fg">{title}</h2>
            <p className="text-[12px] text-fg-subtle">{subtitle}</p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-fg-subtle text-[12px] py-12">
                {showScenario ? scenarioText : "面试官已就位，请开始对话"}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 text-[13px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-accent text-bg rounded-sm"
                    : "bg-elevated border border-border rounded-sm"
                }`}>
                  {m.role === "assistant" ? (
                    <MarkdownRenderer content={m.content} />
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
              </div>
            ))}
            {streaming && (
              <div className="flex justify-start">
                <div className="bg-elevated border border-border rounded-sm px-3 py-2">
                  <Loader2 size={14} className="animate-spin text-fg-subtle" />
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-border space-y-2">
            {showCodeInput && (
              <textarea
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                className="w-full bg-overlay border border-border rounded-sm px-3 py-2 text-[12px] font-mono outline-none focus:border-accent resize-none h-20"
                placeholder="粘贴代码片段（可选）…"
              />
            )}
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend(input)}
                className="flex-1 bg-overlay border border-border rounded-sm px-3 py-2 text-[14px] outline-none focus:border-accent"
                placeholder="输入回答…"
              />
              <button
                onClick={() => handleSend(codeInput ? `[代码]\n${codeInput}\n\n${input}` : input)}
                disabled={streaming}
                className="h-9 px-3 flex items-center justify-center border border-accent text-accent rounded-sm hover:bg-accent hover:text-bg transition-colors disabled:opacity-40"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </section>

        {/* Right: Panel */}
        <section className="flex flex-col min-h-0 overflow-y-auto p-4 gap-4">
          {showScenario && scenarioText && (
            <div className="border border-border bg-elevated rounded-sm p-4">
              <h3 className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted mb-2">场景设定</h3>
              <p className="text-[13px] text-fg leading-relaxed">{scenarioText}</p>
            </div>
          )}

          {showRadar && Object.keys(scores).length > 0 && (
            <div className="border border-border bg-elevated rounded-sm p-4">
              <h3 className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted mb-2">能力评估</h3>
              <RadarChart data={scores} size={220} />
              <div className="mt-3 space-y-1">
                {Object.entries(scores).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between text-[12px]">
                    <span className="text-fg-subtle">{k}</span>
                    <span className="text-fg font-mono">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {messages.length >= 3 && (
            <button
              onClick={handleNext}
              className="w-full h-9 flex items-center justify-center gap-2 bg-accent text-bg text-[12px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent/90 transition-colors"
            >
              进入下一关 <ArrowRight size={14} />
            </button>
          )}
        </section>
      </div>
    </InterviewLayout>
  );
}
