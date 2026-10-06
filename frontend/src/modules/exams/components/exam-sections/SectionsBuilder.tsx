import { Button } from '@/components/keel/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/keel/dropdown-menu';
import { Textarea } from '@/components/keel/textarea';
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
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, GripVertical, LayoutTemplate, Plus, RotateCcw, Scale, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { COMPETENCIES, COMPETENCY_LABELS, COMPETENCY_SHORT, type Competency } from '../../constants/academic.constants';
import { distributeEvenly, formatWeight, isWeightSumValid, sumWeights } from '../../utils/weights';
import {
  COMPETENCY_ICON,
  DEFAULT_INSTRUCTIONS,
  TEMPLATES,
  isCompetency,
  mcerWeights,
  newSection,
  sectionsFromTemplate,
  type SectionDraft,
} from './sectionDefaults';
import WeightInput from '../shared/WeightInput';

interface Availability {
  [key: string]: { maxAllowed: number; available: number } | undefined;
}

interface SectionsBuilderProps {
  sections: SectionDraft[];
  onChange: (sections: SectionDraft[]) => void;
  level: string;
  availability: Availability;
  /** Per-section problems (e.g. not enough questions), keyed by section id. */
  errors?: Record<string, string | undefined>;
  onApplyTemplate?: (previous: SectionDraft[]) => void;
}

/* ───────────────────────── Weight bar ───────────────────────── */

const SEGMENT_TONES = ['bg-primary', 'bg-primary/80', 'bg-primary/60', 'bg-primary/45', 'bg-primary/35', 'bg-primary/25'];

function WeightBar({ sections }: { sections: SectionDraft[] }) {
  const total = sumWeights(sections.map((s) => s.weight));
  const valid = isWeightSumValid(total);
  const scale = Math.max(100, total);
  return (
    <div>
      <div
        className={cn('flex h-9 w-full overflow-hidden rounded-lg border', valid ? 'border-border' : 'border-amber-500/60')}
        role="img"
        aria-label={`Reparto del puntaje: ${sections.map((s) => `${s.name} ${formatWeight(s.weight || 0)}%`).join(', ')}`}
      >
        {sections.map((s, i) => {
          const w = Number.isFinite(s.weight) ? Math.max(0, s.weight) : 0;
          if (w <= 0) return null;
          const dark = i < 3;
          return (
            <div
              key={s.id}
              title={`${s.name}: ${formatWeight(w)}%`}
              className={cn(
                'flex min-w-0 items-center justify-center border-r border-background/70 px-1.5 text-[11px] font-medium transition-[width] duration-300 last:border-r-0',
                SEGMENT_TONES[i % SEGMENT_TONES.length],
                dark ? 'text-primary-foreground' : 'text-foreground',
              )}
              style={{ width: `${(w / scale) * 100}%` }}
            >
              <span className="truncate">
                {isCompetency(s.competency) ? COMPETENCY_SHORT[s.competency] : s.name} {formatWeight(w)}%
              </span>
            </div>
          );
        })}
        {total < 100 && (
          <div
            className="flex items-center justify-center bg-[repeating-linear-gradient(135deg,transparent_0_6px,hsl(var(--muted))_6px_12px)] text-[11px] text-muted-foreground"
            style={{ width: `${((100 - total) / scale) * 100}%` }}
          >
            {total > 0 && <span className="truncate px-1">Falta {formatWeight(100 - total)}%</span>}
          </div>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Reparto del puntaje final</span>
        <span className={cn('font-medium tabular-nums', valid ? 'text-foreground' : 'text-amber-700 dark:text-amber-400')}>
          {formatWeight(total)}% {valid ? '' : total > 100 ? `· sobra ${formatWeight(total - 100)}%` : `· falta ${formatWeight(100 - total)}%`}
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────── Section row ───────────────────────── */

const numberInput =
  'h-8 w-full rounded-md border border-input bg-transparent px-2 text-right text-sm tabular-nums outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30 dark:bg-input/30';

function SectionRow({
  section,
  index,
  level,
  availability,
  error,
  onPatch,
  onRemove,
  canRemove,
}: {
  section: SectionDraft;
  index: number;
  level: string;
  availability: Availability;
  error?: string;
  onPatch: (patch: Partial<SectionDraft>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const competency = isCompetency(section.competency) ? section.competency : 'reading';
  const Icon = COMPETENCY_ICON[competency];
  const avail = availability[`${section.competency}-${level}`];
  const short = avail && section.questionCount > avail.maxAllowed;

  const changeCompetency = (next: Competency) => {
    const autoName = !section.name.trim() || section.name === COMPETENCY_LABELS[competency] || /^Sección \d+$/.test(section.name);
    const autoInstructions = !section.instructions.trim() || section.instructions === DEFAULT_INSTRUCTIONS[competency];
    onPatch({
      competency: next,
      ...(autoName ? { name: COMPETENCY_LABELS[next] } : {}),
      ...(autoInstructions ? { instructions: DEFAULT_INSTRUCTIONS[next] } : {}),
    });
  };

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('rounded-xl border bg-card transition-shadow', isDragging ? 'relative z-10 border-primary shadow-lg' : error || short ? 'border-amber-500/50' : 'border-border')}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 p-2 md:grid-cols-[auto_minmax(12rem,15rem)_minmax(0,1fr)_5.5rem_5rem_5.5rem_auto]">
        <button
          type="button"
          aria-label={`Mover sección ${index + 1}`}
          className="flex h-8 w-6 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>

        {/* Competency */}
        <label className="relative flex h-8 items-center gap-2 rounded-md border border-input px-2 text-sm focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 dark:bg-input/30">
          <Icon className="size-4 shrink-0 text-primary" />
          <select
            aria-label="Competencia"
            value={competency}
            onChange={(e) => changeCompetency(e.target.value as Competency)}
            className="min-w-0 flex-1 appearance-none bg-transparent pr-4 outline-none"
          >
            {COMPETENCIES.map((c) => (
              <option key={c} value={c}>
                {COMPETENCY_LABELS[c]}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" />
        </label>

        {/* Name — on narrow screens this goes to its own row */}
        <input
          aria-label="Nombre de la sección"
          value={section.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Nombre de la sección"
          className="col-span-3 order-last h-8 min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm font-medium text-foreground outline-none transition-colors hover:border-border focus:border-ring md:order-none md:col-span-1"
        />

        <div className="hidden md:block">
          <input
            aria-label="Preguntas"
            type="number"
            min={1}
            value={section.questionCount || ''}
            onChange={(e) => onPatch({ questionCount: Math.max(0, parseInt(e.target.value) || 0) })}
            className={cn(numberInput, short && 'border-amber-500/60')}
          />
        </div>
        <div className="hidden md:block">
          <input
            aria-label="Minutos"
            type="number"
            min={1}
            value={section.duration ?? ''}
            onChange={(e) => onPatch({ duration: Math.max(0, parseInt(e.target.value) || 0) })}
            className={numberInput}
          />
        </div>
        <div className="hidden md:block">
          <WeightInput
            aria-label="Peso (%)"
            min="0"
            max="100"
            value={section.weight}
            onValueChange={(w) => onPatch({ weight: w })}
            className="h-8 text-right tabular-nums"
          />
        </div>

        <div className="flex items-center">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={open ? 'Ocultar detalles' : 'Ver detalles'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDown className={cn('transition-transform duration-200', open && 'rotate-180')} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Quitar ${section.name}`}
            disabled={!canRemove}
            onClick={onRemove}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 />
          </Button>
        </div>
      </div>

      {/* Availability line */}
      {(avail || error) && (
        <p className={cn('px-10 pb-2 -mt-1 text-xs', short || error ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
          {error || (short ? `Solo hay ${avail!.maxAllowed} preguntas de ${COMPETENCY_SHORT[competency].toLowerCase()} en ${level}` : `${avail!.available} preguntas disponibles en ${level}`)}
        </p>
      )}

      {open && (
        <div className="q-enter space-y-3 border-t border-border px-4 py-3 md:pl-10">
          {/* Numbers for narrow screens */}
          <div className="grid grid-cols-3 gap-2 md:hidden">
            <label className="space-y-1 text-xs text-muted-foreground">
              Preguntas
              <input type="number" min={1} value={section.questionCount || ''} onChange={(e) => onPatch({ questionCount: Math.max(0, parseInt(e.target.value) || 0) })} className={numberInput} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Minutos
              <input type="number" min={1} value={section.duration ?? ''} onChange={(e) => onPatch({ duration: Math.max(0, parseInt(e.target.value) || 0) })} className={numberInput} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Peso (%)
              <WeightInput min="0" max="100" value={section.weight} onValueChange={(w) => onPatch({ weight: w })} className="h-8 text-right" />
            </label>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Instrucciones para el estudiante</span>
              {section.instructions !== DEFAULT_INSTRUCTIONS[competency] && (
                <button
                  type="button"
                  onClick={() => onPatch({ instructions: DEFAULT_INSTRUCTIONS[competency] })}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RotateCcw className="size-3" />
                  Predeterminadas
                </button>
              )}
            </div>
            <Textarea
              rows={2}
              value={section.instructions}
              onChange={(e) => onPatch({ instructions: e.target.value })}
              className="resize-y text-sm"
            />
          </div>
        </div>
      )}
    </li>
  );
}

/* ───────────────────────── Builder ───────────────────────── */

/**
 * Exam sections as a compact, reorderable list: one row per section with its
 * competency, size, time and weight, a bar that shows how the final score is
 * split, MCER templates and one-click "add a competency".
 */
export function SectionsBuilder({ sections, onChange, level, availability, errors = {}, onApplyTemplate }: SectionsBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const emit = (next: SectionDraft[]) => onChange(next.map((s, i) => ({ ...s, order: i + 1 })));
  const patch = (id: string, p: Partial<SectionDraft>) => emit(sections.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const add = (c: Competency) => {
    const total = sumWeights(sections.map((s) => s.weight));
    emit([...sections, newSection(c, sections.length + 1, Math.max(0, formatWeight(100 - total)))]);
  };
  const applyWeights = (weights: number[]) => emit(sections.map((s, i) => ({ ...s, weight: weights[i] ?? 0 })));

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = sections.findIndex((s) => s.id === active.id);
    const to = sections.findIndex((s) => s.id === over.id);
    emit(arrayMove(sections, from, to));
  };

  const totalQuestions = sections.reduce((a, s) => a + (s.questionCount || 0), 0);
  const totalMinutes = sections.reduce((a, s) => a + (s.duration || 0), 0);

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" />}>
            <LayoutTemplate />
            Plantillas
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {TEMPLATES.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => {
                  onApplyTemplate?.(sections);
                  emit(sectionsFromTemplate(t.id));
                }}
                className="flex-col items-start gap-0.5"
              >
                <span className="text-sm font-medium">{t.label}</span>
                <span className="text-xs text-muted-foreground">{t.detail}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />

        <div className="flex flex-wrap items-center gap-1.5">
          {COMPETENCIES.map((c) => {
            const Icon = COMPETENCY_ICON[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => add(c)}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <Plus className="size-3 text-muted-foreground" />
                <Icon className="size-3.5 text-primary" />
                {COMPETENCY_SHORT[c]}
              </button>
            );
          })}
        </div>
      </div>

      <WeightBar sections={sections} />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => applyWeights(mcerWeights(sections))} disabled={!sections.length}>
          <Scale />
          Pesos MCER
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => applyWeights(distributeEvenly(sections.length))} disabled={!sections.length}>
          Partes iguales
        </Button>
      </div>

      {/* Column headers (wide screens) */}
      {sections.length > 0 && (
        <div className="-mb-2 hidden grid-cols-[auto_minmax(12rem,15rem)_minmax(0,1fr)_5.5rem_5rem_5.5rem_auto] gap-2 px-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid">
          <span className="w-6" />
          <span>Competencia</span>
          <span className="px-2">Nombre</span>
          <span className="text-right">Preguntas</span>
          <span className="text-right">Minutos</span>
          <span className="text-right">Peso %</span>
          <span className="w-[3.75rem]" />
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-2">
            {sections.map((s, i) => (
              <SectionRow
                key={s.id}
                section={s}
                index={i}
                level={level}
                availability={availability}
                error={errors[s.id]}
                onPatch={(p) => patch(s.id, p)}
                onRemove={() => emit(sections.filter((x) => x.id !== s.id))}
                canRemove={sections.length > 1}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>

      {sections.length === 0 && (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Elige una plantilla o agrega una competencia.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border pt-3 text-sm text-muted-foreground">
        <span>
          <span className="font-semibold text-foreground tabular-nums">{sections.length}</span> secciones
        </span>
        <span>
          <span className="font-semibold text-foreground tabular-nums">{totalQuestions}</span> preguntas
        </span>
        <span>
          <span className="font-semibold text-foreground tabular-nums">{totalMinutes}</span> minutos
        </span>
      </div>
    </div>
  );
}
