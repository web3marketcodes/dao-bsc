interface DocsSectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

export function DocsSection({ id, title, children }: DocsSectionProps) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl font-bold mb-4 text-white">{title}</h2>
      {children}
    </section>
  );
}

interface DocsSubSectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
}

export function DocsSubSection({ id, title, children }: DocsSubSectionProps) {
  return (
    <div id={id} className="scroll-mt-24">
      <h3 className="text-lg font-semibold mb-3 text-white">{title}</h3>
      {children}
    </div>
  );
}
