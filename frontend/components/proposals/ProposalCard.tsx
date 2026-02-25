"use client";

import Link from "next/link";
import { formatEther } from "viem";
import { PROPOSAL_STATES, PROPOSAL_STATE_COLORS } from "@/lib/contracts";
import { useProposalState, useProposalVotes } from "@/hooks/useGovernor";

export interface ProposalData {
  proposalId: bigint;
  proposer: string;
  description: string;
  targets: readonly `0x${string}`[];
  values: readonly bigint[];
  calldatas: readonly `0x${string}`[];
}

export function ProposalCard({ proposal }: { proposal: ProposalData }) {
  const { state } = useProposalState(proposal.proposalId);
  const { forVotes, againstVotes, abstainVotes } = useProposalVotes(proposal.proposalId);

  const stateName = state !== undefined ? PROPOSAL_STATES[state] : "Loading...";
  const stateColor = PROPOSAL_STATE_COLORS[stateName] || "bg-gray-500/20 text-gray-400";

  // Extract title and summary from description
  const lines = proposal.description.split("\n");
  const title = lines[0].replace(/^#\s*/, "");
  const summary = lines
    .slice(1)
    .map((l) => l.replace(/\*\*/g, "").replace(/^#+\s*/, "").trim())
    .filter((l) => l.length > 0)
    .slice(0, 2)
    .join(" ");
  const totalVotes = (forVotes || 0n) + (againstVotes || 0n) + (abstainVotes || 0n);

  return (
    <Link
      href={`/proposals/${proposal.proposalId.toString()}`}
      className="block p-5 rounded-xl border border-[var(--card-border)] bg-[var(--card)] hover:border-[var(--primary)]/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-medium text-sm leading-snug line-clamp-2 flex-1">
          {title}
        </h3>
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium shrink-0 ${stateColor}`}>
          {stateName}
        </span>
      </div>

      {summary && (
        <p className="text-xs text-[var(--muted)] mb-2 line-clamp-2 leading-relaxed">
          {summary}
        </p>
      )}
      <p className="text-xs text-[var(--muted)] mb-3 truncate opacity-60">
        by {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}
      </p>

      {totalVotes > 0n && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-green-400">For: {formatEther(forVotes || 0n)}</span>
            <span className="text-red-400">Against: {formatEther(againstVotes || 0n)}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden flex">
            {totalVotes > 0n && (
              <>
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${Number((forVotes || 0n) * 100n / totalVotes)}%` }}
                />
                <div
                  className="h-full bg-red-500"
                  style={{ width: `${Number((againstVotes || 0n) * 100n / totalVotes)}%` }}
                />
              </>
            )}
          </div>
        </div>
      )}
    </Link>
  );
}
