"use client";

import { formatEther } from "viem";
import { useRevenueSplitter } from "@/hooks/useRevenueSplitter";

export function RevenueSplitterOverview() {
  const {
    stakingShare,
    burnShare,
    devShare,
    accumulatedBalance,
    distribute,
    isPending,
    isConfirming,
    isSuccess,
  } = useRevenueSplitter();

  function formatBps(bps: bigint | undefined): string {
    if (bps === undefined) return "—";
    return `${(Number(bps) / 100).toFixed(1)}%`;
  }

  return (
    <div className="space-y-4">
      {/* Revenue Shares */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <h3 className="text-sm text-[var(--muted)] mb-3">Revenue Split</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-[var(--muted)]">Staking</p>
            <p className="text-lg font-semibold">{formatBps(stakingShare)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Burn</p>
            <p className="text-lg font-semibold">{formatBps(burnShare)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Dev</p>
            <p className="text-lg font-semibold">{formatBps(devShare)}</p>
          </div>
        </div>
      </div>

      {/* Accumulated & Distribute */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <h3 className="text-sm text-[var(--muted)] mb-2">Accumulated Revenue</h3>
        <p className="text-2xl font-bold mb-4">
          {accumulatedBalance
            ? Number(formatEther(accumulatedBalance)).toLocaleString(undefined, {
                maximumFractionDigits: 4,
              })
            : "0"}{" "}
          <span className="text-lg text-[var(--muted)]">TAX</span>
        </p>
        <button
          onClick={distribute}
          disabled={isPending || isConfirming || !accumulatedBalance || accumulatedBalance === 0n}
          className="w-full py-2.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-sm transition-colors disabled:opacity-50"
        >
          {isPending
            ? "Confirming in wallet..."
            : isConfirming
            ? "Distributing..."
            : "Distribute Revenue"}
        </button>
        {isSuccess && (
          <p className="text-sm text-green-400 mt-2">Revenue distributed!</p>
        )}
      </div>
    </div>
  );
}
