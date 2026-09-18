import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

/** Opens the live monitor for a running session, the detail otherwise. */
export function SessionOpenButton({ live, onClick, className }: { live: boolean; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={live ? 'Ir al monitor' : 'Ver detalle'}
      title={live ? 'Ir al monitor en vivo' : 'Ver detalle de sesión'}
      className={cn(
        'shrink-0 rounded transition-colors',
        live ? 'text-green-600 hover:text-green-500 dark:text-green-400' : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      <ExternalLink className="h-full w-full" />
    </button>
  );
}
