import { Button } from '@/components/keel/button';
import { cn } from '@/lib/utils';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

export interface BuilderPiece {
  id: string;
  content: string;
}

interface SentenceBuilderInputProps {
  /** Pieces in the order the bank shows them (already shuffled by the caller). */
  pieces: BuilderPiece[];
  /** pieceId → 1-based slot (the shape the grader reads). */
  positions: Record<string, number>;
  onChange: (positions: Record<string, number>) => void;
}

type Zone = 'tray' | 'bank';

const placedOrder = (pieces: BuilderPiece[], positions: Record<string, number>) =>
  pieces
    .filter((p) => positions[p.id] >= 1)
    .sort((a, b) => positions[a.id] - positions[b.id])
    .map((p) => p.id);

// Prefer the piece under the pointer, then the zone under it, then the closest rect.
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length) {
    const piece = hits.find((h) => h.id !== 'tray' && h.id !== 'bank');
    return piece ? [piece] : hits;
  }
  return rectIntersection(args);
};

const pieceClass =
  'inline-flex h-10 select-none items-center rounded-lg border bg-card px-3 text-[15px] text-foreground shadow-xs touch-none';

function Piece({ piece, zone, onTap }: { piece: BuilderPiece; zone: Zone; onTap: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: piece.id });
  return (
    <button
      ref={setNodeRef}
      type="button"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      onClick={onTap}
      aria-label={zone === 'tray' ? `Quitar ${piece.content}` : `Colocar ${piece.content}`}
      className={cn(
        pieceClass,
        'cursor-grab transition-[border-color,box-shadow,opacity] duration-150 active:cursor-grabbing',
        zone === 'tray' ? 'q-pop border-primary/35 font-medium' : 'q-enter border-border hover:border-primary/50 hover:shadow-sm',
        isDragging && 'border-dashed border-primary/50 opacity-35 shadow-none',
      )}
      {...attributes}
      {...listeners}
    >
      {piece.content}
    </button>
  );
}

function Zone({ id, className, children }: { id: Zone; className: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} data-over={isOver || undefined} className={className}>
      {children}
    </div>
  );
}

/**
 * Build the sentence by dragging pieces from the bank onto the line, and
 * reorder them there by dragging. Tapping works too: a bank piece goes to the
 * end of the line, a placed piece goes back to the bank. Keyboard: Space to
 * lift, arrows to move, Space to drop.
 */
export function SentenceBuilderInput({ pieces, positions, onChange }: SentenceBuilderInputProps) {
  const byId = useMemo(() => new Map(pieces.map((p) => [p.id, p])), [pieces]);
  const [tray, setTray] = useState<string[]>(() => placedOrder(pieces, positions));
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);

  // Follow outside changes (navigation, reset) when not mid-drag.
  useEffect(() => {
    if (activeId !== null) return;
    const next = placedOrder(pieces, positions);
    setTray((prev) => (prev.length === next.length && prev.every((id, i) => id === next[i]) ? prev : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieces, positions]);

  const bank = pieces.filter((p) => !tray.includes(p.id)).map((p) => p.id);
  const zoneOf = (id: UniqueIdentifier): Zone =>
    id === 'tray' || id === 'bank' ? id : tray.includes(String(id)) ? 'tray' : 'bank';

  const commit = (next: string[]) => {
    setTray(next);
    onChange(Object.fromEntries(next.map((id, i) => [id, i + 1])));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(active.id);

  // Move between zones live, so the line opens a gap where the piece will land.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = zoneOf(active.id);
    const to = zoneOf(over.id);
    if (from === to) return;
    const id = String(active.id);
    if (to === 'tray') {
      const at = over.id === 'tray' ? tray.length : tray.indexOf(String(over.id));
      const next = [...tray];
      next.splice(at < 0 ? tray.length : at, 0, id);
      setTray(next);
    } else {
      setTray(tray.filter((t) => t !== id));
    }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    let next = tray;
    if (over && zoneOf(active.id) === 'tray' && zoneOf(over.id) === 'tray' && over.id !== 'tray') {
      const from = tray.indexOf(String(active.id));
      const to = tray.indexOf(String(over.id));
      if (from !== to) next = arrayMove(tray, from, to);
    }
    commit(next);
  };

  const onDragCancel = () => {
    setActiveId(null);
    setTray(placedOrder(pieces, positions));
  };

  const complete = tray.length === pieces.length && pieces.length > 0;
  const active = activeId ? byId.get(String(activeId)) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="flex flex-col gap-4">
        {/* The sentence line */}
        <Zone
          id="tray"
          className={cn(
            'relative flex min-h-[4.25rem] flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-3 transition-colors duration-150',
            complete ? 'border-primary/40' : 'border-border',
            'data-[over]:border-primary data-[over]:bg-primary/5',
          )}
        >
          <SortableContext items={tray} strategy={rectSortingStrategy}>
            {tray.map((id) => {
              const piece = byId.get(id);
              return piece ? (
                <Piece key={id} piece={piece} zone="tray" onTap={() => commit(tray.filter((t) => t !== id))} />
              ) : null;
            })}
          </SortableContext>
          {/* Ghost slots: how many pieces are still missing. */}
          {Array.from({ length: Math.max(0, pieces.length - tray.length) }, (_, i) => (
            <span
              key={`ghost-${i}`}
              aria-hidden="true"
              className="inline-flex h-10 w-14 rounded-lg border border-dashed border-border/80"
            />
          ))}
          {complete && (
            <span className="q-pop absolute -top-2.5 -right-2.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Check className="size-3.5" />
            </span>
          )}
        </Zone>

        {/* The bank */}
        <div className="flex items-start gap-2">
          <Zone
            id="bank"
            className="flex min-h-12 flex-1 flex-wrap items-center gap-2 rounded-xl border border-transparent p-1 transition-colors duration-150 data-[over]:border-dashed data-[over]:border-border"
          >
            <SortableContext items={bank} strategy={rectSortingStrategy}>
              {bank.map((id) => {
                const piece = byId.get(id)!;
                return <Piece key={id} piece={piece} zone="bank" onTap={() => commit([...tray, id])} />;
              })}
            </SortableContext>
          </Zone>
          {tray.length > 0 && (
            <Button type="button" variant="ghost" size="sm" className="mt-2.5 shrink-0" onClick={() => commit([])}>
              <RotateCcw />
              Reiniciar
            </Button>
          )}
        </div>
      </div>

      {/* Portalled: the question card animates with a transform, which would
          otherwise offset the fixed-position overlay away from the pointer. */}
      {createPortal(
        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
          {active ? (
            <span className={cn(pieceClass, 'rotate-[-2deg] scale-105 cursor-grabbing border-primary font-medium shadow-lg ring-3 ring-primary/15')}>
              {active.content}
            </span>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
