"use client";

import { StakingPanel } from "@/components/staking/StakingPanel";

export default function StakingPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Staking</h1>
        <p className="text-[var(--muted)] text-sm">
          Stake your DAO tokens to earn TaxToken rewards from trading fees.
          Rewards are distributed proportionally to your share of the staking pool.
        </p>
      </div>
      <StakingPanel />
    </div>
  );
}
