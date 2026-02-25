"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { formatEther, parseEther } from "viem";
import { useStakingVault } from "@/hooks/useStakingVault";

export function StakingPanel() {
  const { address } = useAccount();
  const {
    stakedBalance,
    earnedRewards,
    totalStaked,
    minLockPeriod,
    stake,
    withdraw,
    claimRewards,
    isPending,
    isConfirming,
    isSuccess,
  } = useStakingVault();

  const [stakeAmount, setStakeAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  function formatLockPeriod(seconds: bigint | undefined): string {
    if (seconds === undefined) return "—";
    const days = Number(seconds) / 86400;
    if (days >= 1) return `${days} day${days !== 1 ? "s" : ""}`;
    const hours = Number(seconds) / 3600;
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }

  if (!address) {
    return (
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-center">
        <p className="text-[var(--muted)]">Connect your wallet to stake</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
          <p className="text-xs text-[var(--muted)] mb-1">Your Staked</p>
          <p className="text-xl font-semibold">
            {stakedBalance ? Number(formatEther(stakedBalance)).toLocaleString() : "0"} DAO
          </p>
        </div>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
          <p className="text-xs text-[var(--muted)] mb-1">Pending Rewards</p>
          <p className="text-xl font-semibold">
            {earnedRewards
              ? Number(formatEther(earnedRewards)).toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })
              : "0"}{" "}
            TAX
          </p>
        </div>
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
          <p className="text-xs text-[var(--muted)] mb-1">Total Staked</p>
          <p className="text-xl font-semibold">
            {totalStaked ? Number(formatEther(totalStaked)).toLocaleString() : "0"} DAO
          </p>
        </div>
      </div>

      {/* Lock Period Info */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-4">
        <p className="text-xs text-[var(--muted)]">
          Lock Period: <span className="font-medium text-[var(--foreground)]">{formatLockPeriod(minLockPeriod)}</span>
        </p>
      </div>

      {/* Stake */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <h3 className="font-semibold mb-3">Stake DAO Tokens</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
            placeholder="Amount to stake"
            className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-[var(--card-border)] text-sm focus:outline-none focus:border-[var(--primary)]"
          />
          <button
            onClick={() => {
              if (stakeAmount) stake(parseEther(stakeAmount));
            }}
            disabled={isPending || isConfirming || !stakeAmount}
            className="px-6 py-2.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-sm transition-colors disabled:opacity-50"
          >
            Stake
          </button>
        </div>
      </div>

      {/* Withdraw */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <h3 className="font-semibold mb-3">Withdraw</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Amount to withdraw"
            className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-[var(--card-border)] text-sm focus:outline-none focus:border-[var(--primary)]"
          />
          <button
            onClick={() => {
              if (withdrawAmount) withdraw(parseEther(withdrawAmount));
            }}
            disabled={isPending || isConfirming || !withdrawAmount}
            className="px-6 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Withdraw
          </button>
        </div>
      </div>

      {/* Claim Rewards */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <h3 className="font-semibold mb-3">Claim Rewards</h3>
        <button
          onClick={claimRewards}
          disabled={isPending || isConfirming || !earnedRewards || earnedRewards === 0n}
          className="w-full py-2.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-sm transition-colors disabled:opacity-50"
        >
          {isPending
            ? "Confirming in wallet..."
            : isConfirming
            ? "Claiming..."
            : "Claim Rewards"}
        </button>
      </div>

      {isSuccess && (
        <p className="text-sm text-green-400">Transaction successful!</p>
      )}
    </div>
  );
}
