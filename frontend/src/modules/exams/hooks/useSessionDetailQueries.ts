import { examResultKeys } from '@/components/exam-review';
import { candidateService } from '@/services/candidateService';
import { examResultService } from '@/services/examResultService';
import { examService } from '@/services/examService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export const sessionDetailKeys = {
  all: ['session-detail'] as const,
  results: (sessionId: string) => [...sessionDetailKeys.all, sessionId, 'results'] as const,
  candidateNames: (ids: string[]) => [...sessionDetailKeys.all, 'candidate-names', ids] as const,
};

/** Results exist only once a session is completed; the query stays idle before that. */
export const useSessionResults = (sessionId: string | undefined, completed: boolean) =>
  useQuery({
    queryKey: sessionDetailKeys.results(sessionId ?? ''),
    queryFn: () => examResultService.getSessionResults(sessionId as string),
    enabled: !!sessionId && completed,
  });

/**
 * Display names for candidate ids. Best effort: on failure the table falls back
 * to showing the id, as before.
 */
export const useCandidateNames = (candidateIds: string[]) => {
  const ids = [...new Set(candidateIds)].sort();
  return useQuery({
    queryKey: sessionDetailKeys.candidateNames(ids),
    queryFn: async (): Promise<Record<string, string>> => {
      const res = await candidateService.getCandidatesByIds(ids);
      const candidates = Array.isArray(res.data) ? res.data : [];
      const names: Record<string, string> = {};
      for (const c of candidates) {
        const full = `${c.personalInfo.firstName} ${c.personalInfo.lastName}`.trim();
        if (full) names[c._id] = full;
      }
      return names;
    },
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
  });
};

/** Re-grades every attempt in the session, then refreshes its results and any open detail. */
export const useRegradeSession = (sessionId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const body: unknown = await examService.regradeSession(sessionId);
      const data = (body as { data?: { queued?: number; total?: number } })?.data;
      return { queued: data?.queued ?? 0, total: data?.total ?? 0 };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sessionDetailKeys.results(sessionId) });
      queryClient.invalidateQueries({ queryKey: examResultKeys.all });
    },
  });
};

/** Adds minutes to a running or scheduled session. */
export const useExtendSession = (sessionId: string) =>
  useMutation({
    mutationFn: (minutes: number) => examService.extendSession(sessionId, minutes),
  });
