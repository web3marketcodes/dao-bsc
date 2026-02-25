"use client";

import { formatEther } from "viem";
import { useTaxToken } from "@/hooks/useTaxToken";

export function TaxTokenOverview() {
  const {
    buyTax,
    sellTax,
    tradingEnabled,
    maxTransactionAmount,
    maxWalletAmount,
    totalSupply,
    taxTokenAddress,
  } = useTaxToken();

  function formatBps(bps: bigint | undefined): string {
    if (bps === undefined) return "—";
    return `${(Number(bps) / 100).toFixed(2)}%`;
  }

  return (
    <div className="space-y-4">
      {/* Tax Rates */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <h3 className="text-sm text-[var(--muted)] mb-3">Tax Rates</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[var(--muted)]">Buy Tax</p>
            <p className="text-xl font-semibold">{formatBps(buyTax)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--muted)]">Sell Tax</p>
            <p className="text-xl font-semibold">{formatBps(sellTax)}</p>
          </div>
        </div>
      </div>

      {/* Trading Status & Limits */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <h3 className="text-sm text-[var(--muted)] mb-3">Limits & Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Trading Status</span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium ${
                tradingEnabled
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {tradingEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Max Transaction</span>
            <span className="font-medium text-sm">
              {maxTransactionAmount
                ? `${Number(formatEther(maxTransactionAmount)).toLocaleString()} TAX`
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Max Wallet</span>
            <span className="font-medium text-sm">
              {maxWalletAmount
                ? `${Number(formatEther(maxWalletAmount)).toLocaleString()} TAX`
                : "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Token Info */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6 space-y-3">
        <h3 className="text-sm text-[var(--muted)] mb-1">Token Details</h3>
        <div>
          <p className="text-xs text-[var(--muted)]">Total Supply</p>
          <p className="text-sm font-medium">
            {totalSupply
              ? `${Number(formatEther(totalSupply)).toLocaleString()} TAX`
              : "—"}
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted)]">Address</p>
          <p className="text-sm font-mono break-all">{taxTokenAddress}</p>
        </div>
      </div>
    </div>
  );
}
