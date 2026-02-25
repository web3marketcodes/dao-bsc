"use client";

import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useAccount } from "wagmi";
import { CONTRACT_ADDRESSES, StakingVaultABI } from "@/lib/contracts";

export function useStakingVault() {
  const { address } = useAccount();

  const { data: stakedBalance } = useReadContract({
    address: CONTRACT_ADDRESSES.stakingVault,
    abi: StakingVaultABI,
    functionName: "getStakedBalance",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: earnedRewards } = useReadContract({
    address: CONTRACT_ADDRESSES.stakingVault,
    abi: StakingVaultABI,
    functionName: "getEarnedRewards",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: totalStaked } = useReadContract({
    address: CONTRACT_ADDRESSES.stakingVault,
    abi: StakingVaultABI,
    functionName: "totalStaked",
  });

  const { data: minLockPeriod } = useReadContract({
    address: CONTRACT_ADDRESSES.stakingVault,
    abi: StakingVaultABI,
    functionName: "minLockPeriod",
  });

  const {
    data: txHash,
    writeContract,
    isPending,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  function stake(amount: bigint) {
    writeContract({
      address: CONTRACT_ADDRESSES.stakingVault,
      abi: StakingVaultABI,
      functionName: "stake",
      args: [amount],
    });
  }

  function withdraw(amount: bigint) {
    writeContract({
      address: CONTRACT_ADDRESSES.stakingVault,
      abi: StakingVaultABI,
      functionName: "withdraw",
      args: [amount],
    });
  }

  function claimRewards() {
    writeContract({
      address: CONTRACT_ADDRESSES.stakingVault,
      abi: StakingVaultABI,
      functionName: "claimRewards",
    });
  }

  return {
    stakedBalance: stakedBalance as bigint | undefined,
    earnedRewards: earnedRewards as bigint | undefined,
    totalStaked: totalStaked as bigint | undefined,
    minLockPeriod: minLockPeriod as bigint | undefined,
    stake,
    withdraw,
    claimRewards,
    isPending,
    isConfirming,
    isSuccess,
    txHash,
  };
}
