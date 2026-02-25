"use client";

import { useAccount } from "wagmi";
import { formatEther } from "viem";
import { useGovernor, useProposalVotes, useProposalState, useHasVoted } from "@/hooks/useGovernor";
import { PROPOSAL_STATES } from "@/lib/contracts";

interface VotePanelProps {
  proposalId: bigint;
}

export function VotePanel({ proposalId }: VotePanelProps) {
  const { address } = useAccount();
  const { castVote, isPending, isConfirming } = useGovernor();
  const { state } = useProposalState(proposalId);
  const { forVotes, againstVotes, abstainVotes } = useProposalVotes(proposalId);
  const hasVoted = useHasVoted(proposalId, address);

  const isActive = state === 1; // Active
  const totalVotes = (forVotes || 0n) + (againstVotes || 0n) + (abstainVotes || 0n);
  const stateName = state !== undefined ? PROPOSAL_STATES[state] : "Loading...";

  const voteButtons = [
    { label: "For", value: 1, color: "bg-green-600 hover:bg-green-700" },
    { label: "Against", value: 0, color: "bg-red-600 hover:bg-red-700" },
    { label: "Abstain", value: 2, color: "bg-gray-600 hover:bg-gray-700" },
  ];

  return (
    <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
      <h3 className="font-semibold mb-4">Cast Your Vote</h3>

      {/* Vote counts */}
      <div className="space-y-3 mb-5">
        <VoteBar label="For" votes={forVotes || 0n} total={totalVotes} color="bg-green-500" />
        <VoteBar label="Against" votes={againstVotes || 0n} total={totalVotes} color="bg-red-500" />
        <VoteBar label="Abstain" votes={abstainVotes || 0n} total={totalVotes} color="bg-gray-500" />
      </div>

      {/* Vote buttons */}
      {!address ? (
        <p className="text-sm text-[var(--muted)]">Connect wallet to vote</p>
      ) : hasVoted ? (
        <p className="text-sm text-green-400">You have already voted on this proposal</p>
      ) : !isActive ? (
        <p className="text-sm text-[var(--muted)]">
          Voting is not active (Status: {stateName})
        </p>
      ) : (
        <div className="flex gap-2">
          {voteButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => castVote(proposalId, btn.value)}
              disabled={isPending || isConfirming}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 ${btn.color}`}
            >
              {isPending || isConfirming ? "..." : btn.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function VoteBar({
  label,
  votes,
  total,
  color,
}: {
  label: string;
  votes: bigint;
  total: bigint;
  color: string;
}) {
  const pct = total > 0n ? Number((votes * 100n) / total) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="text-[var(--muted)]">
          {Number(formatEther(votes)).toLocaleString(undefined, { maximumFractionDigits: 2 })} ({pct}%)
        </span>
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
