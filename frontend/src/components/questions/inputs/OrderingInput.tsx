import { Button } from '@/components/keel/button';
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
import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';

export interface OrderableItem {
  id: string;
  content: string;
  media?: ReactNode;
}

interface OrderingInputProps {
  items: OrderableItem[];
  /** Item ids in the order the student currently has them. */
  order: string[];
  onChange: (order: string[]) => void;
}

function Row({
  item,
  index,
  total,
  onMove,
}: {
  item: OrderableItem;
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'flex items-center gap-2 rounded-xl border bg-card py-2 pr-2 pl-1.5 select-none',
        isDragging ? 'relative z-10 border-primary shadow-lg ring-3 ring-primary/15' : 'border-border',
      )}
    >
      <button
        type="button"
        aria-label={`Arrastrar ${item.content}`}
        className="flex h-9 w-7 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground tabular-nums">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1 text-[15px] text-foreground">
        {item.content}
        {item.media}
      </div>
      <div className="flex shrink-0 flex-col">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Subir"
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
        >
          <ChevronUp />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label="Bajar"
          disabled={index === total - 1}
          onClick={() => onMove(index, index + 1)}
        >
          <ChevronDown />
        </Button>
      </div>
    </li>
  );
}

/**
 * A list the student puts in order: drag a row by its handle, or nudge it with
 * the arrows (keyboard and touch friendly). Rows slide into place.
 */
export function OrderingInput({ items, order, onChange }: OrderingInputProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const byId = new Map(items.map((i) => [i.id, i]));
  const rows = order.map((id) => byId.get(id)).filter((i): i is OrderableItem => Boolean(i));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return;
    onChange(arrayMove(order, from, to));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(order.indexOf(String(active.id)), order.indexOf(String(over.id)));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ol className="flex flex-col gap-2">
          {rows.map((item, index) => (
            <Row key={item.id} item={item} index={index} total={rows.length} onMove={move} />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}
