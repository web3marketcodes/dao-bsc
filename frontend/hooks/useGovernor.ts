"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACT_ADDRESSES, DAOGovernorABI } from "@/lib/contracts";
import { keccak256, toHex, encodeFunctionData } from "viem";

const governorConfig = {
  address: CONTRACT_ADDRESSES.daoGovernor,
  abi: DAOGovernorABI,
} as const;

export function useGovernor() {
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Read governor settings
  const { data: votingDelay } = useReadContract({
    ...governorConfig,
    functionName: "votingDelay",
  });

  const { data: votingPeriod } = useReadContract({
    ...governorConfig,
    functionName: "votingPeriod",
  });

  const { data: proposalThreshold } = useReadContract({
    ...governorConfig,
    functionName: "proposalThreshold",
  });

  // Create a proposal
  function propose(
    targets: `0x${string}`[],
    values: bigint[],
    calldatas: `0x${string}`[],
    description: string
  ) {
    writeContract({
      ...governorConfig,
      functionName: "propose",
      args: [targets, values, calldatas, description],
    });
  }

  // Cast a vote (0=Against, 1=For, 2=Abstain)
  function castVote(proposalId: bigint, support: number) {
    writeContract({
      ...governorConfig,
      functionName: "castVote",
      args: [proposalId, support],
    });
  }

  // Queue a succeeded proposal
  function queue(
    targets: `0x${string}`[],
    values: bigint[],
    calldatas: `0x${string}`[],
    descriptionHash: `0x${string}`
  ) {
    writeContract({
      ...governorConfig,
      functionName: "queue",
      args: [targets, values, calldatas, descriptionHash],
    });
  }

  // Execute a queued proposal
  function execute(
    targets: `0x${string}`[],
    values: bigint[],
    calldatas: `0x${string}`[],
    descriptionHash: `0x${string}`
  ) {
    writeContract({
      ...governorConfig,
      functionName: "execute",
      args: [targets, values, calldatas, descriptionHash],
    });
  }

  return {
    votingDelay: votingDelay as bigint | undefined,
    votingPeriod: votingPeriod as bigint | undefined,
    proposalThreshold: proposalThreshold as bigint | undefined,
    propose,
    castVote,
    queue,
    execute,
    isPending,
    isConfirming,
    isSuccess,
    txHash,
  };
}

// Hook to read a specific proposal's state
export function useProposalState(proposalId: bigint | undefined) {
  const { data, refetch } = useReadContract({
    ...governorConfig,
    functionName: "state",
    args: proposalId ? [proposalId] : undefined,
    query: { enabled: !!proposalId },
  });

  return { state: data as number | undefined, refetch };
}

// Hook to read proposal vote counts
export function useProposalVotes(proposalId: bigint | undefined) {
  const { data, refetch } = useReadContract({
    ...governorConfig,
    functionName: "proposalVotes",
    args: proposalId ? [proposalId] : undefined,
    query: { enabled: !!proposalId },
  });

  const votes = data as [bigint, bigint, bigint] | undefined;
  return {
    againstVotes: votes?.[0],
    forVotes: votes?.[1],
    abstainVotes: votes?.[2],
    refetch,
  };
}

// Hook to check if account has voted
export function useHasVoted(proposalId: bigint | undefined, account: `0x${string}` | undefined) {
  const { data } = useReadContract({
    ...governorConfig,
    functionName: "hasVoted",
    args: proposalId && account ? [proposalId, account] : undefined,
    query: { enabled: !!proposalId && !!account },
  });

  return data as boolean | undefined;
}
