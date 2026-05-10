import { useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import { useTheme } from "@/lib/theme";
import { Maximize2, X, Code2 } from "lucide-react";

const LANGUAGES = [
  { label: "Python", value: "python" },
  { label: "Java", value: "java" },
  { label: "C++", value: "cpp" },
  { label: "Go", value: "go" },
  { label: "JavaScript", value: "javascript" },
  { label: "TypeScript", value: "typescript" },
  { label: "SQL", value: "sql" },
  { label: "Rust", value: "rust" },
];

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function CodeEditor({ value, onChange, placeholder }: CodeEditorProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [language, setLanguage] = useState("python");
  const [loading, setLoading] = useState(true);

  const editorTheme = theme === "dark" ? "vs-dark" : "vs";

  const handleChange = useCallback(
    (v: string | undefined) => {
      onChange(v || "");
    },
    [onChange]
  );

  const editorOptions = {
    minimap: { enabled: false },
    lineNumbers: "on" as const,
    scrollBeyondLastLine: false,
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
    padding: { top: 8, bottom: 8 },
    automaticLayout: true,
    wordWrap: "on" as const,
    tabSize: 4,
    insertSpaces: true,
    quickSuggestions: true,
    suggestOnTriggerCharacters: true,
  };

  return (
    <>
      {/* 内联小编辑器 */}
      <div className="relative group border border-border rounded-sm overflow-hidden bg-overlay">
        <div className="h-7 px-2 flex items-center justify-between border-b border-border bg-elevated">
          <div className="flex items-center gap-1.5">
            <Code2 size={11} className="text-fg-subtle" strokeWidth={1.5} />
            <span className="text-[11px] font-mono text-fg-subtle uppercase tracking-[0.12em]">
              CODE
            </span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="ml-2 bg-transparent text-[11px] text-fg-subtle outline-none border border-border rounded-sm px-1 py-0.5 cursor-pointer hover:text-fg"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1 text-[10px] text-fg-subtle hover:text-accent transition-colors uppercase tracking-[0.12em] font-mono"
            title="放大编辑"
          >
            <Maximize2 size={10} strokeWidth={1.5} />
            放大
          </button>
        </div>
        <div className="relative" style={{ height: 96 }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-[11px] text-fg-subtle font-mono z-10 bg-overlay">
              Loading editor…
            </div>
          )}
          <Editor
            height="96px"
            language={language}
            theme={editorTheme}
            value={value}
            onChange={handleChange}
            options={{ ...editorOptions, lineNumbers: "off" as const }}
            onMount={() => setLoading(false)}
            loading={null}
          />
        </div>
        {!value && placeholder && (
          <div className="absolute bottom-1.5 left-2 text-[11px] text-fg-subtle/50 pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>

      {/* 放大弹窗 */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-bg"
          onKeyDown={(e) => {
            if (e.key === "Escape") setExpanded(false);
          }}
        >
          {/* 弹窗顶部栏 */}
          <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-elevated shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-medium text-fg">代码编辑器</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-overlay border border-border rounded-sm px-2 py-1 text-[12px] text-fg outline-none focus:border-accent cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-fg-subtle font-mono">
                {value.split("\n").length} 行 · {value.length} 字符
              </span>
              <button
                onClick={() => setExpanded(false)}
                className="p-1.5 text-fg-subtle hover:text-fg transition-colors"
                title="关闭 (Esc)"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* 全屏编辑器 */}
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language={language}
              theme={editorTheme}
              value={value}
              onChange={handleChange}
              options={editorOptions}
              loading={null}
            />
          </div>
        </div>
      )}
    </>
  );
}
