import TemplateB from "./TemplateB";

export default function Stage2Technical() {
  return (
    <TemplateB
      stage={2}
      title="技术面 · 深度技术面试"
      subtitle="八股原理 + 项目深挖，交替进行"
      showRadar={true}
      showCodeInput={true}
      showScenario={false}
    />
  );
}
