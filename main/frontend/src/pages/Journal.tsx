import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { TopBar } from "@/components/TopBar";
import { NoteEditor } from "@/components/NoteEditor";
import { useToast } from "@/components/ToastProvider";
import { Plus, Search, Loader2, FileText, Filter, X, Globe, BookMarked } from "lucide-react";

interface NoteListItem {
  id: number;
  title: string;
  preview: string;
  char_count: number;
  mode: string;
  stage: number | null;
  company: string;
  position: string;
  ref_session_id: number | null;
  ref_log_id: number | null;
  is_published: boolean;
  published_at: string | null;
  author?: string;
  created_at: string | null;
  updated_at: string | null;
}

interface NoteFull extends NoteListItem {
  content: string;
}

interface FeedLabels {
  companies: Array<{ label: string; count: number }>;
  positions: Array<{ label: string; count: number }>;
}

type Tab = "mine" | "feed";

const STAGE_NAMES: Record<number, string> = {
  0: "面试攻略",
  1: "简历评估",
  2: "技术面",
  3: "情景面",
  4: "总结",
};

interface LabelOption {
  label: string;
  count: number;
}

function FeedLabelChips({
  icon,
  selected,
  options,
  onChange,
}: {
  icon: "company" | "position";
  selected: string;
  options: LabelOption[];
  onChange: (v: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-fg-subtle shrink-0">
        {icon === "company" ? "COMPANY" : "POSITION"}
      </span>
      <button
        onClick={() => onChange("")}
        className={`px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] border rounded-sm transition-colors ${
          !selected
            ? "border-signal text-signal"
            : "border-border text-fg-subtle hover:text-fg"
        }`}
      >
        ALL
      </button>
      {options.slice(0, 8).map((o) => (
        <button
          key={o.label}
          onClick={() => onChange(selected === o.label ? "" : o.label)}
          className={`px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] border rounded-sm transition-colors ${
            selected === o.label
              ? "border-signal text-signal"
              : "border-border text-fg-subtle hover:text-fg"
          }`}
        >
          <span className="normal-case tracking-normal">{o.label}</span>
          <span className="ml-1 text-fg-subtle/70">{o.count}</span>
        </button>
      ))}
    </div>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

interface JournalPrefill {
  title?: string;
  content?: string;
  mode?: "practice" | "simulation";
  stage?: number | null;
  company?: string;
  position?: string;
  ref_session_id?: number | null;
  ref_log_id?: number | null;
}

export default function Journal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: idParam } = useParams<{ id?: string }>();
  const toast = useToast();
  const prefill = (location.state || null) as JournalPrefill | null;

  const [tab, setTab] = useState<Tab>("mine");
  const [notes, setNotes] = useState<NoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<string>("");
  const [feedCompany, setFeedCompany] = useState<string>("");
  const [feedPosition, setFeedPosition] = useState<string>("");
  const [feedLabels, setFeedLabels] = useState<FeedLabels>({ companies: [], positions: [] });
  const [keyword, setKeyword] = useState("");
  const [activeNote, setActiveNote] = useState<NoteFull | null>(null);
  const [activeLoading, setActiveLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (keyword.trim()) params.set("q", keyword.trim());
      let url: string;
      if (tab === "mine") {
        if (filterMode) params.set("mode", filterMode);
        url = `/notes?${params.toString()}`;
      } else {
        if (feedCompany) params.set("company", feedCompany);
        if (feedPosition) params.set("position", feedPosition);
        url = `/notes/feed?${params.toString()}`;
      }
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setNotes(data);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, filterMode, feedCompany, feedPosition, keyword]);

  const fetchFeedLabels = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`/notes/feed/labels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setFeedLabels(data);
      }
    } catch {
      // 忽略：拉不到 labels 不影响主流程
    }
  }, []);

  useEffect(() => {
    if (tab === "feed") fetchFeedLabels();
  }, [tab, fetchFeedLabels]);

  // 切 tab 时回到列表（清掉右侧的 active note，因为不同 tab 的笔记权限不同）
  useEffect(() => {
    if (idParam && idParam !== "new") return; // 用户是从详情链接进来的，不要打断
    setActiveNote(null);
    setCreating(false);
    // 切到 feed 时清掉 mine 的 mode filter；切到 mine 时清掉 feed 的 company/position
    if (tab === "feed") {
      setFilterMode("");
    } else {
      setFeedCompany("");
      setFeedPosition("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const fetchOne = useCallback(async (id: number) => {
    setActiveLoading(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`/notes/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        setActiveNote(data);
      } else if (resp.status === 404) {
        toast.error("笔记不存在");
        navigate("/journal", { replace: true });
      }
    } finally {
      setActiveLoading(false);
    }
  }, [toast, navigate]);

  // URL 切换时同步选中笔记
  useEffect(() => {
    if (idParam === "new") {
      setActiveNote(null);
      setCreating(true);
      return;
    }
    setCreating(false);
    if (idParam && /^\d+$/.test(idParam)) {
      fetchOne(parseInt(idParam, 10));
    } else {
      setActiveNote(null);
    }
  }, [idParam, fetchOne]);

  const filteredCount = notes.length;

  const handleSelect = (id: number) => navigate(`/journal/${id}`);

  const handleNewClick = () => navigate("/journal/new");

  const handleSaved = (saved: { id: number; title: string; content: string }) => {
    fetchList();
    if (creating) {
      navigate(`/journal/${saved.id}`, { replace: true });
    }
  };

  const handleDeleted = (id: number) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setActiveNote(null);
    navigate("/journal", { replace: true });
  };

  // 顶部 mode 过滤 chips
  const modes: Array<{ key: string; label: string }> = useMemo(
    () => [
      { key: "", label: "全部" },
      { key: "practice", label: "练习" },
      { key: "simulation", label: "模拟" },
    ],
    [],
  );

  return (
    <div className="h-screen flex flex-col bg-bg text-fg">
      <TopBar />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[400px_1fr] min-h-0">
        {/* 左栏：列表 */}
        <section className="border-r border-border flex flex-col min-h-0">
          <div className="h-11 px-4 flex items-center justify-between border-b border-border shrink-0">
            <div className="flex items-center gap-2">
              <FileText size={13} className="text-fg-subtle" strokeWidth={1.5} />
              <span className="font-mono text-[12px] uppercase tracking-[0.12em] text-fg">
                JOURNAL
              </span>
              <span className="font-mono text-[11px] text-fg-subtle">
                [ {String(filteredCount).padStart(2, "0")} ]
              </span>
            </div>
            <button
              onClick={handleNewClick}
              className="h-7 px-2 flex items-center gap-1 border border-accent text-accent font-mono text-[10.5px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent hover:text-bg transition-colors"
              title="新建笔记"
            >
              <Plus size={11} /> NEW
            </button>
          </div>

          {/* MINE / FEED tab */}
          <div className="grid grid-cols-2 border-b border-border shrink-0">
            <button
              onClick={() => setTab("mine")}
              className={`h-9 flex items-center justify-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                tab === "mine"
                  ? "text-accent border-b-2 border-accent -mb-[2px]"
                  : "text-fg-subtle hover:text-fg"
              }`}
            >
              <BookMarked size={11} strokeWidth={1.5} /> MINE
            </button>
            <button
              onClick={() => setTab("feed")}
              className={`h-9 flex items-center justify-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${
                tab === "feed"
                  ? "text-signal border-b-2 border-signal -mb-[2px]"
                  : "text-fg-subtle hover:text-fg"
              }`}
            >
              <Globe size={11} strokeWidth={1.5} /> FEED
            </button>
          </div>

          <div className="px-4 py-3 space-y-2 border-b border-border shrink-0">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-overlay border border-border rounded-sm">
              <Search size={12} className="text-fg-subtle shrink-0" strokeWidth={1.5} />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="搜索标题、内容、公司"
                className="flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-fg-subtle"
              />
              {keyword && (
                <button
                  onClick={() => setKeyword("")}
                  className="text-fg-subtle hover:text-fg"
                  aria-label="清空"
                >
                  <X size={11} />
                </button>
              )}
            </div>
            {tab === "mine" ? (
              <div className="flex items-center gap-1.5">
                <Filter size={11} className="text-fg-subtle shrink-0" strokeWidth={1.5} />
                {modes.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setFilterMode(m.key)}
                    className={`px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] border rounded-sm transition-colors ${
                      filterMode === m.key
                        ? "border-accent text-accent"
                        : "border-border text-fg-subtle hover:text-fg"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                <FeedLabelChips
                  icon="company"
                  selected={feedCompany}
                  options={feedLabels.companies}
                  onChange={setFeedCompany}
                />
                <FeedLabelChips
                  icon="position"
                  selected={feedPosition}
                  options={feedLabels.positions}
                  onChange={setFeedPosition}
                />
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 flex items-center justify-center text-fg-subtle text-[12px]">
                <Loader2 size={14} className="animate-spin mr-2" /> LOADING...
              </div>
            ) : notes.length === 0 ? (
              <div className="p-6 text-center text-fg-subtle text-[12px] font-mono uppercase tracking-[0.12em]">
                {keyword || filterMode || feedCompany || feedPosition
                  ? "[ NO MATCH ]"
                  : tab === "mine"
                  ? "[ NO NOTES YET ]"
                  : "[ EMPTY FEED ]"}
                <p className="mt-2 normal-case tracking-normal text-[11.5px] leading-relaxed">
                  {tab === "mine"
                    ? "在练习/模拟结束后，从「记笔记」按钮快速捕获你的反思"
                    : "广场上还没有公开笔记。先把你的复盘 PUBLISH 出来，让别人也能看到。"}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {notes.map((n) => {
                  const isActive = activeNote?.id === n.id;
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => handleSelect(n.id)}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          isActive
                            ? `bg-overlay border-l-2 ${tab === "feed" ? "border-l-signal" : "border-l-accent"}`
                            : "hover:bg-overlay/60 border-l-2 border-l-transparent"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-[13px] font-medium text-fg truncate flex-1">
                            {n.title || "未命名笔记"}
                          </span>
                          <span className="font-mono text-[10px] text-fg-subtle shrink-0 mt-0.5">
                            {formatRelative(tab === "feed" ? n.published_at : n.updated_at)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mb-1.5 font-mono text-[10px] uppercase tracking-[0.08em] flex-wrap">
                          {tab === "feed" && n.author && (
                            <span className="text-signal normal-case tracking-normal">
                              @{n.author}
                            </span>
                          )}
                          {tab === "mine" && n.is_published && (
                            <span className="text-signal" title="已发布">
                              <Globe size={9} className="inline" />
                            </span>
                          )}
                          {n.mode && (
                            <span className={n.mode === "practice" ? "text-accent" : "text-signal"}>
                              [ {n.mode === "practice" ? "PRACTICE" : "MOCK"} ]
                            </span>
                          )}
                          {n.stage !== null && n.stage !== undefined && (
                            <span className="text-fg-subtle">
                              · {String(n.stage).padStart(2, "0")} {STAGE_NAMES[n.stage]}
                            </span>
                          )}
                          {n.company && (
                            <span className="text-fg-muted normal-case tracking-normal">
                              · {n.company}
                            </span>
                          )}
                        </div>
                        {n.preview && (
                          <p className="text-[11.5px] text-fg-subtle leading-relaxed line-clamp-2">
                            {n.preview}
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* 右栏：编辑器 */}
        <section className="min-h-0 p-4 flex">
          {creating ? (
            <NoteEditor
              initial={{
                title: prefill?.title || "",
                content: prefill?.content || "",
                mode: prefill?.mode,
                stage: prefill?.stage,
                company: prefill?.company,
                position: prefill?.position,
                ref_session_id: prefill?.ref_session_id,
                ref_log_id: prefill?.ref_log_id,
              }}
              onSaved={handleSaved}
              autoFocus
            />
          ) : activeLoading ? (
            <div className="flex-1 flex items-center justify-center text-fg-subtle text-[12px]">
              <Loader2 size={14} className="animate-spin mr-2" /> LOADING NOTE...
            </div>
          ) : activeNote ? (
            <NoteEditor
              key={activeNote.id}
              initial={{
                id: activeNote.id,
                title: activeNote.title,
                content: activeNote.content,
                mode: (activeNote.mode as any) || "",
                stage: activeNote.stage,
                company: activeNote.company,
                position: activeNote.position,
                ref_session_id: activeNote.ref_session_id,
                ref_log_id: activeNote.ref_log_id,
                is_published: activeNote.is_published,
                author: activeNote.author,
              }}
              readOnly={!!activeNote.author}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm space-y-3">
                <FileText size={28} className="text-fg-subtle mx-auto" strokeWidth={1.5} />
                <div className="font-mono text-[12px] uppercase tracking-[0.12em] text-fg-subtle">
                  [ NO NOTE SELECTED ]
                </div>
                <p className="text-[12.5px] text-fg-muted leading-relaxed">
                  从左侧选择一条笔记，或者点击右上角 NEW 开始记录今天的复盘。
                </p>
                <p className="text-[11.5px] text-fg-subtle leading-relaxed">
                  复盘笔记是给你自己看的，每次面试后写一段，下次能直接对照。
                </p>
                <button
                  onClick={handleNewClick}
                  className="inline-flex items-center gap-1 border border-accent text-accent font-mono text-[11px] uppercase tracking-[0.12em] rounded-sm px-3 py-1.5 hover:bg-accent hover:text-bg transition-colors"
                >
                  <Plus size={12} /> NEW NOTE
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
