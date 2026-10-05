import { Card } from '@/components/keel/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Small muted caption under the number. */
  caption?: ReactNode;
  icon?: LucideIcon;
  /** Colour of the small icon only (e.g. "text-blue-500"); the card stays neutral. */
  iconClassName?: string;
  /** Native tooltip with the metric's explanation. */
  title?: string;
  className?: string;
}

/**
 * One metric: label and a small icon on top, the number large, an optional
 * muted caption. Every KPI row in the app uses it so they read the same.
 */
export function StatCard({ label, value, caption, icon: Icon, iconClassName, title, className }: StatCardProps) {
  return (
    <Card title={title} className={cn('cursor-default gap-2 px-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        {Icon && <Icon className={cn('size-4 shrink-0 text-muted-foreground', iconClassName)} />}
      </div>
      <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </Card>
  );
}
