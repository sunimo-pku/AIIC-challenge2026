import { useState, useCallback, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { loader } from "@monaco-editor/react";
import { useTheme } from "@/lib/theme";
import { Maximize2, X, Code2, Sparkles } from "lucide-react";

// 强制从本地加载 Monaco，避免 CDN（jsDelivr）在中国大陆加载语言服务 worker 失败
loader.config({ paths: { vs: "/monaco-editor/vs" } });

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
  const editorRef = useRef<any>(null);

  const editorTheme = theme === "dark" ? "vs-dark" : "vs";

  const handleChange = useCallback(
    (v: string | undefined) => {
      onChange(v || "");
    },
    [onChange]
  );

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    setLoading(false);

    // 强制开启补全：在 comments / strings / code 中都触发
    editor.updateOptions({
      quickSuggestions: {
        other: true,
        comments: true,
        strings: true,
      },
      suggestOnTriggerCharacters: true,
      parameterHints: { enabled: true },
      wordBasedSuggestions: "allDocuments",
      suggest: {
        showKeywords: true,
        showSnippets: true,
        showFunctions: true,
        showVariables: true,
        showWords: true,
      },
    });

    // 注册一个兜底的关键字补全 provider，确保即使语言服务没加载也有基础提示
    const keywords: Record<string, string[]> = {
      python: ["def", "class", "if", "else", "elif", "for", "while", "return", "import", "from", "try", "except", "finally", "with", "lambda", "yield", "async", "await", "print", "len", "range", "enumerate", "zip", "map", "filter", "self", "None", "True", "False"],
      java: ["public", "private", "protected", "static", "final", "class", "interface", "extends", "implements", "void", "int", "String", "boolean", "return", "if", "else", "for", "while", "try", "catch", "throw", "new", "this", "super", "null", "true", "false"],
      cpp: ["int", "double", "float", "char", "bool", "void", "auto", "const", "static", "class", "struct", "public", "private", "protected", "virtual", "override", "template", "typename", "namespace", "using", "new", "delete", "return", "if", "else", "for", "while", "switch", "case", "default", "break", "continue", "nullptr", "true", "false"],
      go: ["package", "import", "func", "var", "const", "type", "struct", "interface", "map", "slice", "chan", "goroutine", "defer", "if", "else", "for", "range", "return", "switch", "case", "default", "break", "continue", "nil", "true", "false", "make", "len", "cap", "append", "copy"],
      javascript: ["function", "const", "let", "var", "class", "extends", "import", "export", "default", "async", "await", "return", "if", "else", "for", "while", "try", "catch", "throw", "new", "this", "typeof", "instanceof", "null", "undefined", "true", "false", "console", "log", "map", "filter", "reduce", "Promise"],
      typescript: ["function", "const", "let", "var", "class", "extends", "interface", "type", "import", "export", "default", "async", "await", "return", "if", "else", "for", "while", "try", "catch", "throw", "new", "this", "typeof", "instanceof", "null", "undefined", "true", "false", "console", "log", "map", "filter", "reduce", "Promise", "Record", "Array", "Record"],
      rust: ["fn", "let", "mut", "const", "static", "struct", "enum", "impl", "trait", "pub", "use", "mod", "crate", "self", "super", "if", "else", "match", "for", "while", "loop", "return", "break", "continue", "Some", "None", "Ok", "Err", "String", "Vec", "Box", "Option", "Result", "true", "false"],
      sql: ["SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "ON", "GROUP", "BY", "ORDER", "HAVING", "LIMIT", "OFFSET", "CREATE", "TABLE", "INDEX", "DROP", "ALTER", "AND", "OR", "NOT", "NULL", "DISTINCT", "COUNT", "SUM", "AVG", "MAX", "MIN", "AS", "VALUES", "SET"],
    };

    const kws = keywords[language] || [];
    if (kws.length > 0) {
      monaco.languages.registerCompletionItemProvider(language, {
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };
          const suggestions = kws.map((kw) => ({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            range,
          }));
          return { suggestions };
        },
      });
    }
  };

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
  };

  return (
    <>
      {/* 内联小编辑器 */}
      <div className="relative group border border-border rounded-lg overflow-hidden bg-overlay">
        <div className="h-7 px-2 flex items-center justify-between border-b border-border bg-elevated">
          <div className="flex items-center gap-1.5">
            <Code2 size={11} className="text-fg-subtle" strokeWidth={1.5} />
            <span className="text-[11px] font-mono text-fg-subtle uppercase tracking-[0.12em]">
              CODE
            </span>
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                // 切换语言后重新触发补全 provider 注册会在下次 mount 时生效
              }}
              className="ml-2 bg-transparent text-[11px] text-fg-subtle outline-none border border-border rounded-lg px-1 py-0.5 cursor-pointer hover:text-fg"
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
            onMount={handleMount}
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
                className="bg-overlay border border-border rounded-lg px-2 py-1 text-[12px] text-fg outline-none focus:border-accent cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
                <Sparkles size={10} />
                输入时自动提示 · 按 Ctrl+Space 手动触发
              </span>
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
              onMount={handleMount}
              loading={null}
            />
          </div>
        </div>
      )}
    </>
  );
}
