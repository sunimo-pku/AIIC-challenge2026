import { Routes, Route } from "react-router-dom";
import { GrainOverlay } from "@/components/GrainOverlay";
import Home from "@/pages/Home";
import Chat from "@/pages/Chat";
import Tts from "@/pages/Tts";
import Login from "@/pages/Login";
import Register from "@/pages/Register";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/tts" element={<Tts />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
      <GrainOverlay />
    </>
  );
}
