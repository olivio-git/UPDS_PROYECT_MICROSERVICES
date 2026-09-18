import { Button } from '@/components/atoms/button';
import { MainLayout } from '@/components/layout';
import ExportOptionsModal from '@/components/modals/ExportOptionsModal';
import { cn } from '@/lib/utils';
import type { ExportOptions } from '@/services/reportsService';
import { useQueryClient } from '@tanstack/react-query';
import { BarChart3, Brain, Loader2, RefreshCw, Users, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { CompetenciesTab } from '../components/reports/CompetenciesTab';
import { StudentsTab } from '../components/reports/StudentsTab';
import { SummaryTab } from '../components/reports/SummaryTab';
import { useReportFilters } from '../hooks/useReportFilters';
import {
  reportKeys, useCompletedSessions, useDashboardSummary, useExportReport, useReportsFetching,
  type ExportReportType,
} from '../hooks/useReportQueries';

type TabId = 'resumen' | 'competencias' | 'estudiantes';

const TABS: ReadonlyArray<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: 'resumen', label: 'Resumen', icon: BarChart3 },
  { id: 'competencias', label: 'Competencias', icon: Brain },
  { id: 'estudiantes', label: 'Estudiantes', icon: Users },
];

function CenteredState({ children }: { children: ReactNode }) {
  return (
    <MainLayout>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">{children}</div>
      </div>
    </MainLayout>
  );
}

const ReportsScreen: React.FC = () => {
  const queryClient = useQueryClient();
  const filters = useReportFilters();
  const [activeTab, setActiveTab] = useState<TabId>('resumen');
  const [exportType, setExportType] = useState<ExportReportType | null>(null);

  const summary = useDashboardSummary(filters.applied);
  const { data: sessions = [] } = useCompletedSessions();
  const refreshing = useReportsFetching();
  const exportReport = useExportReport();

  // The session list barely changes and has its own long staleTime; refresh
  // only the reports themselves.
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: reportKeys.dashboard() });
    queryClient.invalidateQueries({ queryKey: reportKeys.studentLists() });
  };

  // A failed refetch keeps the last good data on screen: report it without
  // replacing the page. errorUpdatedAt changes on every new failure.
  const failedWithData = summary.isError && summary.data !== undefined;
  useEffect(() => {
    if (failedWithData) toast.error('Error actualizando los reportes');
  }, [failedWithData, summary.errorUpdatedAt]);

  const handleExport = (format: 'csv' | 'pdf', options?: ExportOptions) => {
    if (!exportType) return;
    exportReport.mutate(
      // Exports what is on screen: the applied filters, not unapplied edits.
      { type: exportType, filters: filters.applied, format, options },
      {
        onSuccess: () => {
          const ai = options?.includeInterpretation ? ' con análisis IA' : '';
          toast.success(`Reporte exportado como ${format.toUpperCase()}${ai}`);
          setExportType(null);
        },
        onError: () => toast.error('Error exportando el reporte'),
      },
    );
  };

  if (summary.isPending) {
    return (
      <CenteredState>
        <Loader2 className="h-7 w-7 animate-spin mx-auto text-blue-500" />
        <p className="text-muted-foreground text-sm">Cargando reportes...</p>
      </CenteredState>
    );
  }

  if (summary.data === undefined) {
    // Nothing to show: either the first load failed, or new filters failed and
    // their key has no cached result. Offer a way out of those filters too.
    return (
      <CenteredState>
        <p className="text-foreground text-sm">Error cargando los reportes</p>
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" onClick={() => summary.refetch()}>Reintentar</Button>
          <Button size="sm" variant="ghost" onClick={filters.clear}>Quitar filtros</Button>
        </div>
      </CenteredState>
    );
  }

  const tabProps = { summary: summary.data, filters, sessions };

  return (
    <MainLayout>
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Reportes y Análisis</h1>
            <p className="text-muted-foreground text-xs">Rendimiento académico · Competencias · Tendencias</p>
          </div>
          <Button
            onClick={refresh}
            size="sm"
            variant="ghost"
            aria-label="Actualizar reportes"
            className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8 p-0"
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </Button>
        </div>

        <div className="flex gap-1.5 flex-wrap" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                activeTab === id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'resumen' && <SummaryTab {...tabProps} />}
        {activeTab === 'competencias' && <CompetenciesTab {...tabProps} onExport={() => setExportType('competency')} />}
        {activeTab === 'estudiantes' && <StudentsTab {...tabProps} onExport={() => setExportType('students')} />}
      </div>

      <ExportOptionsModal
        isOpen={exportType !== null}
        onClose={() => setExportType(null)}
        onExport={handleExport}
        reportType={exportType ?? 'competency'}
        isLoading={exportReport.isPending}
      />
    </MainLayout>
  );
};

export default ReportsScreen;
