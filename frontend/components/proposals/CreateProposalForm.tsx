"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { parseEther, encodeFunctionData } from "viem";
import { useGovernor } from "@/hooks/useGovernor";
import {
  CONTRACT_ADDRESSES,
  TaxTokenABI,
  RevenueSplitterABI,
  StakingVaultABI,
} from "@/lib/contracts";

type TemplateMode =
  | "set-buy-tax"
  | "set-sell-tax"
  | "update-revenue-split"
  | "set-lock-period"
  | "toggle-trading"
  | "custom";

const templates: { mode: TemplateMode; label: string }[] = [
  { mode: "set-buy-tax", label: "Set Buy Tax" },
  { mode: "set-sell-tax", label: "Set Sell Tax" },
  { mode: "update-revenue-split", label: "Revenue Split" },
  { mode: "set-lock-period", label: "Lock Period" },
  { mode: "toggle-trading", label: "Toggle Trading" },
  { mode: "custom", label: "Custom" },
];

export function CreateProposalForm() {
  const { address } = useAccount();
  const { propose, isPending, isConfirming, isSuccess, txHash } = useGovernor();

  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<TemplateMode>("set-buy-tax");

  // Template fields
  const [taxBps, setTaxBps] = useState("");
  const [stakingShare, setStakingShare] = useState("");
  const [burnShare, setBurnShare] = useState("");
  const [devShare, setDevShare] = useState("");
  const [lockDays, setLockDays] = useState("");
  const [tradingEnabled, setTradingEnabled] = useState(true);

  // Custom mode fields
  const [customTarget, setCustomTarget] = useState("");
  const [customValue, setCustomValue] = useState("0");
  const [customCalldata, setCustomCalldata] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description) return;

    let targets: `0x${string}`[];
    let values: bigint[];
    let calldatas: `0x${string}`[];

    switch (mode) {
      case "set-buy-tax": {
        if (!taxBps) return;
        targets = [CONTRACT_ADDRESSES.taxToken];
        values = [0n];
        calldatas = [
          encodeFunctionData({
            abi: TaxTokenABI,
            functionName: "setBuyTax",
            args: [BigInt(taxBps)],
          }),
        ];
        break;
      }
      case "set-sell-tax": {
        if (!taxBps) return;
        targets = [CONTRACT_ADDRESSES.taxToken];
        values = [0n];
        calldatas = [
          encodeFunctionData({
            abi: TaxTokenABI,
            functionName: "setSellTax",
            args: [BigInt(taxBps)],
          }),
        ];
        break;
      }
      case "update-revenue-split": {
        if (!stakingShare || !burnShare || !devShare) return;
        targets = [CONTRACT_ADDRESSES.revenueSplitter];
        values = [0n];
        calldatas = [
          encodeFunctionData({
            abi: RevenueSplitterABI,
            functionName: "setShares",
            args: [BigInt(stakingShare), BigInt(burnShare), BigInt(devShare)],
          }),
        ];
        break;
      }
      case "set-lock-period": {
        if (!lockDays) return;
        const seconds = BigInt(lockDays) * 86400n;
        targets = [CONTRACT_ADDRESSES.stakingVault];
        values = [0n];
        calldatas = [
          encodeFunctionData({
            abi: StakingVaultABI,
            functionName: "setMinLockPeriod",
            args: [seconds],
          }),
        ];
        break;
      }
      case "toggle-trading": {
        targets = [CONTRACT_ADDRESSES.taxToken];
        values = [0n];
        calldatas = [
          encodeFunctionData({
            abi: TaxTokenABI,
            functionName: "setTradingEnabled",
            args: [tradingEnabled],
          }),
        ];
        break;
      }
      case "custom": {
        if (!customTarget) return;
        targets = [customTarget as `0x${string}`];
        values = [parseEther(customValue || "0")];
        calldatas = [(customCalldata || "0x") as `0x${string}`];
        break;
      }
    }

    propose(targets, values, calldatas, description);
  }

  if (!address) {
    return (
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-center">
        <p className="text-[var(--muted)]">Connect your wallet to create a proposal</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Mode selector */}
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.mode}
            type="button"
            onClick={() => setMode(t.mode)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === t.mode
                ? "bg-[var(--primary)] text-white"
                : "bg-white/5 text-[var(--muted)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Describe the proposal..."
          className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--card-border)] text-sm focus:outline-none focus:border-[var(--primary)] resize-none"
          required
        />
      </div>

      {/* Template-specific fields */}
      {(mode === "set-buy-tax" || mode === "set-sell-tax") && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Tax (basis points, e.g. 500 = 5%)
          </label>
          <input
            type="number"
            value={taxBps}
            onChange={(e) => setTaxBps(e.target.value)}
            placeholder="500"
            min="0"
            max="2500"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--card-border)] text-sm focus:outline-none focus:border-[var(--primary)]"
            required
          />
          <p className="text-xs text-[var(--muted)] mt-1">Max: 2500 (25%)</p>
        </div>
      )}

      {mode === "update-revenue-split" && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm font-medium mb-2">Staking (bps)</label>
            <input
              type="number"
              value={stakingShare}
              onChange={(e) => setStakingShare(e.target.value)}
              placeholder="5000"
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--card-border)] text-sm focus:outline-none focus:border-[var(--primary)]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Burn (bps)</label>
            <input
              type="number"
              value={burnShare}
              onChange={(e) => setBurnShare(e.target.value)}
              placeholder="2000"
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--card-border)] text-sm focus:outline-none focus:border-[var(--primary)]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Dev (bps)</label>
            <input
              type="number"
              value={devShare}
              onChange={(e) => setDevShare(e.target.value)}
              placeholder="3000"
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--card-border)] text-sm focus:outline-none focus:border-[var(--primary)]"
              required
            />
          </div>
          <p className="col-span-3 text-xs text-[var(--muted)]">
            Must sum to 10000 or less (100%)
          </p>
        </div>
      )}

      {mode === "set-lock-period" && (
        <div>
          <label className="block text-sm font-medium mb-2">Lock Period (days)</label>
          <input
            type="number"
            value={lockDays}
            onChange={(e) => setLockDays(e.target.value)}
            placeholder="7"
            min="0"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--card-border)] text-sm focus:outline-none focus:border-[var(--primary)]"
            required
          />
        </div>
      )}

      {mode === "toggle-trading" && (
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium">Enable Trading</label>
          <button
            type="button"
            onClick={() => setTradingEnabled(!tradingEnabled)}
            className={`w-12 h-6 rounded-full transition-colors ${
              tradingEnabled ? "bg-green-500" : "bg-gray-600"
            }`}
          >
            <span
              className={`block w-5 h-5 rounded-full bg-white transition-transform ${
                tradingEnabled ? "translate-x-6" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-sm text-[var(--muted)]">
            {tradingEnabled ? "ON" : "OFF"}
          </span>
        </div>
      )}

      {mode === "custom" && (
        <>
          <div>
            <label className="block text-sm font-medium mb-2">Target Address</label>
            <input
              type="text"
              value={customTarget}
              onChange={(e) => setCustomTarget(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--card-border)] text-sm focus:outline-none focus:border-[var(--primary)]"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Value (BNB)</label>
            <input
              type="text"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--card-border)] text-sm focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Calldata (hex)</label>
            <input
              type="text"
              value={customCalldata}
              onChange={(e) => setCustomCalldata(e.target.value)}
              placeholder="0x..."
              className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[var(--card-border)] text-sm focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={isPending || isConfirming}
        className="w-full py-3 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-sm transition-colors disabled:opacity-50"
      >
        {isPending ? "Confirming in wallet..." : isConfirming ? "Submitting..." : "Create Proposal"}
      </button>

      {isSuccess && txHash && (
        <p className="text-sm text-green-400">
          Proposal created! TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
        </p>
      )}
    </form>
  );
}
