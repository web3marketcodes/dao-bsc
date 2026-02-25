interface DocsCodeBlockProps {
  title?: string;
  children: string;
}

export function DocsCodeBlock({ title, children }: DocsCodeBlockProps) {
  return (
    <div className="rounded-lg overflow-hidden my-4">
      {title && (
        <div className="bg-[#1a1a1a] px-4 py-2 text-xs text-[var(--muted)] border-b border-[var(--card-border)]">
          {title}
        </div>
      )}
      <pre className="bg-[#0d0d0d] p-4 overflow-x-auto">
        <code className="text-sm font-mono text-emerald-400 leading-relaxed">
          {children}
        </code>
      </pre>
    </div>
  );
}
