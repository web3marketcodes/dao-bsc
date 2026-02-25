"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { CONTRACT_ADDRESSES, RevenueSplitterABI } from "@/lib/contracts";

export function useRevenueSplitter() {
  const { data: stakingShare } = useReadContract({
    address: CONTRACT_ADDRESSES.revenueSplitter,
    abi: RevenueSplitterABI,
    functionName: "stakingShare",
  });

  const { data: burnShare } = useReadContract({
    address: CONTRACT_ADDRESSES.revenueSplitter,
    abi: RevenueSplitterABI,
    functionName: "burnShare",
  });

  const { data: devShare } = useReadContract({
    address: CONTRACT_ADDRESSES.revenueSplitter,
    abi: RevenueSplitterABI,
    functionName: "devShare",
  });

  const { data: accumulatedBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.revenueSplitter,
    abi: RevenueSplitterABI,
    functionName: "getAccumulatedBalance",
  });

  const {
    data: txHash,
    writeContract,
    isPending,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  function distribute() {
    writeContract({
      address: CONTRACT_ADDRESSES.revenueSplitter,
      abi: RevenueSplitterABI,
      functionName: "distribute",
    });
  }

  return {
    stakingShare: stakingShare as bigint | undefined,
    burnShare: burnShare as bigint | undefined,
    devShare: devShare as bigint | undefined,
    accumulatedBalance: accumulatedBalance as bigint | undefined,
    distribute,
    isPending,
    isConfirming,
    isSuccess,
    txHash,
  };
}
