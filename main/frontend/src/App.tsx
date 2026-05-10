import { Routes, Route } from "react-router-dom";
import { GrainOverlay } from "@/components/GrainOverlay";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { InterviewProvider } from "@/contexts/InterviewContext";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import NotFound from "@/pages/NotFound";
import Stage0Intel from "@/pages/interview/Stage0Intel";
import Stage1Resume from "@/pages/interview/Stage1Resume";
import Stage2Tech1 from "@/pages/interview/Stage2Tech1";
import Stage3Tech2 from "@/pages/interview/Stage3Tech2";
import Stage4Cross from "@/pages/interview/Stage4Cross";
import Stage5HR from "@/pages/interview/Stage5HR";
import Stage6Final from "@/pages/interview/Stage6Final";

export default function App() {
  return (
    <ErrorBoundary>
      <InterviewProvider>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/interview" element={<Stage0Intel />} />
          <Route path="/interview/stage/0" element={<Stage0Intel />} />
          <Route path="/interview/stage/1" element={<Stage1Resume />} />
          <Route path="/interview/stage/2" element={<Stage2Tech1 />} />
          <Route path="/interview/stage/3" element={<Stage3Tech2 />} />
          <Route path="/interview/stage/4" element={<Stage4Cross />} />
          <Route path="/interview/stage/5" element={<Stage5HR />} />
          <Route path="/interview/stage/6" element={<Stage6Final />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </InterviewProvider>
      <GrainOverlay />
    </ErrorBoundary>
  );
}
