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
      <header className="h-14 shrink-0 border-b border-border/40 flex items-center justify-between px-4 lg:px-8 bg-bg/80 backdrop-blur-md z-10 shadow-sm">
        <div className="flex items-center gap-4 lg:gap-6">
          <a
            href="/interview"
            className="font-display text-[15px] font-semibold tracking-wide text-fg hover:text-accent transition-colors duration-200"
          >
            MockMate
          </a>
        </div>

        {center && (
          <div className="hidden lg:flex items-center text-[13px] text-fg-subtle font-medium">
            {center}
          </div>
        )}

        <div className="flex items-center gap-3">
          {right}
          {user && (
            <>
              <a
                href="/journal"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium text-fg-subtle hover:text-accent hover:bg-accent-soft transition-all duration-200"
                title="复盘笔记"
              >
                <NotebookPen size={14} strokeWidth={1.5} />
                Notes
              </a>
              <button
                onClick={() => setShowSettings(true)}
                className="p-2 rounded-lg text-fg-subtle hover:text-accent hover:bg-accent-soft transition-all duration-200"
                aria-label="设置"
                title="设置"
              >
                <Settings size={16} strokeWidth={1.5} />
              </button>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 text-[12px] text-fg-subtle font-medium">
                <User size={14} strokeWidth={1.5} />
                {user.username}
              </span>
              <button
                onClick={logout}
                className="p-2 rounded-lg text-fg-subtle hover:text-error hover:bg-error/10 transition-all duration-200"
                aria-label="退出登录"
                title="退出登录"
              >
                <LogOut size={16} strokeWidth={1.5} />
              </button>
            </>
          )}
          <div className="pl-2 border-l border-border/40">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm reveal">
          <div className="w-[420px] max-w-[90vw] bg-elevated border border-border/50 shadow-xl rounded-2xl overflow-hidden">
            <div className="h-12 px-5 flex items-center justify-between border-b border-border/40 bg-bg/30">
              <span className="text-[14px] font-semibold text-fg tracking-wide">设置</span>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1.5 rounded-lg text-fg-subtle hover:text-fg hover:bg-fg/5 transition-all duration-200"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* 账号信息 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[13px] text-fg font-medium">
                  <User size={14} className="text-accent" />
                  账号信息
                </div>
                <div className="text-[13px] text-fg-subtle leading-relaxed space-y-1.5 bg-bg/30 p-3 rounded-xl border border-border/30">
                  <p>当前用户：<span className="text-fg font-medium">{user?.username}</span></p>
                  <p className="text-[12px]">练习记录与面评报告全部云端同步</p>
                </div>
              </div>

              <div className="border-t border-border/40" />

              {/* 面试难度 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[13px] text-fg font-medium">
                  <SlidersHorizontal size={14} className="text-accent" />
                  面试难度
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(["低", "中", "高"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => updateSettings({ difficulty: d })}
                      className={`h-10 text-[13px] font-medium rounded-lg border transition-all duration-200 ${
                        settings.difficulty === d
                          ? "border-accent text-accent bg-accent-soft shadow-sm"
                          : "border-border/60 text-fg-subtle hover:text-fg hover:border-border hover:bg-bg/50"
                      }`}
                    >
                      {d === "低" ? "初级" : d === "中" ? "中级" : "高级"}
                    </button>
                  ))}
                </div>
                <p className="text-[12px] text-fg-muted leading-relaxed px-1">
                  {settings.difficulty === "低"
                    ? "基础概念为主，追问较浅，给较多提示。"
                    : settings.difficulty === "中"
                    ? "基础到进阶，追问 2–3 层，需展示一定深度。"
                    : "直击架构与边界场景，追问 3–5 层，要求系统性思维。"}
                </p>
              </div>

              {/* 面试官风格 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-[13px] text-fg font-medium">
                  <Shield size={14} className="text-accent" />
                  面试官风格
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      { key: "温和引导型", desc: "像导师，先肯定再引导，鼓励为主" },
                      { key: "严格追问型", desc: "直接追问细节，不客气但专业" },
                      { key: "压力面试型", desc: "高压追问 + 反向施压，提前适应抗压面试" },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.key}
                      onClick={() => updateSettings({ style: s.key })}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 ${
                        settings.style === s.key
                          ? "border-accent text-accent bg-accent-soft shadow-sm"
                          : "border-border/60 text-fg-subtle hover:text-fg hover:border-border hover:bg-bg/50"
                      }`}
                    >
                      <span className="font-medium text-[13px]">{s.key}</span>
                      <span className="text-[12px] text-fg-muted truncate max-w-[180px]">
                        {s.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-[11.5px] text-fg-muted leading-relaxed text-center">
                修改后立即对新一轮提问生效，已生成的回答不变
              </p>

              <div className="border-t border-border/40 pt-4">
                <button
                  onClick={() => {
                    logout();
                    setShowSettings(false);
                  }}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-lg border border-error/30 text-error text-[13px] font-medium hover:bg-error hover:text-white hover:border-error transition-all duration-200"
                >
                  <LogOut size={14} />
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
