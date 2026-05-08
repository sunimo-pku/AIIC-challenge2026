import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { Components } from "react-markdown";

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold mt-5 mb-3 text-fg border-b border-border pb-1">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold mt-4 mb-2 text-fg">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold mt-3 mb-1.5 text-fg">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-[15px] font-semibold mt-2 mb-1 text-fg">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="my-2 leading-relaxed text-fg">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc pl-5 my-2 text-fg">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 my-2 text-fg">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="my-0.5 leading-relaxed">{children}</li>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-fg">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent hover:underline"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent pl-3 italic text-fg-muted my-2">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border" />,
  code: ({ className, children, ...props }) => {
    const isBlock = typeof className === "string" && className.includes("language-");
    if (isBlock) {
      return (
        <code className="text-sm font-mono text-fg bg-transparent p-0" {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="bg-overlay px-1 py-0.5 rounded text-sm font-mono text-fg" {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="bg-elevated p-3 rounded overflow-x-auto my-2 border border-border">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-overlay">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-border even:bg-elevated/40">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="border border-border px-3 py-1.5 text-left font-semibold text-fg">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-3 py-1.5 text-fg">{children}</td>
  ),
  img: ({ src, alt }) => (
    <img src={src} alt={alt} className="max-w-full rounded my-2" loading="lazy" />
  ),
};

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}
