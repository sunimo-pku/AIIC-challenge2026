import { useState } from "react";
import { useInterview } from "@/contexts/InterviewContext";
import { InterviewLayout } from "./InterviewLayout";
import { ArrowRight, Loader2 } from "lucide-react";

interface StarEntry {
  situation: string;
  task: string;
  action: string;
  result: string;
  aiComment?: string;
}

export default function Stage5HR() {
  const { session, advanceStage } = useInterview();
  const [entries, setEntries] = useState<StarEntry[]>([
    { situation: "", task: "", action: "", result: "" },
  ]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const entry = entries[0];
    if (!entry.situation || !entry.task || !entry.action || !entry.result) return;
    setLoading(true);
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
          stage: 5,
          message: `请按 STAR 法则点评以下经历：\n\n情境(S): ${entry.situation}\n任务(T): ${entry.task}\n行动(A): ${entry.action}\n结果(R): ${entry.result}`,
          model: "kimi-k2.6",
        }),
      });
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n\n")) {
          if (!line.startsWith("data:")) continue;
          const data = JSON.parse(line.slice(5).trim());
          if (data.delta) text += data.delta;
        }
      }
      setEntries([{ ...entry, aiComment: text }]);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    await advanceStage();
  };

  const updateField = (field: keyof StarEntry, value: string) => {
    setEntries([{ ...entries[0], [field]: value }]);
  };

  const fields: { key: keyof StarEntry; label: string; placeholder: string }[] = [
    { key: "situation", label: "情境 (Situation)", placeholder: "当时面临什么背景或挑战？" },
    { key: "task", label: "任务 (Task)", placeholder: "你的具体职责/目标是什么？" },
    { key: "action", label: "行动 (Action)", placeholder: "你具体做了什么？（重点）" },
    { key: "result", label: "结果 (Result)", placeholder: "取得了什么量化成果？" },
  ];

  return (
    <InterviewLayout>
      <div className="h-full grid grid-cols-1 lg:grid-cols-[1fr_420px]">
        <section className="border-r border-border p-6 overflow-y-auto space-y-6">
          <div>
            <h2 className="text-[14px] font-medium text-fg">HR 面 · 行为面试</h2>
            <p className="text-[12px] text-fg-subtle mt-1">用 STAR 法则结构化你的经历</p>
          </div>

          <div className="space-y-4">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1">
                <label className="block text-[12px] text-fg-muted uppercase tracking-[0.12em] font-mono">
                  {f.label}
                </label>
                <textarea
                  value={entries[0][f.key]}
                  onChange={(e) => updateField(f.key, e.target.value)}
                  className="w-full bg-overlay border border-border rounded-sm px-3 py-2 text-[14px] outline-none focus:border-accent resize-none h-20"
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || fields.some((f) => !entries[0][f.key])}
            className="w-full h-9 flex items-center justify-center gap-2 border border-accent text-accent text-[12px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent hover:text-bg transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <>
              AI 点评 <ArrowRight size={14} />
            </>}
          </button>
        </section>

        <section className="p-6 overflow-y-auto">
          {entries[0].aiComment ? (
            <div className="space-y-4">
              <h3 className="text-[12px] font-mono uppercase tracking-[0.12em] text-fg-muted">AI 点评</h3>
              <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{entries[0].aiComment}</div>
              <button
                onClick={handleNext}
                className="w-full h-9 flex items-center justify-center gap-2 bg-accent text-bg text-[12px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent/90 transition-colors"
              >
                进入下一关 <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-fg-subtle text-[12px]">
              {loading ? "正在点评…" : "左侧填写经历后获取点评"}
            </div>
          )}
        </section>
      </div>
    </InterviewLayout>
  );
}
