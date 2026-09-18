import { notificationSocket } from '@/services/notifications/notificationSocket';
import { reportsService, type ExportOptions } from '@/services/reportsService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

export const upcomingSessionsKeys = {
  all: ['upcoming-sessions'] as const,
};

const SESSION_STATUS_EVENT = 'session.status.changed';

/**
 * Upcoming sessions, kept fresh in real time: a session status change pushed
 * over the notifications socket marks the data stale and it refetches in the
 * background, without blanking the screen.
 */
export function useUpcomingSessions() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const onStatusChanged = () => queryClient.invalidateQueries({ queryKey: upcomingSessionsKeys.all });
    notificationSocket.on(SESSION_STATUS_EVENT, onStatusChanged);
    notificationSocket.connect().catch(() => {
      // Live updates are optional; the manual refresh button still works.
    });
    return () => notificationSocket.off(SESSION_STATUS_EVENT, onStatusChanged);
  }, [queryClient]);

  return useQuery({
    queryKey: upcomingSessionsKeys.all,
    queryFn: () => reportsService.getUpcomingSessions({}),
  });
}

export const useExportUpcomingSessions = () =>
  useMutation({
    mutationFn: (args: { format: 'csv' | 'pdf'; options?: ExportOptions }) =>
      reportsService.exportReport('upcoming-sessions', {}, args.format, undefined, args.options),
  });
