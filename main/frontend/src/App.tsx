import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { GrainOverlay } from "@/components/GrainOverlay";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { InterviewProvider } from "@/contexts/InterviewContext";
import { PracticeProvider } from "@/contexts/PracticeContext";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";
import ModeSelect from "@/pages/interview/ModeSelect";
import PracticeHub from "@/pages/interview/PracticeHub";
import MockHub from "@/pages/interview/MockHub";
import MockReport from "@/pages/interview/MockReport";
import Stage0Intel from "@/pages/interview/Stage0Intel";
import Stage1Resume from "@/pages/interview/Stage1Resume";
import Stage2Technical from "@/pages/interview/Stage2Technical";
import Stage3Scenario from "@/pages/interview/Stage3Scenario";
import Stage4Summary from "@/pages/interview/Stage4Summary";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("token");
  const location = useLocation();
  if (!token) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

const STAGE_COMPONENTS = [Stage0Intel, Stage1Resume, Stage2Technical, Stage3Scenario, Stage4Summary];

export default function App() {
  return (
    <ErrorBoundary>
      <InterviewProvider>
        <PracticeProvider>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* 模式二选一入口 */}
            <Route path="/interview" element={<RequireAuth><ModeSelect /></RequireAuth>} />

            {/* 练习模式：单关精练，自由跳转，无跨关记忆 */}
            <Route path="/interview/practice" element={<RequireAuth><PracticeHub /></RequireAuth>} />
            {STAGE_COMPONENTS.map((Comp, i) => (
              <Route
                key={`practice-${i}`}
                path={`/interview/practice/stage/${i}`}
                element={<RequireAuth><Comp /></RequireAuth>}
              />
            ))}

            {/* 模拟模式：完整 5 关线性面试，跨关累积上下文 */}
            <Route path="/interview/mock" element={<RequireAuth><MockHub /></RequireAuth>} />
            <Route path="/interview/mock/:sessionId/report" element={<RequireAuth><MockReport /></RequireAuth>} />
            {STAGE_COMPONENTS.map((Comp, i) => (
              <Route
                key={`mock-${i}`}
                path={`/interview/mock/:sessionId/stage/${i}`}
                element={<RequireAuth><Comp /></RequireAuth>}
              />
            ))}

            {/* 旧路径兼容：/interview/stage/N → 重定向到模式选择页 */}
            <Route path="/interview/stage/*" element={<Navigate to="/interview" replace />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </PracticeProvider>
      </InterviewProvider>
      <GrainOverlay />
    </ErrorBoundary>
  );
}
