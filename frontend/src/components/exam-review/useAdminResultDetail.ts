import { examResultService } from '@/services/examResultService';
import { useQuery } from '@tanstack/react-query';

export const examResultKeys = {
  all: ['exam-results'] as const,
  adminDetail: (resultId: string) => [...examResultKeys.all, resultId, 'admin'] as const,
};

/** Per-question detail of one exam result, for staff. Idle until a result id is given. */
export const useAdminResultDetail = (resultId: string | undefined) =>
  useQuery({
    queryKey: examResultKeys.adminDetail(resultId ?? ''),
    queryFn: () => examResultService.getAdminResultDetail(resultId as string),
    enabled: !!resultId,
    // A graded result does not change while someone is reading it.
    staleTime: 5 * 60_000,
  });
