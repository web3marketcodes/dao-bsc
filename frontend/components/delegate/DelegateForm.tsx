"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useDAOToken } from "@/hooks/useDAOToken";

export function DelegateForm() {
  const { address } = useAccount();
  const { delegateTo, selfDelegate, isPending, isConfirming, isSuccess, txHash } = useDAOToken();
  const [delegateAddress, setDelegateAddress] = useState("");

  if (!address) {
    return (
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-8 text-center">
        <p className="text-[var(--muted)]">Connect your wallet to delegate</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Self-delegate button */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
        <h3 className="font-medium mb-2">Self-Delegate</h3>
        <p className="text-sm text-[var(--muted)] mb-4">
          Activate your own voting power by delegating to yourself.
        </p>
        <button
          onClick={selfDelegate}
          disabled={isPending || isConfirming}
          className="w-full py-2.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-sm transition-colors disabled:opacity-50"
        >
          {isPending ? "Confirming..." : isConfirming ? "Delegating..." : "Delegate to Self"}
        </button>
      </div>

      {/* Delegate to address */}
      <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] p-5">
        <h3 className="font-medium mb-2">Delegate to Address</h3>
        <p className="text-sm text-[var(--muted)] mb-4">
          Transfer your voting power to another address while keeping your tokens.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={delegateAddress}
            onChange={(e) => setDelegateAddress(e.target.value)}
            placeholder="0x..."
            className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 border border-[var(--card-border)] text-sm focus:outline-none focus:border-[var(--primary)]"
          />
          <button
            onClick={() => delegateTo(delegateAddress as `0x${string}`)}
            disabled={!delegateAddress || isPending || isConfirming}
            className="px-6 py-2.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-white font-medium text-sm transition-colors disabled:opacity-50"
          >
            Delegate
          </button>
        </div>
      </div>

      {isSuccess && txHash && (
        <p className="text-sm text-green-400">
          Delegation successful! TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
        </p>
      )}
    </div>
  );
}
