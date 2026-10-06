import { Button } from '@/components/keel/button';
import { Kbd, KbdGroup } from '@/components/keel/kbd';
import { Textarea } from '@/components/keel/textarea';
import { cn } from '@/lib/utils';
import { scoreFromRubric, type ReviewTask, type SubmitReviewInput } from '@/services/reviewService';
import { ChevronDown, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const QUICK_COMMENTS = [
  'Buena organización de ideas.',
  'Revisa los tiempos verbales.',
  'Amplía con más detalles.',
  'Usa conectores (and, but, because).',
  'Cuida la ortografía.',
];

interface GradingPanelProps {
  task: ReviewTask;
  submitting?: boolean;
  onSubmit: (input: SubmitReviewInput) => void;
  onSkip: () => void;
}

/** Score an answer with the rubric (or a plain score), plus a comment. */
export function GradingPanel({ task, submitting, onSubmit, onSkip }: GradingPanelProps) {
  const criteria = useMemo(() => task.rubric?.criteria ?? [], [task.rubric]);
  const ai = task.aiSuggestion;
  const aiPicks = useMemo(() => Object.fromEntries((ai?.criteria ?? []).map((c) => [c.name, c.score])), [ai]);

  const [picks, setPicks] = useState<Record<string, number>>(task.review?.criteria ?? {});
  const [plainScore, setPlainScore] = useState<number | null>(task.review && !criteria.length ? task.review.score : null);
  const [feedback, setFeedback] = useState(task.review?.feedback ?? '');
  const [hover, setHover] = useState<{ criterion: string; score: number } | null>(null);
  const [showRationale, setShowRationale] = useState(false);

  const score = criteria.length ? scoreFromRubric(criteria, picks, task.maxScore) : plainScore;
  const missing = criteria.filter((c) => picks[c.name] === undefined).length;
  const ready = score !== null && !submitting;

  const applyAi = () => {
    if (!ai) return;
    if (criteria.length) setPicks(aiPicks);
    else setPlainScore(ai.score);
  };

  const submit = useCallback(() => {
    if (score === null || submitting) return;
    onSubmit({ score, criteria: criteria.length ? picks : undefined, feedback: feedback.trim() });
  }, [score, submitting, onSubmit, criteria.length, picks, feedback]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [submit]);

  const fraction = score === null ? 0 : score / task.maxScore;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
        {/* AI suggestion */}
        {ai && (
          <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Sugerencia de IA
              </span>
              <span className="text-sm font-semibold text-primary tabular-nums">
                {ai.score}/{task.maxScore}
              </span>
            </div>
            <p className={cn('mt-2 text-xs leading-relaxed text-muted-foreground', !showRationale && 'line-clamp-2')}>{ai.rationale}</p>
            <div className="mt-2.5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowRationale((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {showRationale ? 'Ver menos' : 'Ver más'}
                <ChevronDown className={cn('size-3 transition-transform', showRationale && 'rotate-180')} />
              </button>
              <Button type="button" size="xs" variant="outline" onClick={applyAi}>
                Usar sugerencia
              </Button>
            </div>
          </div>
        )}

        {/* Rubric */}
        {criteria.length > 0 ? (
          <div className="space-y-4">
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{task.rubric?.name ?? 'Rúbrica'}</p>
            {criteria.map((c) => {
              const levels = [...c.levels].sort((a, b) => a.score - b.score);
              const picked = picks[c.name];
              const shown = hover?.criterion === c.name ? hover.score : picked;
              const shownLevel = levels.find((l) => l.score === (shown ?? aiPicks[c.name]));
              return (
                <div key={c.name}>
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{c.name}</span>
                    {c.weight ? <span className="text-xs text-muted-foreground tabular-nums">{c.weight}%</span> : null}
                  </div>
                  <div className="flex gap-1.5" role="radiogroup" aria-label={c.name} onMouseLeave={() => setHover(null)}>
                    {levels.map((l) => {
                      const selected = picked === l.score;
                      const suggested = aiPicks[c.name] === l.score && !selected;
                      return (
                        <button
                          key={l.score}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          aria-label={`${c.name}: ${l.score}`}
                          onMouseEnter={() => setHover({ criterion: c.name, score: l.score })}
                          onFocus={() => setHover({ criterion: c.name, score: l.score })}
                          onBlur={() => setHover(null)}
                          onClick={() => setPicks((p) => ({ ...p, [c.name]: l.score }))}
                          className={cn(
                            'relative h-9 flex-1 rounded-lg border text-sm font-medium tabular-nums transition-all duration-150 outline-none',
                            'focus-visible:ring-3 focus-visible:ring-ring/40',
                            selected
                              ? 'q-pop border-primary bg-primary text-primary-foreground shadow-sm'
                              : suggested
                                ? 'border-dashed border-primary/60 bg-card text-primary'
                                : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/50',
                          )}
                        >
                          {l.score}
                          {suggested && <span aria-hidden="true" className="absolute -top-1 -right-1 size-2 rounded-full bg-primary" />}
                        </button>
                      );
                    })}
                  </div>
                  <p className={cn('mt-1.5 min-h-[2.5em] text-xs leading-relaxed', shown === undefined ? 'text-muted-foreground/70 italic' : 'text-muted-foreground')}>
                    {shownLevel?.description ?? c.description ?? ''}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Calificación</p>
            <div className="flex gap-1.5">
              {(task.maxScore <= 5
                ? Array.from({ length: task.maxScore + 1 }, (_, i) => i)
                : [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(task.maxScore * f * 2) / 2)
              ).map((value) => {
                const selected = plainScore === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPlainScore(value)}
                    className={cn(
                      'h-9 flex-1 rounded-lg border text-sm font-medium tabular-nums transition-all duration-150',
                      selected ? 'q-pop border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40',
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
            <input
              type="range"
              min={0}
              max={task.maxScore}
              step={0.5}
              value={plainScore ?? 0}
              onChange={(e) => setPlainScore(Number(e.target.value))}
              className="mt-3 w-full accent-[hsl(var(--primary))]"
              aria-label="Puntaje"
            />
          </div>
        )}

        {/* Feedback */}
        <div>
          <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Comentario para el estudiante</p>
          <Textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            placeholder="Qué hizo bien y qué puede mejorar"
            className="resize-none bg-card text-sm leading-relaxed"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_COMMENTS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setFeedback((f) => (f.includes(c) ? f : `${f.trim()} ${c}`.trim()))}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Score + actions, always visible */}
      <div className="relative shrink-0 border-t border-border bg-card px-4 pt-3 pb-3">
        <div className="absolute inset-x-0 -top-px h-0.5 bg-transparent">
          <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${fraction * 100}%` }} />
        </div>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1">
              <span key={score ?? 'none'} className={cn('q-pop text-2xl font-semibold tracking-tight tabular-nums', score === null ? 'text-muted-foreground/40' : 'text-foreground')}>
                {score === null ? '·' : score}
              </span>
              <span className="text-sm text-muted-foreground tabular-nums">/ {task.maxScore}</span>
            </div>
            {criteria.length > 0 && missing > 0 && (
              <p className="truncate text-[11px] text-muted-foreground">
                {missing === criteria.length ? 'Elige un nivel por criterio' : `Falta${missing > 1 ? 'n' : ''} ${missing} criterio${missing > 1 ? 's' : ''}`}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onSkip} disabled={submitting}>
            Omitir
          </Button>
          <Button type="button" onClick={submit} disabled={!ready}>
            {task.status === 'reviewed' ? 'Actualizar' : 'Guardar'}
            <KbdGroup className="ml-1 hidden opacity-70 xl:inline-flex">
              <Kbd className="bg-primary-foreground/15 text-primary-foreground">Ctrl</Kbd>
              <Kbd className="bg-primary-foreground/15 text-primary-foreground">↵</Kbd>
            </KbdGroup>
          </Button>
        </div>
      </div>
    </div>
  );
}
