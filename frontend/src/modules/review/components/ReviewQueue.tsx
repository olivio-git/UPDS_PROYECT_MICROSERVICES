import { cn } from '@/lib/utils';
import type { ReviewQueueItem } from '@/services/reviewService';
import { Check, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { COMPETENCY_SHORT, initials, itemKey, timeAgo } from '../reviewFormat';

type GroupBy = 'session' | 'question';

interface ReviewQueueProps {
  items: ReviewQueueItem[];
  activeKey: string | null;
  onSelect: (item: ReviewQueueItem) => void;
  /** Name to show (a pseudonym when marking blind). */
  displayName: (item: ReviewQueueItem) => string;
  anonymous: boolean;
}

/** Answers waiting for a teacher, grouped by exam session. */
export function ReviewQueue({ items, activeKey, onSelect, displayName, anonymous }: ReviewQueueProps) {
  const [query, setQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('session');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? items.filter((i) => displayName(i).toLowerCase().includes(q) || i.examTitle.toLowerCase().includes(q)) : items;
    const map = new Map<string, ReviewQueueItem[]>();
    for (const item of filtered) {
      // By question = Gradescope's "grade one question across everyone".
      const key = groupBy === 'question' ? `${item.examTitle} · Pregunta ${item.questionNumber}` : `${item.examTitle} · ${item.sessionName}`;
      map.set(key, [...(map.get(key) ?? []), item]);
    }
    return [...map.entries()];
  }, [items, query, groupBy, displayName]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-border p-3">
        <label className="flex h-8 items-center gap-2 rounded-lg border border-input bg-background px-2.5 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar estudiante o examen"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>
        <div className="mt-2 flex items-center gap-1 text-[11px]" role="radiogroup" aria-label="Agrupar">
          <span className="mr-1 text-muted-foreground">Agrupar</span>
          {(['session', 'question'] as const).map((g) => (
            <button
              key={g}
              type="button"
              role="radio"
              aria-checked={groupBy === g}
              onClick={() => setGroupBy(g)}
              className={cn(
                'rounded-md px-2 py-0.5 font-medium transition-colors',
                groupBy === g ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {g === 'session' ? 'Sesión' : 'Pregunta'}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {groups.map(([group, groupItems]) => (
          <section key={group}>
            <h3 className="sticky top-0 z-10 border-b border-border/60 bg-card/95 px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase backdrop-blur">
              {group}
            </h3>
            <ul className="flex flex-col p-1.5">
              {groupItems.map((item) => {
                const active = itemKey(item) === activeKey;
                const done = item.status === 'reviewed';
                return (
                  <li key={itemKey(item)}>
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      aria-current={active || undefined}
                      className={cn(
                        'group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors duration-150',
                        active ? 'bg-primary/8' : 'hover:bg-muted/60',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-primary transition-opacity',
                          active ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <span
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
                          done ? 'bg-primary text-primary-foreground' : active ? 'bg-primary/15 text-foreground' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {done ? <Check className="size-3.5" /> : anonymous ? '#' : initials(item.studentName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className={cn('truncate text-sm', active ? 'font-semibold text-foreground' : 'font-medium text-foreground')}>
                            {displayName(item)}
                          </span>
                          {item.mode === 'assisted' && !done && (
                            <Sparkles className="size-3 shrink-0 text-primary/70" aria-label="Con sugerencia de IA" />
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {COMPETENCY_SHORT[item.competency] ?? item.competency} · {item.level} · Pregunta {item.questionNumber}
                        </span>
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {done && item.score !== undefined ? `${item.score}/${item.maxScore}` : timeAgo(item.submittedAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {groups.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">Sin resultados</p>}
      </div>
    </div>
  );
}
