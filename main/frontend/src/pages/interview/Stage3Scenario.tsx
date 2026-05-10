import { useEffect, useState, useRef } from "react";
import { useInterview } from "@/contexts/InterviewContext";
import TemplateB from "./TemplateB";

const FALLBACK_SCENARIO = "面试官将根据你的岗位与简历，现场设计一道情景冲突题。准备好后请在左侧对话框输入「开始」。";

export default function Stage3Scenario() {
  const { session } = useInterview();
  const [scenario, setScenario] = useState(FALLBACK_SCENARIO);
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    const history = session.stage_histories?.["3"] || [];
    const firstAssistant = history.find((m: any) => m.role === "assistant")?.content;
    if (firstAssistant && typeof firstAssistant === "string" && firstAssistant.length > 30) {
      const firstPara = firstAssistant.split("\n\n")[0].slice(0, 240);
      setScenario(firstPara);
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    let cancelled = false;
    (async () => {
      setGenerating(true);
      try {
        const token = localStorage.getItem("token");
        const projects = (session.target_projects || []).slice(0, 2).join("、") || "（暂无简历项目）";
        const resp = await fetch("/interview/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            session_id: session.id,
            stage: 3,
            message: `请基于：${session.company} 的 ${session.position} 岗位，以及候选人项目「${projects}」，给出一道情景面场景题。`
              + " 要求：100-180 字、单一明确冲突、不给出标准答案、结尾抛出「你怎么办？」。直接给场景文本，不要前后铺垫。",
            model: "kimi-k2.6",
          }),
          signal: abortRef.current!.signal,
        });
        const reader = resp.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        let buffer = "";
        let text = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            if (!raw.startsWith("data:")) continue;
            try {
              const event = JSON.parse(raw.slice(5).trim());
              if (event.delta) {
                text += event.delta;
                if (!cancelled) setScenario(text);
              }
            } catch { /* skip */ }
          }
        }
      } catch (e) {
        console.error("Stage3 scenario generation failed:", e);
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  return (
    <TemplateB
      stage={3}
      title="情景面 · 综合能力"
      subtitle={generating ? "AI 正在为你定制场景…" : "场景冲突 + STAR 行为面试"}
      showRadar={true}
      showCodeInput={false}
      showScenario={true}
      scenarioText={scenario}
    />
  );
}
