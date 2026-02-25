"use client";

import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { useDAOToken } from "@/hooks/useDAOToken";

export function DelegationInfo() {
  const { address } = useAccount();
  const { balance, votingPower, delegates } = useDAOToken();

  if (!address) return null;

  const isDelegating = delegates && delegates !== "0x0000000000000000000000000000000000000000";
  const isSelfDelegated = delegates === address;

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5 space-y-4">
      <h3 className="font-semibold">Your Delegation Status</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-[var(--muted)] mb-1">Token Balance</p>
          <p className="text-lg font-medium">
            {balance ? Number(formatEther(balance)).toLocaleString() : "0"} DAO
          </p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted)] mb-1">Voting Power</p>
          <p className="text-lg font-medium">
            {votingPower ? Number(formatEther(votingPower)).toLocaleString() : "0"} votes
          </p>
        </div>
      </div>

      <div>
        <p className="text-xs text-[var(--muted)] mb-1">Current Delegate</p>
        {!isDelegating ? (
          <p className="text-sm text-yellow-400">Not delegated - your tokens have no voting power!</p>
        ) : isSelfDelegated ? (
          <p className="text-sm text-green-400">Self-delegated (you vote with your own tokens)</p>
        ) : (
          <p className="text-sm">
            {delegates?.slice(0, 6)}...{delegates?.slice(-4)}
          </p>
        )}
      </div>
    </div>
  );
}
