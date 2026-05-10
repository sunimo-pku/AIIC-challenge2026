import { useEffect, useRef, useState } from "react";
import { Save, Trash2, Loader2, Eye, Edit3 } from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";

/**
 * 复盘笔记编辑器：title 输入 + 双栏 Markdown 编辑预览。
 * 既可嵌入 Journal 详情面板，也可作为 stage 页面"留笔记"弹层的内容区。
 *
 * 设计要点：
 * 1. 受控且自治——父组件传入 noteId（已有笔记）或一组初始值（新笔记），
 *    组件内部维护编辑态、用户主动按 SAVE 或 onAutoSave 触发持久化。
 * 2. 不强制双栏——窄屏自动单栏 tab 切换（编辑 / 预览）。
 * 3. 不在每次按键时落库——按 Enter 不保存，仅 SAVE 按钮 + Cmd/Ctrl+S 保存。
 *    这是一个"长形思考"场景，不要因为网络抖动让用户的输入消失。
 */

export interface NoteRefHints {
  mode?: "practice" | "simulation" | "";
  stage?: number | null;
  company?: string;
  position?: string;
  ref_session_id?: number | null;
  ref_log_id?: number | null;
}

export interface NoteEditorInitial extends NoteRefHints {
  id?: number;
  title?: string;
  content?: string;
}

export interface NoteEditorProps {
  initial: NoteEditorInitial;
  onSaved?: (note: { id: number; title: string; content: string }) => void;
  onDeleted?: (id: number) => void;
  /**
   * 紧凑模式（嵌入弹层时用）：高度自适应、隐藏关联元信息。
   */
  compact?: boolean;
  autoFocus?: boolean;
}

export function NoteEditor(props: NoteEditorProps) {
  const { initial, onSaved, onDeleted, compact, autoFocus } = props;
  const toast = useToast();

  const [id, setId] = useState<number | undefined>(initial.id);
  const [title, setTitle] = useState(initial.title || "");
  const [content, setContent] = useState(initial.content || "");
  const [view, setView] = useState<"split" | "edit" | "preview">("split");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 切换到不同笔记时把内部状态同步回来
  useEffect(() => {
    setId(initial.id);
    setTitle(initial.title || "");
    setContent(initial.content || "");
    setDirty(false);
  }, [initial.id, initial.title, initial.content]);

  useEffect(() => {
    if (autoFocus) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [autoFocus]);

  const updateTitle = (v: string) => {
    setTitle(v);
    setDirty(true);
  };
  const updateContent = (v: string) => {
    setContent(v);
    setDirty(true);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!title.trim() && !content.trim()) {
      toast.warning("空白笔记不会保存");
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const body: Record<string, any> = {
        title: title.trim() || autoTitle(content),
        content: content.trim(),
      };
      if (!id) {
        // 新建时把关联字段一并塞过去；后续 update 不再修改 ref
        body.mode = initial.mode || "";
        body.stage = initial.stage ?? null;
        body.company = initial.company || "";
        body.position = initial.position || "";
        body.ref_session_id = initial.ref_session_id ?? null;
        body.ref_log_id = initial.ref_log_id ?? null;
      }
      const url = id ? `/notes/${id}` : "/notes";
      const method = id ? "PUT" : "POST";
      const resp = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        toast.error(`保存失败：HTTP ${resp.status}`);
        return;
      }
      const data = await resp.json();
      setId(data.id);
      setDirty(false);
      toast.success(id ? "已保存" : "笔记已创建");
      onSaved?.(data);
    } catch (e: any) {
      toast.error(`保存异常：${e?.message || "未知错误"}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm("确定删除这条笔记？")) return;
    setDeleting(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`/notes/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        toast.error(`删除失败：HTTP ${resp.status}`);
        return;
      }
      toast.success("已删除");
      onDeleted?.(id);
    } finally {
      setDeleting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = content.slice(0, start) + "  " + content.slice(end);
      setContent(next);
      setDirty(true);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className={`flex flex-col h-full bg-elevated border border-border rounded-md overflow-hidden ${compact ? "" : ""}`}>
      <div className="h-9 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-subtle shrink-0">
            [ NOTE{id ? ` #${String(id).padStart(3, "0")}` : "" } ]
          </span>
          {dirty && (
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent shrink-0">
              · UNSAVED
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setView("edit")}
            className={`px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors ${view === "edit" ? "text-accent" : "text-fg-subtle hover:text-fg"}`}
            title="仅编辑"
          >
            <Edit3 size={11} className="inline" />
          </button>
          <button
            onClick={() => setView("split")}
            className={`px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors ${view === "split" ? "text-accent" : "text-fg-subtle hover:text-fg"}`}
            title="编辑 + 预览"
          >
            SPLIT
          </button>
          <button
            onClick={() => setView("preview")}
            className={`px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors ${view === "preview" ? "text-accent" : "text-fg-subtle hover:text-fg"}`}
            title="仅预览"
          >
            <Eye size={11} className="inline" />
          </button>
        </div>
      </div>

      {!compact && (initial.mode || initial.company || initial.position) && (
        <div className="px-3 py-1.5 flex flex-wrap items-center gap-1.5 border-b border-border bg-overlay text-[11px] font-mono uppercase tracking-[0.08em] text-fg-subtle shrink-0">
          {initial.mode && (
            <span className={initial.mode === "practice" ? "text-accent" : "text-signal"}>
              [ {initial.mode === "practice" ? "PRACTICE" : "MOCK"} ]
            </span>
          )}
          {initial.stage !== undefined && initial.stage !== null && (
            <span>· STAGE {String(initial.stage).padStart(2, "0")}</span>
          )}
          {(initial.company || initial.position) && (
            <span className="text-fg-muted normal-case tracking-normal">
              · {initial.company} · {initial.position}
            </span>
          )}
        </div>
      )}

      <div className="px-3 py-2 border-b border-border shrink-0">
        <input
          value={title}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder="给这条笔记起个标题（留空将自动生成）"
          className="w-full bg-transparent text-[15px] font-medium text-fg outline-none placeholder:text-fg-subtle"
        />
      </div>

      <div className={`flex-1 min-h-0 grid ${view === "split" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        {(view === "edit" || view === "split") && (
          <div className={view === "split" ? "border-r border-border" : ""}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => updateContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`# 这一关复盘\n\n## 答得不好的地方\n- \n\n## 待补的知识点\n- \n\n## 下次怎么改\n- `}
              className="w-full h-full p-4 bg-transparent font-mono text-[13px] leading-relaxed text-fg outline-none resize-none placeholder:text-fg-subtle"
              spellCheck={false}
            />
          </div>
        )}
        {(view === "preview" || view === "split") && (
          <div className="overflow-y-auto p-4 text-[13.5px] leading-relaxed">
            {content.trim() ? (
              <MarkdownRenderer content={content} />
            ) : (
              <div className="text-fg-subtle font-mono text-[12px] uppercase tracking-[0.12em]">
                [ EMPTY · 在左侧用 markdown 写 ]
              </div>
            )}
          </div>
        )}
      </div>

      <div className="h-10 px-3 flex items-center justify-between border-t border-border shrink-0 bg-overlay">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-subtle">
          {String(content.length).padStart(4, "0")} CHARS
          <span className="ml-2 text-fg-subtle/60">· ⌘/Ctrl+S 保存</span>
        </span>
        <div className="flex items-center gap-2">
          {id && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="h-7 px-2.5 flex items-center gap-1 border border-border text-fg-subtle font-mono text-[10.5px] uppercase tracking-[0.12em] rounded-sm hover:border-error hover:text-error transition-colors disabled:opacity-40"
            >
              {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              DELETE
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="h-7 px-3 flex items-center gap-1 border border-accent text-accent font-mono text-[10.5px] uppercase tracking-[0.12em] rounded-sm hover:bg-accent hover:text-bg transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            {id ? "SAVE" : "CREATE"}
          </button>
        </div>
      </div>
    </div>
  );
}

function autoTitle(content: string): string {
  // 优先取首行 markdown 标题，否则取 content 前 24 字
  const firstLine = (content || "").trim().split("\n")[0] || "";
  const stripped = firstLine.replace(/^#+\s*/, "").trim();
  if (stripped) return stripped.slice(0, 40);
  const flat = (content || "").replace(/\s+/g, " ").trim();
  return flat.slice(0, 24) || "未命名笔记";
}
