import { Button } from '@/components/atoms/button';
import { Calendar } from '@/components/atoms/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import type { ReportFiltersState } from '../../hooks/useReportFilters';
import type { SessionOption } from '../../hooks/useReportQueries';
import { COMPETENCY_LABELS, MCER_LEVELS } from './constants';
import { SegmentedControl } from './SegmentedControl';

const ALL = '__all__';
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);
const SEMESTRES = [
  { value: 'H1' as const, label: '1er Sem', hint: 'Enero – Junio' },
  { value: 'H2' as const, label: '2do Sem', hint: 'Julio – Diciembre' },
];

const Divider = () => <div className="w-px h-5 bg-border shrink-0" />;

interface ChipGroupProps {
  items: ReadonlyArray<{ value: string; label: string }>;
  selected: string[] | undefined;
  onToggle: (value: string) => void;
  activeClassName: string;
}

function ChipGroup({ items, selected, onToggle, activeClassName }: ChipGroupProps) {
  return (
    <div className="flex gap-1 flex-wrap">
      {items.map(({ value, label }) => {
        const active = selected?.includes(value) ?? false;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(value)}
            className={cn(
              'px-2 py-0.5 rounded text-[10px] font-medium border transition-colors',
              active ? activeClassName : 'bg-muted border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

const LEVEL_ITEMS = MCER_LEVELS.map((level) => ({ value: level, label: level }));
const COMPETENCY_ITEMS = Object.entries(COMPETENCY_LABELS).map(([value, label]) => ({ value, label }));

function DateRangeLabel({ from, to }: { from?: Date; to?: Date }) {
  if (!from) return <>Rango libre</>;
  if (!to) return <>{format(from, 'd MMM yyyy', { locale: es })}</>;
  return <>{format(from, 'd MMM', { locale: es })} — {format(to, 'd MMM yyyy', { locale: es })}</>;
}

interface ReportFiltersBarProps {
  filters: ReportFiltersState;
  sessions: SessionOption[];
  /** Which dimension chips to show next to the date filters. */
  variant: 'levels' | 'competencies';
}

export function ReportFiltersBar({ filters, sessions, variant }: ReportFiltersBarProps) {
  const { draft, dateRange } = filters;

  return (
    <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
      <Select
        value={draft.gestion ? String(draft.gestion) : ALL}
        onValueChange={(v) => filters.setGestion(v === ALL ? undefined : Number(v))}
      >
        <SelectTrigger className="h-7 w-[90px] text-xs border-border bg-muted/60">
          <SelectValue placeholder="Gestión" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Gestión</SelectItem>
          {YEAR_OPTIONS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>

      <SegmentedControl
        value={draft.semestre}
        onChange={filters.toggleSemestre}
        options={SEMESTRES}
      />

      {sessions.length > 0 && (
        <Select
          value={draft.sessionId ?? ALL}
          onValueChange={(v) => filters.setSessionId(v === ALL ? undefined : v)}
        >
          <SelectTrigger className="h-7 w-[160px] text-xs border-border bg-muted/60">
            <SelectValue placeholder="Por sesión" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las sesiones</SelectItem>
            {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <Divider />

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'h-7 flex items-center gap-1.5 px-2 text-xs rounded border border-border bg-muted/60 text-foreground hover:bg-muted transition-colors whitespace-nowrap',
              !dateRange?.from && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
            <DateRangeLabel from={dateRange?.from} to={dateRange?.to} />
            {dateRange?.from && (
              <span
                role="button"
                aria-label="Quitar rango de fechas"
                onClick={(e) => { e.stopPropagation(); filters.setDateRange(undefined); }}
                className="ml-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="range" selected={dateRange} onSelect={filters.setDateRange} numberOfMonths={2} initialFocus />
        </PopoverContent>
      </Popover>

      <Divider />

      {variant === 'levels' ? (
        <ChipGroup items={LEVEL_ITEMS} selected={draft.levels} onToggle={filters.toggleLevel}
          activeClassName="bg-blue-600 border-blue-500 text-white" />
      ) : (
        <ChipGroup items={COMPETENCY_ITEMS} selected={draft.competencies} onToggle={filters.toggleCompetency}
          activeClassName="bg-purple-600 border-purple-500 text-white" />
      )}

      <div className="flex gap-1.5 ml-auto">
        <Button onClick={filters.apply} size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3">
          Aplicar
        </Button>
        <Button onClick={filters.clear} variant="ghost" size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2">
          Limpiar
        </Button>
      </div>
    </div>
  );
}
