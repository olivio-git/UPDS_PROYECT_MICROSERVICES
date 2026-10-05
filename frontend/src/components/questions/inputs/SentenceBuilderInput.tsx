import { Button } from '@/components/keel/button';
import { cn } from '@/lib/utils';
import { RotateCcw } from 'lucide-react';

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

/**
 * Build the answer piece by piece: tap a piece in the bank to drop it into the
 * next empty slot, tap a placed piece to send it back. Slots are numbered, so
 * it works for words in a sentence and for steps in a process alike.
 */
export function SentenceBuilderInput({ pieces, positions, onChange }: SentenceBuilderInputProps) {
  const slotCount = pieces.length;
  const slots: Array<BuilderPiece | null> = Array.from({ length: slotCount }, () => null);
  for (const piece of pieces) {
    const pos = positions[piece.id];
    if (pos && pos >= 1 && pos <= slotCount && !slots[pos - 1]) slots[pos - 1] = piece;
  }
  const placedIds = new Set(slots.filter(Boolean).map((p) => p!.id));
  const bank = pieces.filter((p) => !placedIds.has(p.id));

  const place = (piece: BuilderPiece) => {
    const free = slots.findIndex((s) => s === null);
    if (free === -1) return;
    onChange({ ...positions, [piece.id]: free + 1 });
  };

  const remove = (piece: BuilderPiece) => {
    const next = { ...positions };
    delete next[piece.id];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-16 flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 p-3">
        {slots.map((piece, index) =>
          piece ? (
            <button
              key={`slot-${index}`}
              type="button"
              onClick={() => remove(piece)}
              aria-label={`Quitar ${piece.content} del lugar ${index + 1}`}
              className="q-pop inline-flex h-10 items-center rounded-lg border border-primary/30 bg-card px-3 text-[15px] font-medium text-foreground shadow-xs transition-colors hover:border-destructive/40 hover:text-destructive"
            >
              {piece.content}
            </button>
          ) : (
            <span
              key={`slot-${index}`}
              aria-label={`Lugar ${index + 1} vacío`}
              className="inline-flex h-10 min-w-16 items-center justify-center rounded-lg border border-dashed border-border px-3 text-xs text-muted-foreground tabular-nums"
            >
              {index + 1}
            </span>
          ),
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {bank.map((piece) => (
          <button
            key={piece.id}
            type="button"
            onClick={() => place(piece)}
            className={cn(
              'q-enter inline-flex h-10 items-center rounded-lg border border-border bg-card px-3 text-[15px] text-foreground shadow-xs transition-all duration-150',
              'hover:-translate-y-px hover:border-primary/50 hover:shadow-sm active:translate-y-0',
            )}
          >
            {piece.content}
          </button>
        ))}
        {placedIds.size > 0 && (
          <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => onChange({})}>
            <RotateCcw />
            Reiniciar
          </Button>
        )}
      </div>
    </div>
  );
}
