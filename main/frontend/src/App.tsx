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
import Stage2Tech1 from "@/pages/interview/Stage2Tech1";
import Stage3Tech2 from "@/pages/interview/Stage3Tech2";
import Stage4Cross from "@/pages/interview/Stage4Cross";
import Stage5HR from "@/pages/interview/Stage5HR";
import Stage6Final from "@/pages/interview/Stage6Final";

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
          <Route path="/interview/stage/2" element={<RequireAuth><Stage2Tech1 /></RequireAuth>} />
          <Route path="/interview/stage/3" element={<RequireAuth><Stage3Tech2 /></RequireAuth>} />
          <Route path="/interview/stage/4" element={<RequireAuth><Stage4Cross /></RequireAuth>} />
          <Route path="/interview/stage/5" element={<RequireAuth><Stage5HR /></RequireAuth>} />
          <Route path="/interview/stage/6" element={<RequireAuth><Stage6Final /></RequireAuth>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </InterviewProvider>
      <GrainOverlay />
    </ErrorBoundary>
  );
}
