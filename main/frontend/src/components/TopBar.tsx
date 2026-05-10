import { useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { User, LogOut, Settings, X } from "lucide-react";

interface TopBarProps {
  center?: React.ReactNode;
  right?: React.ReactNode;
}

export function TopBar({ center, right }: TopBarProps) {
  const { user, logout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <>
      <header className="h-11 shrink-0 border-b border-border flex items-center justify-between px-4 lg:px-6 bg-bg z-10">
        <div className="flex items-center gap-4 lg:gap-6">
          <a
            href="/interview"
            className="font-display text-[13px] tracking-[0.08em] text-fg hover:text-accent transition-colors duration-150"
          >
            MOCKMATE
          </a>
        </div>

        {center && (
          <div className="hidden lg:flex items-center text-[12px] text-fg-subtle">
            {center}
          </div>
        )}

        <div className="flex items-center gap-2">
          {right}
          {user && (
            <>
              <button
                onClick={() => setShowSettings(true)}
                className="p-1.5 text-fg-subtle hover:text-accent transition-colors"
                aria-label="设置"
                title="设置"
              >
                <Settings size={14} strokeWidth={1.5} />
              </button>
              <span className="hidden sm:inline text-[11px] text-fg-subtle font-mono">
                <User size={12} className="inline mr-1" strokeWidth={1.5} />
                {user.username}
              </span>
              <button
                onClick={logout}
                className="p-1.5 text-fg-subtle hover:text-error transition-colors"
                aria-label="退出登录"
                title="退出登录"
              >
                <LogOut size={14} strokeWidth={1.5} />
              </button>
            </>
          )}
          <ThemeToggle />
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[420px] max-w-[90vw] bg-bg border border-border shadow-xl rounded-sm overflow-hidden">
            <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-elevated">
              <span className="text-[13px] font-medium text-fg">设置</span>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 text-fg-subtle hover:text-fg transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-[12px] text-fg-subtle leading-relaxed">
                <p>MockMate AI 模拟面试官</p>
                <p className="mt-1">技术栈：FastAPI + React + Kimi K2.6</p>
                <p className="mt-1">当前用户：{user?.username}</p>
              </div>
              <div className="border-t border-border pt-3">
                <button
                  onClick={() => { logout(); setShowSettings(false); }}
                  className="w-full h-8 flex items-center justify-center gap-2 border border-error text-error text-[11px] uppercase tracking-[0.12em] hover:bg-error hover:text-bg transition-colors"
                >
                  <LogOut size={12} />
                  退出登录
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
