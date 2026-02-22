"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="markdown-content break-words text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-foreground mt-4 mb-2 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-bold text-foreground/90 mt-3 mb-1.5 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-foreground/85 mt-2.5 mb-1 first:mt-0">
              {children}
            </h3>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-2 space-y-0.5 last:mb-0">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-2 space-y-0.5 last:mb-0">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-foreground/80">{children}</li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-foreground/70">{children}</em>
          ),
          code: ({ className, children }) => {
            const isBlock = className?.includes("language-");
            if (isBlock) {
              return (
                <code className="text-xs">{children}</code>
              );
            }
            return (
              <code className="bg-brand/10 text-brand px-1.5 py-0.5 rounded text-xs font-mono">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-indigo-deep rounded-lg px-3 py-2.5 mb-2 overflow-x-auto text-xs font-mono text-foreground/70 last:mb-0">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-purple-accent/40 pl-3 mb-2 text-foreground/60 italic last:mb-0">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-accent hover:text-purple-accent/80 underline underline-offset-2"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2 last:mb-0">
              <table className="min-w-full text-xs border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-foreground/10">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-2 py-1 text-left font-semibold text-foreground/70">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-2 py-1 text-foreground/60 border-b border-foreground/5">
              {children}
            </td>
          ),
          hr: () => <hr className="border-foreground/10 my-3" />,
          del: ({ children }) => (
            <del className="text-foreground/40 line-through">{children}</del>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
