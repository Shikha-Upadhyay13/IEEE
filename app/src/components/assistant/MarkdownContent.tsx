import { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

// A fenced code block always carries a "language-xxx" class (only when a
// language tag follows the opening ```); a plain ``` block gets no class at
// all but still contains a literal newline, which inline code spans never
// do — together those two checks are enough to tell a block from a span
// without react-markdown v9's removed `inline` prop.
function isCodeBlock(className: string | undefined, children: unknown): boolean {
  return /language-/.test(className ?? "") || String(children).includes("\n");
}

function CodeBlock({ children }: { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const text = String(children).replace(/\n$/, "");

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="relative group my-3">
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy code"
        className="absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-700/80 text-gray-200 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="rounded-lg bg-gray-900 dark:bg-black text-gray-100 text-[13px] leading-relaxed p-3 overflow-x-auto font-mono not-italic">
        <code>{text}</code>
      </pre>
    </div>
  );
}

// Every element gets its own override rather than relying on a Tailwind
// Typography-style "prose" class — the assistant's replies already have a
// deliberate serif-prose voice (see AssistantPage's RoleLabel/thread
// comments), and these overrides keep markdown structure inside that same
// voice instead of resetting to a generic "docs site" look. Only code
// switches families, since monospace-for-code is a content convention, not
// a branding choice.
const components: Components = {
  strong: ({ children }) => <strong className="font-bold not-italic">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-gray-400 dark:decoration-gray-600 hover:decoration-gray-800 dark:hover:decoration-gray-300 not-italic"
    >
      {children}
    </a>
  ),
  p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-1 not-italic">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-1 not-italic">{children}</ol>,
  li: ({ children }) => <li>{children}</li>,
  h1: ({ children }) => <h1 className="text-lg font-bold not-italic mt-4 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold not-italic mt-4 mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-[15px] font-bold not-italic mt-3 mb-1.5">{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-gray-300 dark:border-gray-700 pl-3 not-italic text-gray-600 dark:text-gray-400 my-2">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-gray-200 dark:border-gray-800" />,
  code: ({ className, children }) =>
    isCodeBlock(className, children) ? (
      <CodeBlock>{children}</CodeBlock>
    ) : (
      <code className="font-mono not-italic text-[0.9em] bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded px-1 py-0.5">
        {children}
      </code>
    ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full text-sm border-collapse not-italic">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-gray-300 dark:border-gray-700 px-2 py-1 text-left font-semibold bg-gray-50 dark:bg-gray-800">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="border border-gray-300 dark:border-gray-700 px-2 py-1">{children}</td>,
};

export function MarkdownContent({ text }: { text: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
      {text}
    </ReactMarkdown>
  );
}
