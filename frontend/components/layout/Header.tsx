"use client";

export function Header() {
  return (
    <header className="h-16 border-b border-[var(--card-border)] bg-[var(--card)] flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold">OnChain DAO</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
          BSC
        </span>
      </div>
      <div className="flex items-center gap-4">
        {/* Reown AppKit Web Component */}
        <appkit-button />
      </div>
    </header>
  );
}
