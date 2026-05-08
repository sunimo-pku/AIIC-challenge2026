import { cn } from "@/lib/utils";
import { MessageSquare, Home, Volume2 } from "lucide-react";
import { useLocation } from "react-router-dom";

const navItems = [
  { path: "/", label: "首页", icon: Home },
  { path: "/chat", label: "AI 对话", icon: MessageSquare },
  { path: "/tts", label: "语音合成", icon: Volume2 },
];

export function TopNav() {
  const location = useLocation();

  return (
    <nav className="flex items-center gap-1 rounded-full border border-border bg-bg-secondary/60 p-1 backdrop-blur-md">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        const Icon = item.icon;
        return (
          <a
            key={item.path}
            href={item.path}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
              isActive
                ? "bg-bg-elevated text-primary shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
                : "text-text-secondary hover:text-text hover:bg-bg-secondary"
            )}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
