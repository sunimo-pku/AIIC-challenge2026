import { useState } from "react";
import { TopBar } from "@/components/TopBar";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, AlertCircle, Check, Compass, FileText, MessageSquare, Headphones } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      await register(username, password);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="h-screen flex flex-col bg-bg text-fg">
        <TopBar />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-sm text-center space-y-4">
            <Check size={32} className="text-signal mx-auto" strokeWidth={1.5} />
            <p className="text-[14px] text-fg">注册成功</p>
            <p className="text-[12px] text-fg-subtle">
              现在可以登录开始使用了
            </p>
            <a
              href="/"
              className="inline-flex items-center gap-1 border border-accent text-accent font-mono text-[12px] uppercase tracking-[0.12em] rounded-sm px-4 py-2 hover:bg-accent hover:text-bg transition-colors"
            >
              LOGIN <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </div>
    );
  }

  const features = [
    { icon: Compass, label: "面试攻略 · 公司面经画像", desc: "联网整理这家公司这个岗位近期怎么考、爱挖什么" },
    { icon: FileText, label: "简历评估 · 拆解 PDF 简历", desc: "提取技术标签、识别会被深挖的项目，给出改写建议" },
    { icon: MessageSquare, label: "技术面 · 八股 + 项目深挖", desc: "连续追问，把含糊回答和弱点暴露出来" },
    { icon: Headphones, label: "情景面 · 语音 + 突发场景", desc: "突发情境冲突题，用 STAR 法答题，分析表达状态" },
  ];

  return (
    <div className="h-screen flex flex-col bg-bg text-fg">
      <TopBar />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] min-h-0">
        {/* 左侧品牌区 */}
        <section className="border-r border-border p-8 lg:p-12 flex flex-col justify-center overflow-y-auto">
          <div className="max-w-lg">
            <h1 className="font-display text-[48px] sm:text-[64px] lg:text-[80px] leading-none tracking-[0.04em]">
              MOCK
              <br />
              MATE
            </h1>
            <p className="mt-6 text-fg text-[18px] sm:text-[20px] leading-snug font-medium">
              让正式面试 ─ 不再是第一次。
            </p>
            <p className="mt-3 text-fg-muted text-[14px] leading-relaxed">
              为大厂技术岗求职而生的 AI 私人面试官<br />
              <span className="font-mono text-[12.5px] text-fg-subtle uppercase tracking-[0.08em]">
                高频对练 / 沉浸演练 / 结构化复盘
              </span>
            </p>
            <p className="mt-3 text-[11.5px] text-fg-subtle font-mono">
              [ 注册账号 · 内测期免费 · 数据全部云端同步 ]
            </p>

            <div className="mt-8 space-y-3">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 flex items-center justify-center border border-border bg-elevated rounded-sm shrink-0">
                      <Icon size={14} className="text-fg-muted" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="text-[13px] text-fg">{f.label}</div>
                      <div className="text-[12px] text-fg-subtle">{f.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 text-[12px] text-fg-subtle">
              已有账号？
              <a href="/" className="text-accent hover:underline ml-1">
                直接登录 →
              </a>
            </div>
          </div>
        </section>

        {/* 右侧表单 */}
        <section className="flex items-center justify-center p-6 lg:p-8">
          <div className="w-full max-w-sm space-y-6">
            <div>
              <h2 className="text-[18px] font-medium text-fg">创建账号</h2>
              <p className="text-[12px] text-fg-subtle mt-1">注册以开始你的面试训练</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-2 text-[12px] text-error bg-error/10 px-3 py-2 border border-error/30 rounded-sm">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-[12px] text-fg-muted uppercase tracking-[0.12em] font-mono">
                  用户名
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  minLength={3}
                  maxLength={32}
                  className="w-full bg-overlay border border-border rounded-sm px-3 py-2 text-[14px] text-fg outline-none focus:border-accent transition-colors"
                  placeholder="3-32 个字符"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[12px] text-fg-muted uppercase tracking-[0.12em] font-mono">
                  密码
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-overlay border border-border rounded-sm px-3 py-2 text-[14px] text-fg outline-none focus:border-accent transition-colors"
                  placeholder="至少 6 位"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[12px] text-fg-muted uppercase tracking-[0.12em] font-mono">
                  确认密码
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-overlay border border-border rounded-sm px-3 py-2 text-[14px] text-fg outline-none focus:border-accent transition-colors"
                  placeholder="再次输入密码"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-9 flex items-center justify-center gap-2 border border-accent text-accent font-mono text-[12px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent hover:text-bg transition-colors disabled:opacity-40"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <span className="pulse-dot-1 inline-block w-1.5 h-1.5 bg-accent" />
                    <span className="pulse-dot-2 inline-block w-1.5 h-1.5 bg-accent" />
                    <span className="pulse-dot-3 inline-block w-1.5 h-1.5 bg-accent" />
                  </span>
                ) : (
                  <>
                    REGISTER <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
