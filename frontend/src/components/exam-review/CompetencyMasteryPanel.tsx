import { cn } from '@/lib/utils';
import { CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
import type { CompetencyMastery } from './types';

/**
 * Fixed competency set. Every Level document requires exactly these 6 keys
 * in `competencyRequirements` (verified against `cba_platform.levels`), so
 * any of them missing from `mastery.competencies` means the exam never
 * evaluated it — rendered "No evaluado" below by diffing against this list,
 * with no extra backend field needed.
 */
const MASTERY_COMPETENCIES = ['reading', 'writing', 'listening', 'speaking', 'grammar', 'vocabulary'] as const;

const MASTERY_COMPETENCY_LABELS: Record<string, string> = {
  reading: 'Comprensión Lectora',
  writing: 'Expresión Escrita',
  listening: 'Comprensión Auditiva',
  speaking: 'Expresión Oral',
  grammar: 'Gramática',
  vocabulary: 'Vocabulario',
};

type MasteryState = 'achieved' | 'not-achieved' | 'not-evaluated';

function MasteryBadge({ state }: { state: MasteryState }) {
  if (state === 'not-evaluated') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-border text-muted-foreground bg-muted/40 shrink-0">
        <HelpCircle className="h-3 w-3" /> No evaluado
      </span>
    );
  }
  const achieved = state === 'achieved';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border shrink-0',
        achieved
          ? 'border-green-200 text-green-700 bg-green-100 dark:border-green-500/30 dark:text-green-300 dark:bg-green-500/10'
          : 'border-red-200 text-red-700 bg-red-100 dark:border-red-500/30 dark:text-red-300 dark:bg-red-500/10'
      )}
    >
      {achieved ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {achieved ? 'Alcanzado' : 'No alcanzado'}
    </span>
  );
}

/**
 * Level-mastery indicator (level-mastery-indicator spec): per-competency and
 * overall achieved/not-achieved vs the exam's `targetLevel` requirements.
 *
 * Purely informational — deliberately styled as a muted, boxed surface
 * separate from the Aprobado/No aprobado verdict badge, so it is never
 * mistaken for the pass/fail decision (it never affects it, see
 * `computeMastery` in mcp-grading-server/src/grading/scoring.ts).
 *
 * `mastery.competencies` only lists competencies the exam actually
 * evaluated. Renders every other fixed competency as "No evaluado".
 */
export function CompetencyMasteryPanel({ mastery }: { mastery?: CompetencyMastery | null }) {
  if (!mastery) return null;
  const byCompetency = new Map((mastery.competencies ?? []).map(c => [c.competency, c]));

  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Dominio por competencia — Nivel {mastery.levelCode}
        </p>
        <MasteryBadge state={mastery.overall.achieved ? 'achieved' : 'not-achieved'} />
      </div>
      <p className="text-[11px] text-muted-foreground">
        Indicador informativo, no afecta el resultado Aprobado / No aprobado.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {MASTERY_COMPETENCIES.map((competency) => {
          const item = byCompetency.get(competency);
          const state: MasteryState = !item ? 'not-evaluated' : item.achieved ? 'achieved' : 'not-achieved';
          return (
            <div
              key={competency}
              className="flex items-center justify-between gap-1.5 bg-background/60 border border-border/60 rounded-md px-2 py-1.5"
            >
              <span className="text-xs text-foreground/80 truncate">{MASTERY_COMPETENCY_LABELS[competency]}</span>
              <MasteryBadge state={state} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
