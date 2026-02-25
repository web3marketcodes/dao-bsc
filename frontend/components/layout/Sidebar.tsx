"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Dashboard", icon: "◆" },
  { href: "/proposals", label: "Proposals", icon: "◈" },
  { href: "/proposals/create", label: "Create Proposal", icon: "+" },
  { href: "/delegate", label: "Delegate", icon: "⇄" },
  { href: "/treasury", label: "Tokenomics", icon: "◎" },
  { href: "/staking", label: "Staking", icon: "⬡" },
  { href: "/documentation", label: "Docs", icon: "◇" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r border-[var(--card-border)] bg-[var(--card)] flex flex-col">
      <div className="p-4 border-b border-[var(--card-border)]">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">⬡</span>
          <span className="font-bold text-lg">DAO</span>
        </Link>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-[var(--primary)] text-white"
                  : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white/5"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
