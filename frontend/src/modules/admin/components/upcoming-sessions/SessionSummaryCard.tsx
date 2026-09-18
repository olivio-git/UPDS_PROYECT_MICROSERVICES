import { cn } from '@/lib/utils';
import { sessionStatus } from '@/modules/exams/sessionStatus';
import { Clock, UserCheck, Users } from 'lucide-react';
import { formatTime, type UpcomingSession } from './calendar';
import { SessionOpenButton } from './SessionOpenButton';

/** Compact session row for the agenda panel. */
export function SessionSummaryCard({ session, onOpen }: { session: UpcomingSession; onOpen: () => void }) {
  const status = sessionStatus(session.status);
  return (
    <div className="px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-2 mb-1.5">
        <span className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', status.dot)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{session.sessionName}</p>
          <p className="text-xs text-muted-foreground truncate">{session.examTitle}</p>
        </div>
        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium shrink-0', status.badge)}>{status.label}</span>
        <SessionOpenButton live={session.status === 'in_progress'} onClick={onOpen} className="h-4 w-4 p-0.5" />
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground pl-4">
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(session.startDate)} — {formatTime(session.endDate)}</span>
        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{session.registeredCandidates}/{session.maxCandidates}</span>
        <span className="flex items-center gap-1" title="Proctors asignados"><UserCheck className="h-3 w-3" />{session.proctorsAssigned}</span>
      </div>
    </div>
  );
}
