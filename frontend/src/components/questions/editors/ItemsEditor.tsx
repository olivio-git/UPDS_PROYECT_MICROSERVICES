import { Button } from '@/components/keel/button';
import { Input } from '@/components/keel/input';
import { cn } from '@/lib/utils';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRight, GripVertical, Plus, WandSparkles, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { uid } from './uid';

export interface EditorItem {
  id: string;
  content: string;
  correctPosition?: number;
  matchingPair?: string;
  mediaUrl?: string;
  mediaType?: 'audio' | 'image' | 'video';
}

interface ItemsEditorProps {
  items: EditorItem[];
  onChange: (items: EditorItem[]) => void;
}

const bareInput =
  'h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-[15px] text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-border focus:border-ring focus:bg-card';

/* ───────────────────────────── Matching ───────────────────────────── */

/**
 * One row per pair, written left to right exactly as it should match. The
 * student gets the right column shuffled.
 */
export function PairsEditor({ items, onChange }: ItemsEditorProps) {
  const leftRefs = useRef<Array<HTMLInputElement | null>>([]);
  const rows = items;

  const update = (index: number, patch: Partial<EditorItem>) =>
    onChange(rows.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  const add = () => {
    onChange([...rows, { id: uid(), content: '', matchingPair: '' }]);
    requestAnimationFrame(() => leftRefs.current[rows.length]?.focus());
  };
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));

  const values = rows.map((r) => (r.matchingPair ?? '').trim().toLowerCase()).filter(Boolean);
  const isDup = (v?: string) => !!v?.trim() && values.filter((x) => x === v.trim().toLowerCase()).length > 1;

  return (
    <div className="flex flex-col gap-2">
      {rows.map((item, index) => (
        <div
          key={item.id}
          className="q-enter group grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border bg-card py-1.5 pr-1.5 pl-3"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
            {index + 1}
          </span>
          <input
            ref={(el) => { leftRefs.current[index] = el; }}
            value={item.content}
            onChange={(e) => update(index, { content: e.target.value })}
            placeholder="Elemento"
            className={bareInput}
          />
          <ArrowRight
            className={cn(
              'size-4 transition-colors',
              item.content.trim() && item.matchingPair?.trim() ? 'text-primary' : 'text-muted-foreground/50',
            )}
          />
          <input
            value={item.matchingPair ?? ''}
            onChange={(e) => update(index, { matchingPair: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (index === rows.length - 1) add();
                else leftRefs.current[index + 1]?.focus();
              }
            }}
            placeholder="Pareja"
            aria-invalid={isDup(item.matchingPair) || undefined}
            className={cn(bareInput, 'aria-invalid:border-destructive/60')}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Quitar pareja"
            className="text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
            onClick={() => remove(index)}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={add}>
        <Plus />
        Pareja
      </Button>
    </div>
  );
}

/* ──────────────────────── Ordering / sentence builder ──────────────────────── */

function SortableRow({
  item,
  index,
  onText,
  onRemove,
  onEnter,
  inputRef,
}: {
  item: EditorItem;
  index: number;
  onText: (text: string) => void;
  onRemove: () => void;
  onEnter: () => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-2 rounded-xl border bg-card py-1.5 pr-1.5 pl-1',
        isDragging ? 'relative z-10 border-primary shadow-lg' : 'border-border',
      )}
    >
      <button
        type="button"
        aria-label="Mover"
        className="flex h-8 w-6 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-semibold text-primary tabular-nums">
        {index + 1}
      </span>
      <input
        ref={inputRef}
        value={item.content}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onEnter();
          }
        }}
        placeholder={`Paso ${index + 1}`}
        className={bareInput}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Quitar"
        className="text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        onClick={onRemove}
      >
        <X />
      </Button>
    </li>
  );
}

/**
 * Write the items in their correct order; drag to rearrange. The position each
 * item ends up in is the answer key, and the student receives them shuffled.
 * With `splitSentence`, a full sentence can be split into word pieces at once.
 */
export function SequenceEditor({
  items: rawItems,
  onChange,
  splitSentence = false,
}: ItemsEditorProps & { splitSentence?: boolean }) {
  // Show the answer key: items sorted by their correct position.
  const items = rawItems
    .map((it, i) => ({ it, key: it.correctPosition ?? i + 1, i }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .map((x) => x.it);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const [sentence, setSentence] = useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const emit = (next: EditorItem[]) => onChange(next.map((it, i) => ({ ...it, correctPosition: i + 1 })));
  const add = (focus = true) => {
    emit([...items, { id: uid(), content: '' }]);
    if (focus) requestAnimationFrame(() => refs.current[items.length]?.focus());
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    emit(arrayMove(items, from, to));
  };
  const split = () => {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;
    emit(words.map((w) => ({ id: uid(), content: w })));
    setSentence('');
  };

  return (
    <div className="flex flex-col gap-2">
      {splitSentence && (
        <div className="flex items-center gap-2">
          <Input
            value={sentence}
            onChange={(e) => setSentence(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                split();
              }
            }}
            placeholder="She has never been to Paris"
            className="h-9"
          />
          <Button type="button" variant="outline" disabled={!sentence.trim()} onClick={split} className="h-9">
            <WandSparkles />
            Separar
          </Button>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-1.5">
            {items.map((item, index) => (
              <SortableRow
                key={item.id}
                item={item}
                index={index}
                inputRef={(el) => { refs.current[index] = el; }}
                onText={(text) => emit(items.map((it, i) => (i === index ? { ...it, content: text } : it)))}
                onRemove={() => emit(items.filter((_, i) => i !== index))}
                onEnter={() => (index === items.length - 1 ? add() : refs.current[index + 1]?.focus())}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      <Button type="button" variant="ghost" size="sm" className="self-start" onClick={() => add()}>
        <Plus />
        {splitSentence ? 'Pieza' : 'Paso'}
      </Button>
    </div>
  );
}
