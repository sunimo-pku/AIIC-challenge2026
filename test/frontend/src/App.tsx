import { Routes, Route } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Tts from "./pages/Tts";

export default function App() {
  return (
    <>
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/tts" element={<Tts />} />
      </Routes>
    </>
  );
}
