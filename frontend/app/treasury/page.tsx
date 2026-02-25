"use client";

import { TaxTokenOverview } from "@/components/taxtoken/TaxTokenOverview";
import { RevenueSplitterOverview } from "@/components/revenue/RevenueSplitterOverview";

export default function TokenomicsPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Tokenomics</h1>
        <p className="text-[var(--muted)] text-sm">
          TaxToken applies buy/sell taxes on DEX trades. Revenue is split between staking
          rewards, token burn, and development. All parameters are governed by the DAO.
        </p>
      </div>
      <TaxTokenOverview />
      <div className="pt-2">
        <h2 className="text-lg font-semibold mb-4">Revenue Splitter</h2>
        <RevenueSplitterOverview />
      </div>
    </div>
  );
}
