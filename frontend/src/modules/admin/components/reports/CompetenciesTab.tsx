import type { DashboardSummary } from '@/services/reportsService';
import type { ReportFiltersState } from '../../hooks/useReportFilters';
import { useCompetencyAnalysis, type SessionOption } from '../../hooks/useReportQueries';
import { CompetencyCard } from './CompetencyCard';
import { ExportButton } from './ExportButton';
import { ReportFiltersBar } from './ReportFiltersBar';

interface CompetenciesTabProps {
  summary: DashboardSummary;
  filters: ReportFiltersState;
  sessions: SessionOption[];
  onExport: () => void;
}

export function CompetenciesTab({ summary, filters, sessions, onExport }: CompetenciesTabProps) {
  const { data: competency } = useCompetencyAnalysis(filters.applied);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <ReportFiltersBar filters={filters} sessions={sessions} variant="competencies" />
        </div>
        <ExportButton onClick={onExport} variant="outline" className="border-border text-foreground/80 bg-muted hover:bg-muted" />
      </div>
      <CompetencyCard summary={summary} competency={competency} />
    </div>
  );
}
