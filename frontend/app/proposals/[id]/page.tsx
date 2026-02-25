"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { usePublicClient, useAccount } from "wagmi";
import { parseAbiItem, keccak256, toBytes } from "viem";
import { CONTRACT_ADDRESSES, PROPOSAL_STATES, PROPOSAL_STATE_COLORS, DEPLOYMENT_BLOCK, getLogsInChunks } from "@/lib/contracts";
import { useProposalState } from "@/hooks/useGovernor";
import { useGovernor } from "@/hooks/useGovernor";
import { VotePanel } from "@/components/proposals/VotePanel";
import type { ProposalData } from "@/components/proposals/ProposalCard";
import { Markdown } from "@/components/proposals/Markdown";

const proposalCreatedEvent = parseAbiItem(
  "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)"
);

export default function ProposalDetailPage() {
  const params = useParams();
  const proposalId = params.id ? BigInt(params.id as string) : undefined;
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { state } = useProposalState(proposalId);
  const { queue, execute, isPending, isConfirming } = useGovernor();
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);

  const stateName = state !== undefined ? PROPOSAL_STATES[state] : "Loading...";
  const stateColor = PROPOSAL_STATE_COLORS[stateName] || "bg-gray-500/20 text-gray-400";

  useEffect(() => {
    async function fetchProposal() {
      if (!publicClient || !proposalId) return;

      try {
        const logs = await getLogsInChunks(publicClient, {
          address: CONTRACT_ADDRESSES.daoGovernor,
          event: proposalCreatedEvent,
          fromBlock: DEPLOYMENT_BLOCK,
        });

        const match = logs.find(
          (log: any) => log.args.proposalId === proposalId
        );

        if (match) {
          setProposal({
            proposalId: match.args.proposalId!,
            proposer: match.args.proposer!,
            description: match.args.description!,
            targets: match.args.targets!,
            values: match.args.values!,
            calldatas: match.args.calldatas!,
          });
        }
      } catch (err) {
        console.error("Failed to fetch proposal:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProposal();
  }, [publicClient, proposalId]);

  function handleQueue() {
    if (!proposal) return;
    const descriptionHash = keccak256(toBytes(proposal.description));
    queue(
      [...proposal.targets] as `0x${string}`[],
      [...proposal.values],
      [...proposal.calldatas] as `0x${string}`[],
      descriptionHash
    );
  }

  function handleExecute() {
    if (!proposal) return;
    const descriptionHash = keccak256(toBytes(proposal.description));
    execute(
      [...proposal.targets] as `0x${string}`[],
      [...proposal.values],
      [...proposal.calldatas] as `0x${string}`[],
      descriptionHash
    );
  }

  if (loading) {
    return <div className="text-center py-12 text-[var(--muted)]">Loading proposal...</div>;
  }

  if (!proposal) {
    return <div className="text-center py-12 text-[var(--muted)]">Proposal not found</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${stateColor}`}>
            {stateName}
          </span>
          <span className="text-xs text-[var(--muted)]">
            ID: {proposal.proposalId.toString().slice(0, 12)}...
          </span>
        </div>
        <h1 className="text-2xl font-bold mb-2">
          {proposal.description.split("\n")[0].replace(/^#\s*/, "")}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Proposed by {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}
        </p>
      </div>

      {/* Description */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
        <Markdown>
          {proposal.description.split("\n").slice(1).join("\n").trim()}
        </Markdown>
      </div>

      {/* Vote panel */}
      {proposalId && <VotePanel proposalId={proposalId} />}

      {/* Queue / Execute buttons */}
      {address && (
        <div className="flex gap-3">
          {state === 4 && ( // Succeeded
            <button
              onClick={handleQueue}
              disabled={isPending || isConfirming}
              className="flex-1 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
            >
              {isPending || isConfirming ? "Processing..." : "Queue for Execution"}
            </button>
          )}
          {state === 5 && ( // Queued
            <button
              onClick={handleExecute}
              disabled={isPending || isConfirming}
              className="flex-1 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors disabled:opacity-50"
            >
              {isPending || isConfirming ? "Processing..." : "Execute Proposal"}
            </button>
          )}
        </div>
      )}

      {/* Actions details */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
        <h3 className="font-medium mb-3">Actions</h3>
        {proposal.targets.map((target, i) => (
          <div key={i} className="text-sm space-y-1 py-2 border-t border-[var(--card-border)] first:border-0">
            <p>
              <span className="text-[var(--muted)]">Target:</span>{" "}
              <span className="font-mono">{target}</span>
            </p>
            <p>
              <span className="text-[var(--muted)]">Value:</span>{" "}
              {proposal.values[i].toString()} wei
            </p>
            <p>
              <span className="text-[var(--muted)]">Calldata:</span>{" "}
              <span className="font-mono text-xs break-all">{proposal.calldatas[i]}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
