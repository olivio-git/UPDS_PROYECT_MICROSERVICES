import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

export interface MatchingLeftItem {
  id: string;
  content: string;
  media?: ReactNode;
}

interface MatchingInputProps {
  items: MatchingLeftItem[];
  /** Right-hand values, already shuffled by the caller. */
  options: string[];
  /** leftItemId → chosen right value (the shape the grader reads). */
  pairs: Record<string, string>;
  onChange: (pairs: Record<string, string>) => void;
}

/**
 * Pick a row on the left, then its match on the right (or the other way
 * round). Each row shows its pick in a slot beside it, and the option on the
 * right carries the row's number, so a pair reads at a glance without the old
 * rainbow of colours. After a pair is made, focus moves to the next empty row.
 */
export function MatchingInput({ items, options, pairs, onChange }: MatchingInputProps) {
  const firstOpen = useMemo(() => items.find((i) => !pairs[i.id])?.id ?? null, [items, pairs]);
  const [activeRow, setActiveRow] = useState<string | null>(firstOpen);
  const [activeOption, setActiveOption] = useState<string | null>(null);

  // Keep a sensible active row when the question changes.
  useEffect(() => {
    setActiveRow((row) => (row && items.some((i) => i.id === row) ? row : firstOpen));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const rowNumber = (rowId: string) => items.findIndex((i) => i.id === rowId) + 1;
  const ownerOf = (value: string) => Object.keys(pairs).find((k) => pairs[k] === value);

  const pair = (rowId: string, value: string) => {
    const next = { ...pairs };
    // An option belongs to one row at a time: move it if it was used.
    const previousOwner = ownerOf(value);
    if (previousOwner) delete next[previousOwner];
    next[rowId] = value;
    onChange(next);
    setActiveOption(null);
    const nextOpen = items.find((i) => i.id !== rowId && !next[i.id]);
    setActiveRow(nextOpen?.id ?? null);
  };

  const unpair = (rowId: string) => {
    const next = { ...pairs };
    delete next[rowId];
    onChange(next);
    setActiveRow(rowId);
  };

  const clickRow = (rowId: string) => {
    if (activeOption) return pair(rowId, activeOption);
    setActiveRow(rowId);
  };

  const clickOption = (value: string) => {
    if (activeRow) return pair(activeRow, value);
    setActiveOption((opt) => (opt === value ? null : value));
  };

  const done = Object.keys(pairs).filter((k) => items.some((i) => i.id === k)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ol className="flex flex-col gap-2">
          {items.map((item, index) => {
            const chosen = pairs[item.id];
            const isActive = activeRow === item.id;
            return (
              <li key={item.id}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  onClick={() => clickRow(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      clickRow(item.id);
                    }
                  }}
                  className={cn(
                    'flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3 py-2 transition-all duration-150 outline-none',
                    'focus-visible:ring-3 focus-visible:ring-ring/40',
                    isActive ? 'border-primary ring-3 ring-primary/15' : 'border-border hover:border-primary/40',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                      chosen ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] text-foreground">{item.content}</p>
                    {item.media}
                  </div>
                  {chosen ? (
                    <span className="q-pop inline-flex max-w-[50%] items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 py-1 pr-1 pl-2.5 text-sm font-medium text-foreground">
                      <span className="truncate">{chosen}</span>
                      <button
                        type="button"
                        aria-label={`Quitar pareja de ${item.content}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          unpair(item.id);
                        }}
                        className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ) : (
                    <span
                      className={cn(
                        'shrink-0 rounded-lg border border-dashed px-3 py-1 text-xs transition-colors',
                        isActive ? 'border-primary/60 text-primary' : 'border-border text-muted-foreground',
                      )}
                    >
                      Elegir
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col gap-2">
          {options.map((value) => {
            const owner = ownerOf(value);
            const isActive = activeOption === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => clickOption(value)}
                className={cn(
                  'flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[15px] transition-all duration-150 outline-none',
                  'focus-visible:ring-3 focus-visible:ring-ring/40',
                  owner
                    ? 'border-border bg-muted/40 text-muted-foreground'
                    : isActive
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/40',
                )}
              >
                <span className="min-w-0 flex-1">{value}</span>
                {owner && (
                  <span className="q-pop flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                    {rowNumber(owner)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {done}/{items.length}
        </span>
      </div>
    </div>
  );
}
