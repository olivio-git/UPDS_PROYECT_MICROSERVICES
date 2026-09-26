import CustomizableTable from '@/components/common/CustomizableTable';
import { MCER_LEVELS } from '@/lib/mcer';
import { PASS_THRESHOLD, scoreBadgeClass } from '@/lib/scoreBands';
import { cn } from '@/lib/utils';
import type { StudentHistoryData } from '@/services/reportsService';
import {
  createColumnHelper, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState,
} from '@tanstack/react-table';
import { BookOpen, Calendar, Clock, Eye, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDateTime, formatMinutes } from './format';

export type ExamEntry = StudentHistoryData['examHistory'][number];

type ResultFilter = 'all' | 'passed' | 'failed';

const TOP_MIN = 3;
const TOP_MAX = 20;

const columnHelper = createColumnHelper<ExamEntry>();

function buildColumns(onOpen: (exam: ExamEntry) => void) {
  return [
    columnHelper.accessor('examTitle', {
      header: 'Examen',
      size: 220,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground text-xs leading-tight truncate">{row.original.examTitle}</p>
          <p className="text-[11px] text-muted-foreground truncate">{row.original.sessionName}</p>
        </div>
      ),
    }),
    columnHelper.accessor('completedAt', {
      header: 'Fecha',
      size: 110,
      cell: ({ getValue }) => (
        <span className="flex items-center gap-1 text-muted-foreground text-xs whitespace-nowrap">
          <Calendar className="h-3 w-3 shrink-0" />
          {formatDateTime(getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('level', {
      header: 'Nivel',
      size: 60,
      cell: ({ getValue }) => (
        <span className="text-[10px] bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded-full font-mono">
          {getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('timeSpent', {
      header: 'Tiempo',
      size: 70,
      cell: ({ getValue }) => (
        <span className="flex items-center gap-1 text-muted-foreground text-xs">
          <Clock className="h-3 w-3 shrink-0" />
          {formatMinutes(getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('percentage', {
      header: '%',
      size: 72,
      cell: ({ getValue }) => (
        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border', scoreBadgeClass(getValue()))}>
          {getValue().toFixed(1)}%
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      size: 36,
      header: '',
      cell: ({ row }) => (
        <button
          type="button"
          aria-label={`Ver detalle de ${row.original.examTitle}`}
          onClick={() => onOpen(row.original)}
          className="p-1 rounded hover:bg-muted transition-colors group"
        >
          <Eye className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-blue-500" />
        </button>
      ),
    }),
  ];
}

const chip = (active: boolean, activeClass = 'bg-blue-600 text-white border-blue-600') =>
  cn(
    'h-5 px-2 rounded text-[10px] font-medium transition-colors border',
    active ? activeClass : 'bg-transparent text-muted-foreground border-border hover:border-blue-400 hover:text-foreground',
  );

const RESULT_FILTERS: ReadonlyArray<{ value: ResultFilter; label: string; activeClass: string }> = [
  { value: 'all', label: 'Todos', activeClass: 'bg-blue-600 text-white border-blue-600' },
  { value: 'passed', label: `Aprobados ≥${PASS_THRESHOLD}`, activeClass: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'failed', label: 'No aprobados', activeClass: 'bg-red-600 text-white border-red-600' },
];

interface ExamHistoryTableProps {
  exams: ExamEntry[];
  onOpenExam: (exam: ExamEntry) => void;
}

export function ExamHistoryTable({ exams, onOpenExam }: ExamHistoryTableProps) {
  const [search, setSearch] = useState('');
  const [level, setLevel] = useState<string>('all');
  const [result, setResult] = useState<ResultFilter>('all');
  const [topOnly, setTopOnly] = useState(false);
  const [topCount, setTopCount] = useState(5);
  const [sorting, setSorting] = useState<SortingState>([]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = exams.filter((e) =>
      (!q || [e.examTitle, e.sessionName, e.level].some((f) => f.toLowerCase().includes(q))) &&
      (level === 'all' || e.level === level) &&
      (result === 'all' || (result === 'passed') === (e.percentage >= PASS_THRESHOLD)),
    );
    if (topOnly) list = [...list].sort((a, b) => b.percentage - a.percentage).slice(0, topCount);
    return list;
  }, [exams, search, level, result, topOnly, topCount]);

  const columns = useMemo(() => buildColumns(onOpenExam), [onOpenExam]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const filtersActive = level !== 'all' || result !== 'all' || topOnly;

  return (
    <section className="bg-card border border-border overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <h2 className="text-xs font-semibold text-foreground shrink-0">Historial de Exámenes</h2>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border shrink-0">
          {filtered.length}
        </span>
        <div className="relative flex-1 max-w-48 ml-auto">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar..."
            aria-label="Buscar en el historial"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-6 pr-2 h-6 text-xs bg-muted/50 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500 focus:ring-0"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-1">
          {['all', ...MCER_LEVELS].map((lvl) => (
            <button key={lvl} type="button" aria-pressed={level === lvl} onClick={() => setLevel(lvl)} className={chip(level === lvl)}>
              {lvl === 'all' ? 'Nivel' : lvl}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1">
          {RESULT_FILTERS.map(({ value, label, activeClass }) => (
            <button key={value} type="button" aria-pressed={result === value} onClick={() => setResult(value)} className={chip(result === value, activeClass)}>
              {label}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-pressed={topOnly}
            onClick={() => setTopOnly((t) => !t)}
            title="Muestra solo los N mejores exámenes del alumno ordenados por porcentaje"
            className={cn(chip(topOnly, 'bg-amber-500 text-white border-amber-500'), 'flex items-center gap-1 hover:border-amber-400')}
          >
            ★ Top
          </button>
          {topOnly && (
            <input
              type="number"
              min={TOP_MIN}
              max={TOP_MAX}
              value={topCount}
              aria-label="Cantidad de mejores exámenes"
              onChange={(e) => setTopCount(Math.min(TOP_MAX, Math.max(TOP_MIN, Number(e.target.value) || TOP_MIN)))}
              title={`Mínimo ${TOP_MIN}, máximo ${TOP_MAX}`}
              className="w-10 h-5 text-center text-[10px] font-semibold bg-amber-500/10 border border-amber-500/40 rounded text-amber-600 dark:text-amber-400 focus:outline-none focus:border-amber-500"
            />
          )}
        </div>
        {filtersActive && (
          <button
            type="button"
            onClick={() => { setLevel('all'); setResult('all'); setTopOnly(false); }}
            className="h-5 px-2 rounded text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 ml-auto"
          >
            <X className="h-2.5 w-2.5" /> Limpiar
          </button>
        )}
      </div>

      <CustomizableTable table={table} isLoading={false} rows={5} noDataMessage="Sin exámenes registrados" />
    </section>
  );
}
