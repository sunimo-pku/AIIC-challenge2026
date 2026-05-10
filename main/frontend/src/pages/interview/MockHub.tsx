import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { useToast } from "@/components/ToastProvider";
import { useInterview } from "@/contexts/InterviewContext";
import { ArrowLeft, ArrowRight, Plus, Trash2, Trophy, Upload, Check } from "lucide-react";

interface MockSessionRow {
  id: number;
  company: string;
  position: string;
  current_stage: number;
  mode: string;
  completed_stages: number;
  total_score: number | null;
  updated_at: string | null;
}

const PRESET_COMPANIES = ["字节跳动", "阿里巴巴", "腾讯", "美团", "快手", "百度", "拼多多", "小红书"];
const ROLES = ["后端开发", "前端开发", "算法工程师", "客户端开发", "数据研发"];
const STAGE_NAMES = ["面试攻略", "简历评估", "技术面", "情景面", "总结"];

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

export default function MockHub() {
  const navigate = useNavigate();
  const toast = useToast();
  const { selectSession } = useInterview();
  const [rows, setRows] = useState<MockSessionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [resumeName, setResumeName] = useState("");
  const [resumePath, setResumePath] = useState("");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/interview/sessions?mode=simulation", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setRows(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredCompanies = PRESET_COMPANIES.filter(
    (c) => c.toLowerCase().includes(company.toLowerCase()) && c !== company
  );

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResumeName(file.name);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await resp.json();
      if (data.file_path) {
        setResumePath(data.file_path);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1200);
      }
    } catch {
      toast.error("简历上传失败");
    }
  };

  const handleCreate = async () => {
    if (!company.trim() || !position.trim()) {
      toast.warning("请先填写公司与岗位");
      return;
    }
    setCreating(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch("/interview/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ company: company.trim(), position: position.trim(), mode: "simulation" }),
      });
      if (!resp.ok) throw new Error("create failed");
      const data = await resp.json();
      const sessionId: number = data.id;
      if (resumePath) {
        await fetch(`/interview/sessions/${sessionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ resume_file_path: resumePath }),
        });
      }
      toast.success("场次已创建，进入第 0 关");
      await selectSession(sessionId);
      navigate(`/interview/mock/${sessionId}/stage/0`);
    } catch {
      toast.error("创建场次失败");
    } finally {
      setCreating(false);
    }
  };

  const handleEnter = async (row: MockSessionRow) => {
    await selectSession(row.id);
    if (row.completed_stages >= 5) {
      navigate(`/interview/mock/${row.id}/report`);
    } else {
      navigate(`/interview/mock/${row.id}/stage/${row.current_stage}`);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确认删除该场次？该操作不可撤销。")) return;
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`/interview/sessions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        toast.success("场次已删除");
        await load();
      } else {
        toast.error("删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-bg text-fg">
      <TopBar />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-12 py-10 space-y-8">
          <header className="space-y-2">
            <button
              onClick={() => navigate("/interview")}
              className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle hover:text-accent transition-colors"
            >
              <ArrowLeft size={12} /> [ MISSION SELECT ]
            </button>
            <h1 className="font-display text-[28px] tracking-[0.04em]">MOCK.MODE</h1>
            <p className="text-[13px] text-fg-muted">完整 5 关线性模拟 · 跨关累积上下文 · 终局复盘</p>
          </header>

          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            {/* 场次列表 */}
            <section className="border border-border rounded-md bg-elevated">
              <div className="h-8 px-3 flex items-center justify-between border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
                <span>[ MOCK.SESSIONS ]</span>
                <span>[ {String(rows.length).padStart(2, "0")} ]</span>
              </div>
              <div className="divide-y divide-border">
                {loading ? (
                  <div className="p-6 text-center font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
                    [ LOADING... ]
                  </div>
                ) : rows.length === 0 ? (
                  <div className="p-10 text-center space-y-3">
                    <Trophy size={28} strokeWidth={1.5} className="mx-auto text-fg-subtle" />
                    <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
                      [ NO SESSION ] 还没有任何模拟面试记录
                    </div>
                    <div className="text-[12px] text-fg-muted">
                      在右侧填写目标公司与岗位，开启你的第一次完整面试
                    </div>
                  </div>
                ) : (
                  rows.map((r) => {
                    const completed = r.completed_stages;
                    const isDone = completed >= 5;
                    return (
                      <div
                        key={r.id}
                        className="p-4 hover:bg-overlay transition-colors flex items-center gap-3"
                      >
                        <button
                          type="button"
                          onClick={() => handleEnter(r)}
                          className="flex-1 text-left grid gap-1"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-medium text-fg">
                              {r.company || "—"} · {r.position || "—"}
                            </span>
                            {isDone && (
                              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent border border-accent px-1.5 py-0.5">
                                [ COMPLETED ]
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 font-mono text-[11px] text-fg-subtle uppercase tracking-[0.12em]">
                            <span>STAGE {String(r.current_stage).padStart(2, "0")} / 04</span>
                            <span className="text-fg-muted">·</span>
                            <span>DONE [ {String(completed).padStart(2, "0")} / 05 ]</span>
                            <span className="text-fg-muted">·</span>
                            <span>SCORE [ {r.total_score ?? "--"} ]</span>
                            <span className="text-fg-muted">·</span>
                            <span>{formatTime(r.updated_at)}</span>
                          </div>
                          {/* 进度条 */}
                          <div className="mt-2 flex gap-0.5" aria-hidden>
                            {STAGE_NAMES.map((_, i) => (
                              <span
                                key={i}
                                className={`h-1 flex-1 ${i < completed ? "bg-accent" : "bg-border"}`}
                              />
                            ))}
                          </div>
                        </button>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleEnter(r)}
                            className="p-1.5 border border-border text-accent hover:bg-accent hover:text-bg transition-colors rounded-sm"
                            aria-label="进入"
                            title={isDone ? "查看复盘" : "继续"}
                          >
                            <ArrowRight size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(r.id)}
                            className="p-1.5 border border-border text-fg-muted hover:border-error hover:text-error transition-colors rounded-sm"
                            aria-label="删除"
                            title="删除场次"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            {/* 创建新场次 */}
            <section className="border border-border rounded-md bg-elevated h-fit">
              <div className="h-8 px-3 flex items-center justify-between border-b border-border font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">
                <span>[ NEW.MOCK ]</span>
                <span>[ DRAFT ]</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-fg-subtle uppercase tracking-[0.12em]">
                    目标公司
                  </label>
                  <div className="relative">
                    <input
                      value={company}
                      onChange={(e) => {
                        setCompany(e.target.value);
                        setShowCompanyDropdown(true);
                      }}
                      onFocus={() => setShowCompanyDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 150)}
                      className="w-full bg-overlay border border-border px-2.5 py-2 text-[13px] outline-none focus:border-accent rounded"
                      placeholder="输入或选择公司"
                    />
                    {showCompanyDropdown && filteredCompanies.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-elevated border border-border max-h-40 overflow-y-auto rounded">
                        {filteredCompanies.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className="w-full text-left px-2.5 py-1.5 text-[12.5px] hover:bg-overlay transition-colors"
                            onClick={() => {
                              setCompany(c);
                              setShowCompanyDropdown(false);
                            }}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-fg-subtle uppercase tracking-[0.12em]">
                    目标岗位
                  </label>
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full bg-overlay border border-border px-2.5 py-2 text-[13px] outline-none focus:border-accent rounded appearance-none"
                  >
                    <option value="">选择岗位</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-fg-subtle uppercase tracking-[0.12em]">
                    简历 PDF（可选）
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleResumeUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-2 px-2.5 py-2 border border-border bg-overlay text-[13px] text-fg-subtle hover:text-fg hover:border-accent transition-colors rounded"
                  >
                    {savedFlash ? <Check size={13} className="text-accent" /> : <Upload size={13} />}
                    <span className="truncate">{resumeName || "上传 PDF"}</span>
                  </button>
                </div>

                <button
                  onClick={handleCreate}
                  disabled={creating || !company.trim() || !position.trim()}
                  className="w-full h-9 flex items-center justify-center gap-2 border border-accent text-accent font-mono text-[12px] uppercase tracking-[0.12em] hover:bg-accent hover:text-bg transition-colors rounded-sm disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-accent"
                >
                  {creating ? "CREATING..." : (
                    <>
                      <Plus size={13} /> START NEW MOCK
                    </>
                  )}
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
