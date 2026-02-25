"use client";

import { useEffect, useState } from "react";

const sections = [
  { id: "overview", label: "Overview" },
  { id: "architecture", label: "Architecture" },
  { id: "smart-contracts", label: "Smart Contracts", children: [
    { id: "contract-daotoken", label: "DAOToken" },
    { id: "contract-timelock", label: "DAOTimelock" },
    { id: "contract-governor", label: "DAOGovernor" },
    { id: "contract-taxtoken", label: "TaxToken" },
    { id: "contract-revenuesplitter", label: "RevenueSplitter" },
    { id: "contract-stakingvault", label: "StakingVault" },
  ]},
  { id: "deployment-guide", label: "Deployment Guide" },
  { id: "frontend-setup", label: "Frontend Setup" },
  { id: "governance-guide", label: "Governance Guide" },
  { id: "tokenomics", label: "Tokenomics" },
  { id: "staking", label: "Staking" },
];

function getAllIds(): string[] {
  const ids: string[] = [];
  for (const s of sections) {
    ids.push(s.id);
    if (s.children) {
      for (const c of s.children) {
        ids.push(c.id);
      }
    }
  }
  return ids;
}

export function DocsSidebar() {
  const [activeId, setActiveId] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const ids = getAllIds();
    const observer = new IntersectionObserver(
      (entries) => {
        // Find the first visible section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );

    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  function handleClick(id: string) {
    setMobileOpen(false);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", `#${id}`);
    }
  }

  const navContent = (
    <nav className="space-y-1">
      <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">
        On this page
      </p>
      {sections.map((section) => (
        <div key={section.id}>
          <button
            onClick={() => handleClick(section.id)}
            className={`block w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
              activeId === section.id
                ? "text-[var(--primary)] bg-[var(--primary)]/10"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {section.label}
          </button>
          {section.children && (
            <div className="ml-3 border-l border-[var(--card-border)] pl-2 mt-0.5 space-y-0.5">
              {section.children.map((child) => (
                <button
                  key={child.id}
                  onClick={() => handleClick(child.id)}
                  className={`block w-full text-left px-2 py-1 rounded text-xs transition-colors ${
                    activeId === child.id
                      ? "text-[var(--primary)] bg-[var(--primary)]/10"
                      : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {child.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-56 shrink-0">
        <div className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4">
          {navContent}
        </div>
      </aside>

      {/* Mobile dropdown */}
      <div className="lg:hidden mb-6">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--card-border)] bg-[var(--card)] text-sm w-full"
        >
          <span className="text-[var(--muted)]">On this page</span>
          <span className={`ml-auto text-[var(--muted)] transition-transform ${mobileOpen ? "rotate-180" : ""}`}>
            &#9662;
          </span>
        </button>
        {mobileOpen && (
          <div className="mt-2 p-3 rounded-lg border border-[var(--card-border)] bg-[var(--card)]">
            {navContent}
          </div>
        )}
      </div>
    </>
  );
}
