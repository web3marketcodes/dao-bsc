"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACT_ADDRESSES, DAOTokenABI } from "@/lib/contracts";
import { parseEther } from "viem";

const tokenConfig = {
  address: CONTRACT_ADDRESSES.daoToken,
  abi: DAOTokenABI,
} as const;

export function useDAOToken() {
  const { address } = useAccount();
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  // Read balances and voting power
  const { data: balance } = useReadContract({
    ...tokenConfig,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: votingPower } = useReadContract({
    ...tokenConfig,
    functionName: "getVotes",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: totalSupply } = useReadContract({
    ...tokenConfig,
    functionName: "totalSupply",
  });

  const { data: delegates } = useReadContract({
    ...tokenConfig,
    functionName: "delegates",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Self-delegate
  function selfDelegate() {
    if (!address) return;
    writeContract({
      ...tokenConfig,
      functionName: "delegate",
      args: [address],
    });
  }

  // Delegate to another address
  function delegateTo(delegatee: `0x${string}`) {
    writeContract({
      ...tokenConfig,
      functionName: "delegate",
      args: [delegatee],
    });
  }

  return {
    balance: balance as bigint | undefined,
    votingPower: votingPower as bigint | undefined,
    totalSupply: totalSupply as bigint | undefined,
    delegates: delegates as `0x${string}` | undefined,
    selfDelegate,
    delegateTo,
    isPending,
    isConfirming,
    isSuccess,
    txHash,
  };
}
