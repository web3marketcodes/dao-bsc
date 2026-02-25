"use client";

import { CreateProposalForm } from "@/components/proposals/CreateProposalForm";

export default function CreateProposalPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Create Proposal</h1>
        <p className="text-[var(--muted)] text-sm">
          Submit a new governance proposal for the DAO to vote on. Use the Treasury
          Withdrawal template for common operations, or Custom mode for advanced calls.
        </p>
      </div>
      <CreateProposalForm />
    </div>
  );
}
