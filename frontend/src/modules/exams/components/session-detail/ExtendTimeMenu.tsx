import { Button } from '@/components/keel/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/keel/dropdown-menu';
import { Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useExtendSession } from '../../hooks/useSessionDetailQueries';

const EXTENSION_MINUTES = [15, 30, 45, 60] as const;

/**
 * Adds time to a running or scheduled session. Used by proctors during an
 * exam, so it must stay simple and reliable.
 */
export function ExtendTimeMenu({ sessionId }: { sessionId: string }) {
  const extend = useExtendSession(sessionId);

  const handleExtend = (minutes: number) => {
    extend.mutate(minutes, {
      onSuccess: () => toast.success(`Tiempo extendido por ${minutes} minutos`),
      onError: () => toast.error('Error al extender el tiempo de la sesión'),
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button disabled={extend.isPending} size="sm"/>}>
        {extend.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
        {extend.isPending ? 'Extendiendo...' : 'Extender'}
      
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {EXTENSION_MINUTES.map((minutes) => (
          <DropdownMenuItem key={minutes} onClick={() => handleExtend(minutes)}>
            +{minutes} minutos
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
