import { DocsSidebar } from "@/components/documentation/DocsSidebar";
import { DocsContent } from "@/components/documentation/DocsContent";

export const metadata = {
  title: "Documentation - OnChain DAO",
  description: "Complete reference for the OnChain DAO protocol",
};

export default function DocumentationPage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex gap-8">
        <DocsSidebar />
        <DocsContent />
      </div>
    </div>
  );
}
