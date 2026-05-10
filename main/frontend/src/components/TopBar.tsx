import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import {
  loadInterviewSettings,
  saveInterviewSettings,
  type InterviewSettings,
} from "@/lib/interviewSettings";
import {
  User,
  LogOut,
  Settings,
  X,
  NotebookPen,
  SlidersHorizontal,
  Shield,
} from "lucide-react";

interface TopBarProps {
  center?: React.ReactNode;
  right?: React.ReactNode;
}

export function TopBar({ center, right }: TopBarProps) {
  const { user, logout } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<InterviewSettings>(
    loadInterviewSettings(user?.id)
  );

  // user 异步加载完成后，重新读取对应用户的设置
  useEffect(() => {
    if (user) {
      setSettings(loadInterviewSettings(user.id));
    }
  }, [user?.id]);

  const updateSettings = (patch: Partial<InterviewSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    if (user) {
      saveInterviewSettings(next, user.id);
    }
  };

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
              <a
                href="/journal"
                className="hidden sm:inline-flex items-center gap-1 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle hover:text-accent transition-colors"
                title="复盘笔记"
              >
                <NotebookPen size={13} strokeWidth={1.5} />
                NOTES
              </a>
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
            <div className="p-5 space-y-5">
              {/* 账号信息 */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[12px] text-fg-subtle font-medium">
                  <User size={12} />
                  账号信息
                </div>
                <div className="text-[12px] text-fg-subtle leading-relaxed space-y-1">
                  <p>当前用户：{user?.username}</p>
                  <p>MockMate AI 模拟面试官</p>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* 面试难度 */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[12px] text-fg-subtle font-medium">
                  <SlidersHorizontal size={12} />
                  面试难度
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["低", "中", "高"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => updateSettings({ difficulty: d })}
                      className={`h-8 text-[12px] border transition-colors ${
                        settings.difficulty === d
                          ? "border-accent text-accent bg-accent/5"
                          : "border-border text-fg-subtle hover:text-fg hover:border-fg-subtle/50"
                      }`}
                    >
                      {d === "低" ? "初级" : d === "中" ? "中级" : "高级"}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-fg-muted leading-relaxed">
                  {settings.difficulty === "低"
                    ? "基础概念为主，追问较浅，给较多提示。"
                    : settings.difficulty === "中"
                    ? "基础到进阶，追问 2–3 层，需展示一定深度。"
                    : "直击架构与边界场景，追问 3–5 层，要求系统性思维。"}
                </p>
              </div>

              {/* 面试官风格 */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-[12px] text-fg-subtle font-medium">
                  <Shield size={12} />
                  面试官风格
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {(
                    [
                      { key: "温和引导型", desc: "像 Mentor，先肯定再引导，鼓励为主" },
                      { key: "严格追问型", desc: "直接追问细节，不客气但专业" },
                      { key: "压力面试型", desc: "频繁质疑，制造紧张，观察抗压能力" },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.key}
                      onClick={() => updateSettings({ style: s.key })}
                      className={`flex items-center justify-between px-3 py-2 text-[12px] border transition-colors ${
                        settings.style === s.key
                          ? "border-accent text-accent bg-accent/5"
                          : "border-border text-fg-subtle hover:text-fg hover:border-fg-subtle/50"
                      }`}
                    >
                      <span>{s.key}</span>
                      <span className="text-[11px] text-fg-muted truncate max-w-[180px]">
                        {s.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <button
                  onClick={() => {
                    logout();
                    setShowSettings(false);
                  }}
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
