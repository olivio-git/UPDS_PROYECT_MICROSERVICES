import { candidateService, type Candidate } from '@/services/candidateService';
import { reportsService, type ExportOptions } from '@/services/reportsService';
import { useMutation, useQuery } from '@tanstack/react-query';

export const studentHistoryKeys = {
  all: ['student-history'] as const,
  history: (candidateId: string) => [...studentHistoryKeys.all, candidateId] as const,
  search: (term: string) => [...studentHistoryKeys.all, 'search', term] as const,
};

export const MIN_SEARCH_LENGTH = 2;

export const useStudentHistory = (candidateId: string | undefined) =>
  useQuery({
    queryKey: studentHistoryKeys.history(candidateId ?? ''),
    queryFn: () => reportsService.getStudentHistory(candidateId as string),
    enabled: !!candidateId,
  });

/**
 * Candidate search for the student picker.
 *
 * candidateService.searchCandidates is typed as returning Candidate[] in
 * `data`, but the endpoint actually returns `{ results: Candidate[] }` there.
 * Narrow the real shape here instead of casting at the call site.
 */
export const useCandidateSearch = (term: string) => {
  const trimmed = term.trim();
  return useQuery({
    queryKey: studentHistoryKeys.search(trimmed),
    queryFn: async (): Promise<Candidate[]> => {
      const res: unknown = await candidateService.searchCandidates(trimmed);
      const results = (res as { data?: { results?: unknown } })?.data?.results;
      return Array.isArray(results) ? (results as Candidate[]) : [];
    },
    enabled: trimmed.length >= MIN_SEARCH_LENGTH,
  });
};

export const useExportStudentHistory = () =>
  useMutation({
    mutationFn: (args: { candidateId: string; format: 'csv' | 'pdf'; options?: ExportOptions }) =>
      reportsService.exportReport('student-history', {}, args.format, args.candidateId, args.options),
  });
