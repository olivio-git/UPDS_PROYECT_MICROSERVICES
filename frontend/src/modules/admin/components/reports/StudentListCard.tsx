import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/lib/utils';
import type { ReportFilters, StudentListEntry } from '@/services/reportsService';
import { hashKey } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, Search, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudentList } from '../../hooks/useReportQueries';
import { ReportCard } from './ReportCard';
import { scoreTextClass } from './scoring';

const SEARCH_DEBOUNCE_MS = 350;

function TrendIcon({ trend }: { trend: StudentListEntry['trend'] }) {
  if (trend === 'improving') return <TrendingUp className="h-3.5 w-3.5 text-emerald-400 mx-auto" />;
  if (trend === 'declining') return <TrendingDown className="h-3.5 w-3.5 text-red-400 mx-auto" />;
  return <span className="text-muted-foreground text-[10px]">—</span>;
}

function StudentRow({ student, onOpen }: { student: StudentListEntry; onOpen: () => void }) {
  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-colors">
      <td className="py-2">
        <p className="text-foreground font-medium leading-tight">{student.name || '—'}</p>
        {student.email && <p className="text-muted-foreground text-[10px]">{student.email}</p>}
      </td>
      <td className="py-2 text-center">
        {student.currentLevel !== 'N/A' ? (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            {student.currentLevel}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-2 text-right">
        {Number.isFinite(student.averageScore)
          ? <span className={`font-semibold ${scoreTextClass(student.averageScore)}`}>{student.averageScore.toFixed(1)}</span>
          : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="py-2 text-right text-muted-foreground">{student.examCount}</td>
      <td className="py-2 text-right text-muted-foreground">
        {student.lastExamDate
          ? new Date(student.lastExamDate).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })
          : '—'}
      </td>
      <td className="py-2 text-center"><TrendIcon trend={student.trend} /></td>
      <td className="py-2">
        <button
          type="button"
          onClick={onOpen}
          className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          Ver
        </button>
      </td>
    </tr>
  );
}

const PAGE_BUTTON =
  'h-6 w-6 flex items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

export function StudentListCard({ filters }: { filters: ReportFilters }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  // The page belongs to one (filters, search) combination: when either changes,
  // go back to page 1. Derived during render instead of reset in an effect.
  // hashKey sorts object keys, like the query cache does.
  const scope = hashKey([filters, debouncedSearch]);
  const [paging, setPaging] = useState({ scope, page: 1 });
  const page = paging.scope === scope ? paging.page : 1;
  const goTo = (next: number) => setPaging({ scope, page: next });

  const { data, isPending, isFetching, isError } = useStudentList(filters, page, debouncedSearch);
  const students = data?.students ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <ReportCard
      icon={Users}
      title={
        <>
          Estudiantes
          {(data?.total ?? 0) > 0 && (
            <span className="text-[10px] text-muted-foreground font-normal">({data?.total} en total)</span>
          )}
        </>
      }
      actions={
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            aria-label="Buscar estudiante por nombre"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-6 pr-2 text-xs bg-muted/60 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-44"
          />
        </div>
      }
    >
      {isPending ? (
        <div className="h-40 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="h-40 flex items-center justify-center text-red-400 text-xs">
          Error cargando la lista de estudiantes
        </div>
      ) : students.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground text-xs">
          {debouncedSearch ? 'Sin resultados para la búsqueda' : 'Sin estudiantes con exámenes completados'}
        </div>
      ) : (
        <>
          <div className={cn('overflow-auto transition-opacity', isFetching && 'opacity-60')}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 text-muted-foreground font-medium">Estudiante</th>
                  <th className="text-center py-1.5 text-muted-foreground font-medium">Nivel</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium">Promedio</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium">Exámenes</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium">Último</th>
                  <th className="text-center py-1.5 text-muted-foreground font-medium">Tendencia</th>
                  <th className="py-1.5" />
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <StudentRow
                    key={student.candidateId}
                    student={student}
                    onOpen={() => navigate(`/student-history/${student.candidateId}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
              <span className="text-[10px] text-muted-foreground">Página {page} de {totalPages}</span>
              <div className="flex gap-1">
                <button type="button" aria-label="Página anterior" className={PAGE_BUTTON}
                  disabled={page <= 1 || isFetching} onClick={() => goTo(page - 1)}>
                  <ChevronLeft className="h-3 w-3" />
                </button>
                <button type="button" aria-label="Página siguiente" className={PAGE_BUTTON}
                  disabled={page >= totalPages || isFetching} onClick={() => goTo(page + 1)}>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </ReportCard>
  );
}
