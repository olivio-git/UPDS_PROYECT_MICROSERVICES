import type { ReportFiltersState } from '../../hooks/useReportFilters';
import {
  useCompetencyAnalysis, useReportTrends, useStudentStats, type SessionOption,
} from '../../hooks/useReportQueries';
import type { DashboardSummary } from '@/services/reportsService';
import { InsightsCard } from './InsightsCard';
import { KpiCards } from './KpiCards';
import { LevelOverviewCard } from './LevelOverviewCard';
import { PerformanceDistributionCard } from './PerformanceDistributionCard';
import { ReportFiltersBar } from './ReportFiltersBar';
import { TrendsCard } from './TrendsCard';

interface SummaryTabProps {
  summary: DashboardSummary;
  filters: ReportFiltersState;
  sessions: SessionOption[];
}

export function SummaryTab({ summary, filters, sessions }: SummaryTabProps) {
  const { data: stats } = useStudentStats(filters.applied);
  const { data: competency } = useCompetencyAnalysis(filters.applied);
  const { data: trends } = useReportTrends(filters.trendPeriod, filters.applied);

  return (
    <div className="space-y-3">
      <ReportFiltersBar filters={filters} sessions={sessions} variant="levels" />
      <KpiCards summary={summary} stats={stats} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <PerformanceDistributionCard distribution={summary.performanceDistribution} />
        <TrendsCard trends={trends} period={filters.trendPeriod} onPeriodChange={filters.setTrendPeriod} />
      </div>
      <InsightsCard summary={summary} competency={competency} />
      <LevelOverviewCard distribution={summary.levelDistribution} />
    </div>
  );
}
