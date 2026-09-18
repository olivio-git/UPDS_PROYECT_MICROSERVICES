import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/** Bordered section with a compact title row, used by the history screen. */
export function Panel({ icon: Icon, title, children }: { icon: LucideIcon; title: ReactNode; children: ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <h2 className="text-xs font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}
