import TemplateB from "./TemplateB";

export default function Stage2Tech1() {
  return (
    <TemplateB
      stage={2}
      title="业务初试 · 基础面"
      subtitle="限时快问快答，考察底层原理"
      showRadar={false}
      showCodeInput={false}
      showScenario={false}
    />
  );
}
