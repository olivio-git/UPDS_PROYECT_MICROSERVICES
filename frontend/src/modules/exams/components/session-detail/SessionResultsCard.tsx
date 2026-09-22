import { scoreBarClass, scoreTextClass } from '@/lib/scoreBands';
import { cn } from '@/lib/utils';
import type { SessionResultRow } from '@/services/examResultService';
import { AlertTriangle, BarChart3, Eye, Loader2, RefreshCw, RotateCcw, User2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useCandidateNames, useRegradeSession, useSessionResults } from '../../hooks/useSessionDetailQueries';
import { ResultDetailDialog } from './ResultDetailDialog';
import { candidateLabel, resultStatusPill } from './sessionDisplay';

/** Time used above this fraction of the allowance is highlighted. */
const HIGH_TIME_USAGE = 0.8;
const VISIBLE_COMPETENCIES = 3;

function ResultRow({ index, result, name, onOpen }: { index: number; result: SessionResultRow; name: string | undefined; onOpen: () => void }) {
  const status = resultStatusPill(result.status);
  const minutes = Math.round(result.examDuration / 60);
  const highUsage = result.timeAllowed > 0 && result.examDuration / result.timeAllowed > HIGH_TIME_USAGE;
  const shown = result.competencyScores.slice(0, VISIBLE_COMPETENCIES);
  const hidden = result.competencyScores.length - shown.length;
  const chip = 'inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground border border-border';

  return (
    <tr
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
      tabIndex={0}
      aria-label={`Ver detalle de ${name ?? 'candidato'}`}
      className="border-b border-border/60 hover:bg-muted/30 focus:bg-muted/30 focus:outline-none transition-colors cursor-pointer"
    >
      <td className="px-2 py-2.5 text-muted-foreground"><Eye className="w-3.5 h-3.5 text-muted-foreground/50" /></td>
      <td className="px-3 py-2.5 text-muted-foreground">{index + 1}</td>
      <td className="px-3 py-2.5">
        {name
          ? <span className="text-foreground/80 font-medium">{name}</span>
          : <span className="font-mono text-muted-foreground text-xs">...{result.candidateId.slice(-8)}</span>}
      </td>
      <td className="px-3 py-2.5">
        <div className="space-y-1">
          <span className={cn('font-bold text-sm', scoreTextClass(result.percentage))}>{result.percentage.toFixed(1)}%</span>
          <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full', scoreBarClass(result.percentage))} style={{ width: `${Math.min(result.percentage, 100)}%` }} />
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-foreground/80">{result.totalScore}/{result.maxScore}</td>
      <td className="px-3 py-2.5">
        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border', status.className)}>{status.label}</span>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap gap-1">
          {shown.map((c) => <span key={c.competency} className={chip}>{c.competency} {c.percentage.toFixed(0)}%</span>)}
          {hidden > 0 && <span className={chip}>+{hidden}</span>}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span className={cn('font-medium', highUsage ? 'text-orange-600 dark:text-orange-400' : 'text-foreground/80')}>{minutes}min</span>
      </td>
      <td className="px-3 py-2.5">
        {result.recommendedLevel
          ? <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">{result.recommendedLevel}</span>
          : <span className="text-muted-foreground/50">—</span>}
      </td>
    </tr>
  );
}

const HEADERS = ['Candidato', '%', 'Puntaje', 'Estado', 'Competencias', 'Tiempo', 'Nivel rec.'];

function Centered({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col items-center justify-center px-4 gap-3', className ?? 'py-12')}>{children}</div>;
}

export function SessionResultsCard({ sessionId, completed }: { sessionId: string; completed: boolean }) {
  const results = useSessionResults(sessionId, completed);
  const rows = results.data ?? [];
  const { data: names } = useCandidateNames(rows.map((r) => r.candidateId));
  const regrade = useRegradeSession(sessionId);
  const [openId, setOpenId] = useState<string | null>(null);
  const openResult = rows.find((r) => r.id === openId) ?? null;
  const ready = completed && results.data !== undefined && !results.isFetching;

  const handleRegrade = () => {
    if (regrade.isPending) return;
    regrade.mutate(undefined, {
      onSuccess: ({ queued, total }) => toast.success(`Recalificación completada: ${queued}/${total} intentos procesados`),
      onError: () => toast.error('Error al iniciar la recalificación'),
    });
  };

  let body: ReactNode;
  if (!completed) {
    body = (
      <Centered>
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><BarChart3 className="w-5 h-5 text-muted-foreground" /></div>
        <p className="text-sm text-muted-foreground text-center">Disponible cuando la sesión esté completada</p>
      </Centered>
    );
  } else if (results.isFetching && results.data === undefined) {
    body = (
      <div className="flex items-center justify-center py-12 gap-2">
        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
        <span className="text-sm text-muted-foreground">Cargando resultados...</span>
      </div>
    );
  } else if (results.isError) {
    body = (
      <Centered className="py-10">
        <AlertTriangle className="w-6 h-6 text-red-400" />
        <p className="text-sm text-red-400 text-center">{results.error.message}</p>
        <button
          type="button"
          onClick={() => results.refetch()}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground/80 border border-border transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Reintentar
        </button>
      </Centered>
    );
  } else if (rows.length === 0) {
    body = (
      <Centered>
        <User2 className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No hay resultados registrados aún</p>
      </Centered>
    );
  } else {
    body = (
      <div className={cn('overflow-x-auto transition-opacity', results.isFetching && 'opacity-60')}>
        <table className="w-full text-xs" aria-label="Resultados de candidatos">
          <thead>
            <tr className="border-b border-border">
              <th className="px-2 py-2.5 w-6" aria-label="Ver detalle" />
              <th className="px-3 py-2.5 text-left text-muted-foreground font-medium w-8">#</th>
              {HEADERS.map((h) => <th key={h} className="px-3 py-2.5 text-left text-muted-foreground font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((result, index) => (
              <ResultRow key={result.id} index={index} result={result} name={names?.[result.candidateId]} onOpen={() => setOpenId(result.id)} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-muted-foreground">Resultados de candidatos</h2>
          {completed && results.data !== undefined && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">{rows.length}</span>
          )}
        </div>
        {ready && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRegrade}
              disabled={regrade.isPending}
              title="Recalcular calificaciones con la lógica actual (incluye preguntas sin responder)"
              className="text-xs text-amber-600 hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300 flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Recalcular calificaciones"
            >
              <RotateCcw className={cn('w-3.5 h-3.5', regrade.isPending && 'animate-spin')} />
              {regrade.isPending ? 'Recalculando...' : 'Recalcular'}
            </button>
            <span className="text-border">|</span>
            <button
              type="button"
              onClick={() => results.refetch()}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              aria-label="Recargar resultados"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Actualizar
            </button>
          </div>
        )}
      </div>
      {body}
      <ResultDetailDialog
        result={openResult}
        candidateName={openResult ? candidateLabel(openResult.candidateId, names) : ''}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}
