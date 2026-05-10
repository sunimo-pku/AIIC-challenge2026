import { useEffect, useState, useRef } from "react";
import { useInterview } from "@/contexts/InterviewContext";
import { usePractice } from "@/contexts/PracticeContext";
import { useInterviewMode } from "@/hooks/useInterviewMode";
import TemplateB from "./TemplateB";
import { loadInterviewSettings } from "@/lib/interviewSettings";

const FALLBACK_SCENARIO = "面试官将根据你的岗位与简历，现场设计一道情景冲突题。准备好后请在左侧对话框输入「开始」。";

export default function Stage3Scenario() {
  const { mode, sessionId } = useInterviewMode();
  const { session } = useInterview();
  const { profile } = usePractice();
  const isPractice = mode === "practice";

  const [scenario, setScenario] = useState(FALLBACK_SCENARIO);
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    // simulation: 已有第一条 assistant 消息时直接复用
    if (!isPractice) {
      if (!session) return;
      const history = session.stage_histories?.["3"] || [];
      const firstAssistant = history.find((m: any) => m.role === "assistant")?.content;
      if (firstAssistant && typeof firstAssistant === "string" && firstAssistant.length > 30) {
        const firstPara = firstAssistant.split("\n\n")[0].slice(0, 240);
        setScenario(firstPara);
        return;
      }
    }

    const company = isPractice ? profile.company : session?.company;
    const position = isPractice ? profile.position : session?.position;
    if (!company || !position) return;
    if (!isPractice && session?.id !== sessionId) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    let cancelled = false;
    setScenario(FALLBACK_SCENARIO);

    (async () => {
      setGenerating(true);
      try {
        const token = localStorage.getItem("token");
        const projects =
          isPractice
            ? "（练习模式 · 由面试官自行假设）"
            : (session!.target_projects || []).slice(0, 2).join("、") || "（暂无简历项目）";
        const settings = loadInterviewSettings();
        const endpoint = isPractice ? "/practice/chat" : "/interview/chat";
        const baseBody = {
          stage: 3,
          message: `请基于：${company} 的 ${position} 岗位，以及候选人项目「${projects}」，给出一道情景面场景题。`
            + " 要求：100-180 字、单一明确冲突、不给出标准答案、结尾抛出「你怎么办？」。直接给场景文本，不要前后铺垫。",
          model: "kimi-k2.6",
          difficulty: settings.difficulty,
          interviewer_style: settings.style,
        };
        const body = isPractice ? baseBody : { ...baseBody, session_id: session!.id };
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
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
  }, [isPractice, session?.id, sessionId, profile.company, profile.position]);

  return (
    <TemplateB
      stage={3}
      title="情景面 · 语音面试"
      subtitle={generating ? "AI 正在为你定制场景…" : "语音回答 + 表达状态分析"}
      showRadar={true}
      showCodeInput={false}
      showScenario={true}
      scenarioText={scenario}
      voiceMode={true}
    />
  );
}
