import { examService } from '@/services/examService';
import { reportsService, type ExportOptions, type ReportFilters } from '@/services/reportsService';
import { keepPreviousData, useIsFetching, useMutation, useQuery } from '@tanstack/react-query';
import type { TrendPeriod } from '../components/reports/constants';

/**
 * Query keys for the reports screen. Filters are part of the key, so changing
 * them fetches (and caches) a separate result instead of mutating shared state.
 */
export const reportKeys = {
  all: ['reports'] as const,
  /** The four aggregate reports; this group drives the header refresh spinner. */
  dashboard: () => [...reportKeys.all, 'dashboard'] as const,
  summary: (filters: ReportFilters) => [...reportKeys.dashboard(), 'summary', filters] as const,
  competency: (filters: ReportFilters) => [...reportKeys.dashboard(), 'competency', filters] as const,
  studentStats: (filters: ReportFilters) => [...reportKeys.dashboard(), 'student-stats', filters] as const,
  trends: (period: TrendPeriod, filters: ReportFilters) =>
    [...reportKeys.dashboard(), 'trends', period, filters] as const,
  studentLists: () => [...reportKeys.all, 'student-list'] as const,
  studentList: (filters: ReportFilters, page: number, search: string) =>
    [...reportKeys.studentLists(), filters, page, search] as const,
  completedSessions: () => [...reportKeys.all, 'completed-sessions'] as const,
};

// keepPreviousData: while new filters load, keep showing the previous result
// instead of flashing an empty screen.

export const useDashboardSummary = (filters: ReportFilters) =>
  useQuery({
    queryKey: reportKeys.summary(filters),
    queryFn: () => reportsService.getDashboardSummary(filters),
    placeholderData: keepPreviousData,
  });

export const useCompetencyAnalysis = (filters: ReportFilters) =>
  useQuery({
    queryKey: reportKeys.competency(filters),
    queryFn: () => reportsService.getCompetencyAnalysis(filters),
    placeholderData: keepPreviousData,
  });

export const useStudentStats = (filters: ReportFilters) =>
  useQuery({
    queryKey: reportKeys.studentStats(filters),
    queryFn: () => reportsService.getStudentStats(filters),
    placeholderData: keepPreviousData,
  });

/** Changing the period only refetches trends, not the other report sections. */
export const useReportTrends = (period: TrendPeriod, filters: ReportFilters) =>
  useQuery({
    queryKey: reportKeys.trends(period, filters),
    queryFn: () => reportsService.getTrends(period, undefined, filters),
    placeholderData: keepPreviousData,
  });

export const STUDENT_PAGE_SIZE = 20;

export const useStudentList = (filters: ReportFilters, page: number, search: string) =>
  useQuery({
    queryKey: reportKeys.studentList(filters, page, search),
    queryFn: () => reportsService.getStudentList(filters, page, STUDENT_PAGE_SIZE, search),
    placeholderData: keepPreviousData,
  });

export interface SessionOption {
  id: string;
  name: string;
}

/** Completed sessions for the session filter. getSessions is untyped, so narrow here. */
export const useCompletedSessions = () =>
  useQuery({
    queryKey: reportKeys.completedSessions(),
    queryFn: async (): Promise<SessionOption[]> => {
      const res: unknown = await examService.getSessions({ status: 'completed' }, { page: 1, limit: 100 });
      const sessions = (res as { success?: boolean; data?: { sessions?: unknown } })?.data?.sessions;
      if (!Array.isArray(sessions)) return [];
      return sessions.map((s: { _id: string; sessionName?: string; name?: string }) => ({
        id: s._id,
        name: s.sessionName || s.name || s._id,
      }));
    },
    staleTime: 5 * 60_000,
  });

/**
 * True while one of the four aggregate reports is loading. The student list has
 * its own inline indicator, so searching or paging does not spin the header.
 */
export const useReportsFetching = () => useIsFetching({ queryKey: reportKeys.dashboard() }) > 0;

export type ExportReportType = 'competency' | 'students';

export const useExportReport = () =>
  useMutation({
    mutationFn: (args: {
      type: ExportReportType;
      filters: ReportFilters;
      format: 'csv' | 'pdf';
      options?: ExportOptions;
    }) => reportsService.exportReport(args.type, args.filters, args.format, undefined, args.options),
  });
