import { cn } from '@/lib/utils';

export type StatusFilter = 'all' | 'scheduled' | 'in_progress';

const CHIPS: ReadonlyArray<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'scheduled', label: 'Programadas' },
  { value: 'in_progress', label: 'En progreso' },
];

interface StatusFilterChipsProps {
  value: StatusFilter;
  onChange: (value: StatusFilter) => void;
  counts: Record<StatusFilter, number>;
}

export function StatusFilterChips({ value, onChange, counts }: StatusFilterChipsProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {CHIPS.map((chip) => {
        const active = value === chip.value;
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(chip.value)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              active ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted',
            )}
          >
            {chip.label}
            <span className={cn(
              'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
              active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}>
              {counts[chip.value]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
