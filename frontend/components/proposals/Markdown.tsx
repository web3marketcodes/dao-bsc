"use client";

import ReactMarkdown from "react-markdown";

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => (
          <h1 className="text-xl font-bold mb-3 text-white">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-semibold mt-4 mb-2 text-white">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold mt-3 mb-1.5 text-white">{children}</h3>
        ),
        p: ({ children }) => (
          <p className="text-sm text-[var(--muted)] mb-3 leading-relaxed">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold text-white">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-[var(--muted)]">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside text-sm text-[var(--muted)] mb-3 space-y-1">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside text-sm text-[var(--muted)] mb-3 space-y-1">{children}</ol>
        ),
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        code: ({ children }) => (
          <code className="px-1.5 py-0.5 rounded bg-white/5 text-xs font-mono text-emerald-400">{children}</code>
        ),
        hr: () => <hr className="border-[var(--card-border)] my-4" />,
        a: ({ href, children }) => (
          <a href={href} className="text-[var(--primary)] hover:underline" target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
