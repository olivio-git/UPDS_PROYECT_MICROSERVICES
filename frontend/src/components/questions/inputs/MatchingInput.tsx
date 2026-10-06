import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

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

interface Point {
  x: number;
  y: number;
}

/** S-curve between two anchors, like a diagram connector. */
const curve = (a: Point, b: Point) => {
  const dx = Math.max(24, (b.x - a.x) / 2);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
};

/**
 * Connect each row on the left with its match on the right. On wide screens
 * every pair is drawn as a curved wire between anchor dots; drag from a dot to
 * an option, or click a row and then an option (either order). On narrow
 * screens, where the columns stack, the pick shows as a chip in the row.
 */
export function MatchingInput({ items, options, pairs, onChange }: MatchingInputProps) {
  const firstOpen = useMemo(() => items.find((i) => !pairs[i.id])?.id ?? null, [items, pairs]);
  const [activeRow, setActiveRow] = useState<string | null>(firstOpen);
  const [activeOption, setActiveOption] = useState<string | null>(null);
  const [hoverOption, setHoverOption] = useState<string | null>(null);
  const [hoverRow, setHoverRow] = useState<string | null>(null);

  const boardRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const optionRefs = useRef(new Map<string, HTMLElement>());
  const [anchors, setAnchors] = useState<{ rows: Record<string, Point>; options: Record<string, Point> }>({ rows: {}, options: {} });
  const [drag, setDrag] = useState<{ rowId: string; at: Point } | null>(null);

  useEffect(() => {
    setActiveRow((row) => (row && items.some((i) => i.id === row) ? row : firstOpen));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // ── Measure anchor points relative to the board ──
  const measure = useCallback(() => {
    const board = boardRef.current;
    if (!board) return;
    const origin = board.getBoundingClientRect();
    const rows: Record<string, Point> = {};
    const opts: Record<string, Point> = {};
    rowRefs.current.forEach((el, id) => {
      const r = el.getBoundingClientRect();
      rows[id] = { x: r.right - origin.left, y: r.top + r.height / 2 - origin.top };
    });
    optionRefs.current.forEach((el, value) => {
      const r = el.getBoundingClientRect();
      opts[value] = { x: r.left - origin.left, y: r.top + r.height / 2 - origin.top };
    });
    setAnchors({ rows, options: opts });
  }, []);

  useLayoutEffect(measure, [measure, items, options, pairs]);
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;
    const ro = new ResizeObserver(measure);
    ro.observe(board);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

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
    if (activeRow) {
      // Clicking the option a row already has disconnects it.
      if (pairs[activeRow] === value) return unpair(activeRow);
      return pair(activeRow, value);
    }
    setActiveOption((opt) => (opt === value ? null : value));
  };

  // ── Drag a wire out of a row's anchor dot ──
  const boardPoint = (e: { clientX: number; clientY: number }): Point => {
    const r = boardRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const startDrag = (rowId: string, e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setActiveRow(rowId);
    setDrag({ rowId, at: boardPoint(e) });
  };
  const moveDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, at: boardPoint(e) });
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-match-option]');
    setHoverOption(target?.dataset.matchOption ?? null);
  };
  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-match-option]');
    if (target?.dataset.matchOption) pair(drag.rowId, target.dataset.matchOption);
    setDrag(null);
    setHoverOption(null);
  };

  const done = Object.keys(pairs).filter((k) => items.some((i) => i.id === k)).length;

  // Wire previewed while a row is waiting for its match and an option is hovered.
  const previewFrom = drag?.rowId ?? activeRow;
  const previewTo: Point | null = drag
    ? hoverOption
      ? anchors.options[hoverOption]
      : drag.at
    : activeRow && hoverOption
      ? anchors.options[hoverOption]
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div
        ref={boardRef}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={() => setDrag(null)}
        className={cn('relative grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-x-24', drag && 'cursor-grabbing select-none')}
      >
        {/* Wires (wide screens only) */}
        <svg className="pointer-events-none absolute inset-0 hidden size-full overflow-visible md:block" aria-hidden="true">
          {items.map((item) => {
            const value = pairs[item.id];
            const a = anchors.rows[item.id];
            const b = value ? anchors.options[value] : undefined;
            if (!a || !b) return null;
            const emphasized = hoverRow === item.id || hoverOption === value || activeRow === item.id;
            return (
              <g key={`${item.id}-${value}`} className="text-primary">
                <path
                  d={curve(a, b)}
                  pathLength={1}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={emphasized ? 2.5 : 1.75}
                  strokeLinecap="round"
                  className="q-wire transition-[stroke-width,opacity] duration-150"
                  opacity={emphasized ? 1 : 0.7}
                />
                <circle cx={b.x} cy={b.y} r={4} fill="currentColor" className="q-pop" />
              </g>
            );
          })}
          {previewFrom && previewTo && anchors.rows[previewFrom] && (
            <path
              d={curve(anchors.rows[previewFrom], previewTo)}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeDasharray="5 5"
              strokeLinecap="round"
              className="text-primary/60"
            />
          )}
        </svg>

        <ol className="flex flex-col gap-2">
          {items.map((item, index) => {
            const chosen = pairs[item.id];
            const isActive = activeRow === item.id;
            return (
              <li key={item.id}>
                <div
                  ref={(el) => {
                    if (el) rowRefs.current.set(item.id, el);
                    else rowRefs.current.delete(item.id);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  onClick={() => clickRow(item.id)}
                  onMouseEnter={() => setHoverRow(item.id)}
                  onMouseLeave={() => setHoverRow(null)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      clickRow(item.id);
                    }
                  }}
                  className={cn(
                    'group relative flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border bg-card px-3 py-2 transition-all duration-150 outline-none',
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

                  {/* Narrow screens: the pick as a chip. */}
                  {chosen && (
                    <span className="q-pop inline-flex max-w-[50%] items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 py-1 pr-1 pl-2.5 text-sm font-medium text-foreground md:hidden">
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
                  )}

                  {/* Wide screens: disconnect button on hover. */}
                  {chosen && (
                    <button
                      type="button"
                      aria-label={`Desconectar ${item.content}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        unpair(item.id);
                      }}
                      className="hidden rounded-md p-1 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 hover:bg-muted hover:text-foreground md:block"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}

                  {/* Anchor dot: drag from here to an option. */}
                  <span
                    onPointerDown={(e) => startDrag(item.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    aria-hidden="true"
                    className="absolute top-1/2 -right-[7px] hidden size-3.5 -translate-y-1/2 cursor-grab touch-none items-center justify-center md:flex"
                  >
                    <span
                      className={cn(
                        'size-3 rounded-full border-2 transition-all duration-150',
                        chosen || isActive
                          ? 'border-primary bg-primary'
                          : 'border-muted-foreground/40 bg-card group-hover:scale-125 group-hover:border-primary',
                      )}
                    />
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col gap-2">
          {options.map((value) => {
            const owner = ownerOf(value);
            const isActive = activeOption === value;
            const isTarget = (drag || activeRow) && hoverOption === value;
            return (
              <button
                key={value}
                ref={(el) => {
                  if (el) optionRefs.current.set(value, el);
                  else optionRefs.current.delete(value);
                }}
                type="button"
                data-match-option={value}
                onClick={() => clickOption(value)}
                onMouseEnter={() => setHoverOption(value)}
                onMouseLeave={() => setHoverOption(null)}
                className={cn(
                  'relative flex min-h-11 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[15px] transition-all duration-150 outline-none',
                  'focus-visible:ring-3 focus-visible:ring-ring/40',
                  isTarget
                    ? 'border-primary bg-primary/5 text-foreground'
                    : owner
                      ? 'border-primary/30 bg-card text-foreground'
                      : isActive
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted/40',
                )}
              >
                <span className="min-w-0 flex-1">{value}</span>
                {owner && (
                  <span className="q-pop flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary md:hidden">
                    {rowNumber(owner)}
                  </span>
                )}
                {/* Anchor dot on the left edge (wide screens). */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-1/2 -left-[7px] hidden size-3 -translate-y-1/2 rounded-full border-2 transition-colors duration-150 md:block',
                    owner || isTarget ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-card',
                  )}
                />
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
