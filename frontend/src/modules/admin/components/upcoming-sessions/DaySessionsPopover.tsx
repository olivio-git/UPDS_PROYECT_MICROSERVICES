import { cn } from '@/lib/utils';
import { sessionStatus } from '@/modules/exams/sessionStatus';
import { Clock, User2, Users } from 'lucide-react';
import { capacityPercent, formatDayLong, formatTime, type UpcomingSession } from './calendar';

function Creator({ creator, isOwn }: { creator: NonNullable<UpcomingSession['createdBy']>; isOwn: boolean }) {
  return (
    <div className="flex items-center gap-1.5 pt-0.5">
      {creator.avatarUrl ? (
        <img src={creator.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-4 h-4 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
          <User2 className="h-2.5 w-2.5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-foreground/80 font-medium">{creator.firstName} {creator.lastName}</span>
          {isOwn && <span className="text-[9px] px-1 py-px rounded bg-primary/15 text-primary font-medium leading-none shrink-0">Tú</span>}
        </div>
        <p className="text-[9px] text-muted-foreground truncate leading-tight">{creator.email}</p>
      </div>
    </div>
  );
}

interface DaySessionsPopoverProps {
  date: Date;
  sessions: UpcomingSession[];
  currentUserEmail?: string;
}

/** Hover summary of every session on one calendar day. */
export function DaySessionsPopover({ date, sessions, currentUserEmail }: DaySessionsPopoverProps) {
  return (
    <div className="w-72 p-0 overflow-hidden">
      <div className="px-3 py-2.5 border-b border-border bg-muted/40">
        <p className="text-xs font-semibold text-foreground capitalize">{formatDayLong(date)}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{sessions.length} sesión{sessions.length !== 1 ? 'es' : ''}</p>
      </div>
      <div className="divide-y divide-border">
        {sessions.map((s) => {
          const pct = capacityPercent(s);
          return (
            <div key={s.sessionId} className="px-3 py-2.5">
              <div className="flex items-start gap-2 mb-1.5">
                <span className={cn('w-2 h-2 rounded-full mt-1 shrink-0', sessionStatus(s.status).dot)} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">{s.sessionName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{s.examTitle}</p>
                </div>
              </div>
              <div className="pl-4 space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{formatTime(s.startDate)} — {formatTime(s.endDate)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                    <Users className="h-3 w-3" />
                    <span>{s.registeredCandidates}/{s.maxCandidates}</span>
                  </div>
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-1 bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{pct}%</span>
                </div>
                {s.createdBy && (
                  <Creator creator={s.createdBy} isOwn={!!currentUserEmail && s.createdBy.email === currentUserEmail} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
