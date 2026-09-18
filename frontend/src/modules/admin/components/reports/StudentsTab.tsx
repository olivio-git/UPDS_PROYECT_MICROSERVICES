import type { DashboardSummary } from '@/services/reportsService';
import type { ReportFiltersState } from '../../hooks/useReportFilters';
import type { SessionOption } from '../../hooks/useReportQueries';
import { ExportButton } from './ExportButton';
import { LevelDistributionCard } from './LevelDistributionCard';
import { ReportFiltersBar } from './ReportFiltersBar';
import { StudentListCard } from './StudentListCard';

interface StudentsTabProps {
  summary: DashboardSummary;
  filters: ReportFiltersState;
  sessions: SessionOption[];
  onExport: () => void;
}

export function StudentsTab({ summary, filters, sessions, onExport }: StudentsTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <ReportFiltersBar filters={filters} sessions={sessions} variant="levels" />
        </div>
        <ExportButton onClick={onExport} className="bg-blue-700 hover:bg-blue-600 text-white" />
      </div>
      <LevelDistributionCard distribution={summary.levelDistribution} />
      <StudentListCard filters={filters.applied} />
    </div>
  );
}
