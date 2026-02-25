"use client";

import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { useDAOToken } from "@/hooks/useDAOToken";
import { useStakingVault } from "@/hooks/useStakingVault";

function formatValue(value: bigint | undefined, suffix: string, decimals = 0): string {
  if (value === undefined) return "0 " + suffix;
  return `${Number(formatEther(value)).toLocaleString(undefined, { maximumFractionDigits: decimals })} ${suffix}`;
}

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const { balance, votingPower, totalSupply } = useDAOToken();
  const { stakedBalance, earnedRewards, totalStaked } = useStakingVault();

  const personalStats = [
    {
      label: "Your Token Balance",
      value: isConnected ? formatValue(balance, "DAO") : undefined,
      icon: "wallet",
    },
    {
      label: "Your Voting Power",
      value: isConnected ? formatValue(votingPower, "votes") : undefined,
      icon: "vote",
    },
    {
      label: "Your Staked DAO",
      value: isConnected ? formatValue(stakedBalance, "DAO") : undefined,
      icon: "stake",
    },
    {
      label: "Pending Rewards",
      value: isConnected ? formatValue(earnedRewards, "TAX", 4) : undefined,
      icon: "reward",
    },
  ];

  const protocolStats = [
    {
      label: "Total Supply",
      value: formatValue(totalSupply, "DAO"),
    },
    {
      label: "Total Staked",
      value: formatValue(totalStaked, "DAO"),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
        <p className="text-[var(--muted)]">
          {isConnected
            ? `Connected: ${address?.slice(0, 6)}...${address?.slice(-4)}`
            : "Connect your wallet to get started"}
        </p>
      </div>

      {/* Wallet not connected prompt */}
      {!isConnected && (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-center">
          <div className="text-4xl mb-4 opacity-30">&#128274;</div>
          <h2 className="text-lg font-semibold mb-2">Wallet Not Connected</h2>
          <p className="text-sm text-[var(--muted)] mb-5 max-w-md mx-auto">
            Connect your wallet to view your balances, voting power, staked tokens, and participate in governance.
          </p>
          <appkit-button />
        </div>
      )}

      {/* Personal stats - only when connected */}
      {isConnected && (
        <div>
          <h2 className="text-sm font-medium text-[var(--muted)] mb-3 uppercase tracking-wider">Your Account</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {personalStats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5"
              >
                <p className="text-xs text-[var(--muted)] mb-1">{stat.label}</p>
                <p className="text-xl font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Protocol stats - always visible */}
      <div>
        <h2 className="text-sm font-medium text-[var(--muted)] mb-3 uppercase tracking-wider">Protocol Overview</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {protocolStats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5"
            >
              <p className="text-xs text-[var(--muted)] mb-1">{stat.label}</p>
              <p className="text-xl font-semibold">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-6">
        <h2 className="font-semibold mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {isConnected && (
            <>
              <a
                href="/delegate"
                className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors"
              >
                Delegate Votes
              </a>
              <a
                href="/proposals/create"
                className="px-4 py-2 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm transition-colors"
              >
                Create Proposal
              </a>
            </>
          )}
          <a
            href="/proposals"
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors"
          >
            View Proposals
          </a>
          <a
            href="/staking"
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors"
          >
            Stake DAO
          </a>
          <a
            href="/treasury"
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm transition-colors"
          >
            Treasury
          </a>
        </div>
      </div>
    </div>
  );
}
