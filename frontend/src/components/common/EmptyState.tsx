import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/keel/empty';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  /** A button or link, e.g. "Crear primer examen". */
  action?: ReactNode;
  /** Use the destructive tone (load errors). */
  tone?: 'default' | 'destructive';
  className?: string;
}

/**
 * The one empty/error state every list and panel uses, built on keel's Empty:
 * a small icon tile, a title, an optional line of help and an optional action,
 * centred in whatever space the list leaves.
 */
export function EmptyState({ title, description, icon: Icon = Inbox, action, tone = 'default', className }: EmptyStateProps) {
  return (
    <Empty className={cn('py-12', className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon" className={tone === 'destructive' ? 'bg-destructive/10 text-destructive' : undefined}>
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        {description && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
      {action && <EmptyContent>{action}</EmptyContent>}
    </Empty>
  );
}
