import { Routes, Route } from "react-router-dom";
import { GrainOverlay } from "@/components/GrainOverlay";
import Home from "@/pages/Home";
import Chat from "@/pages/Chat";
import Tts from "@/pages/Tts";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/tts" element={<Tts />} />
      </Routes>
      <GrainOverlay />
    </>
  );
}
