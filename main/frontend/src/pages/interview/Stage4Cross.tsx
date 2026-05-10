import { useEffect, useState } from "react";
import { useInterview } from "@/contexts/InterviewContext";
import TemplateB from "./TemplateB";

const FALLBACK_SCENARIO = "面试官将根据你的岗位与简历，现场设计一个跨业务线的冲突场景。准备好后请在左侧对话框输入「开始」。";

/**
 * 交叉面：场景由 LLM 根据 company / position / target_projects 现场生成。
 * 不再硬编码一道场景题（之前是「上线前夜 P2 Bug」），
 * 这样所有用户、所有岗位看到的场景才有差异。
 */
export default function Stage4Cross() {
  const { session } = useInterview();
  const [scenario, setScenario] = useState(FALLBACK_SCENARIO);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!session) return;
    // 已有历史对话则把第一条 assistant 消息当作场景；否则现场生成
    const history = session.stage_histories?.["4"] || [];
    const firstAssistant = history.find((m: any) => m.role === "assistant")?.content;
    if (firstAssistant && typeof firstAssistant === "string" && firstAssistant.length > 30) {
      // 只取首段作为场景概要
      const firstPara = firstAssistant.split("\n\n")[0].slice(0, 240);
      setScenario(firstPara);
      return;
    }
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
            stage: 4,
            message: `请基于：${session.company} 的 ${session.position} 岗位，以及候选人项目「${projects}」，给出一道交叉面场景题。`
              + " 要求：100-180 字、单一明确冲突、不给出标准答案、结尾抛出「你怎么办？」。直接给场景文本，不要前后铺垫。",
            model: "kimi-k2.6",
          }),
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
            } catch { /* 跳过损坏帧 */ }
          }
        }
      } catch (e) {
        console.error("Stage4 scenario generation failed:", e);
      } finally {
        if (!cancelled) setGenerating(false);
      }
    })();
    return () => { cancelled = true; };
    // 仅在 session.id 变化时重新生成
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id]);

  return (
    <TemplateB
      stage={4}
      title="交叉面 · 场景面"
      subtitle={generating ? "AI 正在为你定制场景…" : "极端业务冲突场景，考察权衡能力"}
      showRadar={false}
      showCodeInput={false}
      showScenario={true}
      scenarioText={scenario}
    />
  );
}
