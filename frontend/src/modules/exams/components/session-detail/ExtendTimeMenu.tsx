import { Button } from '@/components/atoms/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/atoms/dropdown-menu';
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
      <DropdownMenuTrigger asChild>
        <Button disabled={extend.isPending} size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
          {extend.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
          {extend.isPending ? 'Extendiendo...' : 'Extender'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {EXTENSION_MINUTES.map((minutes) => (
          <DropdownMenuItem key={minutes} onSelect={() => handleExtend(minutes)}>
            +{minutes} minutos
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
