import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { GrainOverlay } from "@/components/GrainOverlay";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { InterviewProvider } from "@/contexts/InterviewContext";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";
import InterviewSetup from "@/pages/interview/InterviewSetup";
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

export default function App() {
  return (
    <ErrorBoundary>
      <InterviewProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/interview" element={<RequireAuth><InterviewSetup /></RequireAuth>} />
          <Route path="/interview/stage/0" element={<RequireAuth><Stage0Intel /></RequireAuth>} />
          <Route path="/interview/stage/1" element={<RequireAuth><Stage1Resume /></RequireAuth>} />
          <Route path="/interview/stage/2" element={<RequireAuth><Stage2Technical /></RequireAuth>} />
          <Route path="/interview/stage/3" element={<RequireAuth><Stage3Scenario /></RequireAuth>} />
          <Route path="/interview/stage/4" element={<RequireAuth><Stage4Summary /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </InterviewProvider>
      <GrainOverlay />
    </ErrorBoundary>
  );
}
