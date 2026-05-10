import TemplateB from "./TemplateB";

export default function Stage4Summary() {
  return (
    <TemplateB
      stage={4}
      title="总结 · 终面评估"
      subtitle="综合评分与录用建议"
      showRadar={false}
      showCodeInput={false}
      showScenario={false}
    />
  );
}
