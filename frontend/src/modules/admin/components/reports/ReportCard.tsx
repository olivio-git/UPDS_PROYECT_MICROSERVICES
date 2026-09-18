import { Card } from '@/components/atoms/card';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface ReportCardProps {
  icon: LucideIcon;
  title: ReactNode;
  /** Controls rendered on the right side of the header. */
  actions?: ReactNode;
  /** Extra content under the title row, inside the header. */
  subheader?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
}

/** Card shell shared by every section of the reports screen. */
export function ReportCard({ icon: Icon, title, actions, subheader, bodyClassName, children }: ReportCardProps) {
  return (
    <Card className="bg-card border-border shadow-none">
      <div className="px-4 py-2.5 border-b border-border/50">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </div>
          {actions}
        </div>
        {subheader}
      </div>
      <div className={cn('p-4 pb-3', bodyClassName)}>{children}</div>
    </Card>
  );
}
