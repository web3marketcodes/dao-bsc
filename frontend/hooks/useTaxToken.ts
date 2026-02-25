"use client";

import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES, TaxTokenABI } from "@/lib/contracts";

export function useTaxToken() {
  const { data: buyTax } = useReadContract({
    address: CONTRACT_ADDRESSES.taxToken,
    abi: TaxTokenABI,
    functionName: "buyTax",
  });

  const { data: sellTax } = useReadContract({
    address: CONTRACT_ADDRESSES.taxToken,
    abi: TaxTokenABI,
    functionName: "sellTax",
  });

  const { data: tradingEnabled } = useReadContract({
    address: CONTRACT_ADDRESSES.taxToken,
    abi: TaxTokenABI,
    functionName: "tradingEnabled",
  });

  const { data: maxTransactionAmount } = useReadContract({
    address: CONTRACT_ADDRESSES.taxToken,
    abi: TaxTokenABI,
    functionName: "maxTransactionAmount",
  });

  const { data: maxWalletAmount } = useReadContract({
    address: CONTRACT_ADDRESSES.taxToken,
    abi: TaxTokenABI,
    functionName: "maxWalletAmount",
  });

  const { data: totalSupply } = useReadContract({
    address: CONTRACT_ADDRESSES.taxToken,
    abi: TaxTokenABI,
    functionName: "totalSupply",
  });

  return {
    buyTax: buyTax as bigint | undefined,
    sellTax: sellTax as bigint | undefined,
    tradingEnabled: tradingEnabled as boolean | undefined,
    maxTransactionAmount: maxTransactionAmount as bigint | undefined,
    maxWalletAmount: maxWalletAmount as bigint | undefined,
    totalSupply: totalSupply as bigint | undefined,
    taxTokenAddress: CONTRACT_ADDRESSES.taxToken,
  };
}

export function useTaxTokenBalance(account: `0x${string}` | undefined) {
  const { data } = useReadContract({
    address: CONTRACT_ADDRESSES.taxToken,
    abi: TaxTokenABI,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: !!account },
  });

  return data as bigint | undefined;
}
