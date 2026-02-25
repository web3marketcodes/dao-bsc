"use client";

import { DelegationInfo } from "@/components/delegate/DelegationInfo";
import { DelegateForm } from "@/components/delegate/DelegateForm";

export default function DelegatePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Delegate</h1>
        <p className="text-[var(--muted)] text-sm">
          Token holders must delegate their voting power before it can be used.
          Delegate to yourself to vote directly, or delegate to another address to let them vote on your behalf.
        </p>
      </div>
      <DelegationInfo />
      <DelegateForm />
    </div>
  );
}
