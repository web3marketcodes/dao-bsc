"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { CONTRACT_ADDRESSES, DEPLOYMENT_BLOCK, getLogsInChunks } from "@/lib/contracts";
import { ProposalCard, type ProposalData } from "@/components/proposals/ProposalCard";

const proposalCreatedEvent = parseAbiItem(
  "event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)"
);

export default function ProposalsPage() {
  const publicClient = usePublicClient();
  const [proposals, setProposals] = useState<ProposalData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProposals() {
      if (!publicClient) return;

      try {
        const logs = await getLogsInChunks(publicClient, {
          address: CONTRACT_ADDRESSES.daoGovernor,
          event: proposalCreatedEvent,
          fromBlock: DEPLOYMENT_BLOCK,
        });

        const parsed: ProposalData[] = logs.map((log: any) => ({
          proposalId: log.args.proposalId!,
          proposer: log.args.proposer!,
          description: log.args.description!,
          targets: log.args.targets!,
          values: log.args.values!,
          calldatas: log.args.calldatas!,
        }));

        setProposals(parsed.reverse());
      } catch (err) {
        console.error("Failed to fetch proposals:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchProposals();
  }, [publicClient]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Proposals</h1>
        <a
          href="/proposals/create"
          className="px-4 py-2 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white text-sm font-medium transition-colors"
        >
          New Proposal
        </a>
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--muted)]">Loading proposals...</div>
      ) : proposals.length === 0 ? (
        <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-12 text-center">
          <p className="text-[var(--muted)] mb-4">No proposals yet</p>
          <a
            href="/proposals/create"
            className="text-[var(--primary)] hover:underline text-sm"
          >
            Create the first proposal
          </a>
        </div>
      ) : (
        <div className="grid gap-4">
          {proposals.map((p) => (
            <ProposalCard key={p.proposalId.toString()} proposal={p} />
          ))}
        </div>
      )}
    </div>
  );
}
