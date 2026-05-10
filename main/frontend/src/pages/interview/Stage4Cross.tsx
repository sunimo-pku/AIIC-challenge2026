import TemplateB from "./TemplateB";

export default function Stage4Cross() {
  return (
    <TemplateB
      stage={4}
      title="交叉面 · 场景面"
      subtitle="极端业务冲突场景，考察权衡能力"
      showRadar={false}
      showCodeInput={false}
      showScenario={true}
      scenarioText="上线前夜发现 P2 Bug，业务方坚持要按时上线。作为技术负责人，你怎么办？"
    />
  );
}
