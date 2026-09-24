import { cn } from '@/lib/utils';
import { sessionStatus } from '@/modules/exams/sessionStatus';
import { CalendarDays, ChevronLeft, ChevronRight, Clock, UserCheck, Users } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatTime, MONTHS, sessionPath, type UpcomingSession } from './calendar';
import { SessionOpenButton } from './SessionOpenButton';

const PAGE_SIZE = 8;

function SessionListRow({ session, onOpen }: { session: UpcomingSession; onOpen: () => void }) {
  const date = new Date(session.startDate);
  const status = sessionStatus(session.status);
  return (
    <div className="flex items-start gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
      <div className="flex flex-col items-center w-10 shrink-0 mt-0.5">
        <span className="text-[10px] text-muted-foreground uppercase leading-none">{MONTHS[date.getMonth()]?.slice(0, 3)}</span>
        <span className="text-xl font-bold text-foreground leading-tight">{date.getDate()}</span>
        <span className="text-[10px] text-muted-foreground">{date.getFullYear()}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <p className="text-sm font-medium text-foreground">{session.sessionName}</p>
          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border font-medium', status.badge)}>{status.label}</span>
        </div>
        <p className="text-xs text-muted-foreground mb-1">{session.examTitle}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(session.startDate)} — {formatTime(session.endDate)}</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{session.registeredCandidates}/{session.maxCandidates}</span>
          <span className="flex items-center gap-1"><UserCheck className="h-3 w-3" />{session.proctorsAssigned} proctors</span>
        </div>
      </div>
      <SessionOpenButton live={session.status === 'in_progress'} onClick={onOpen} className="self-center h-6 w-6 p-1" />
    </div>
  );
}

const pageButton = 'p-1.5 rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

/** Every session in chronological order, paginated. Key it by filter to reset the page. */
export function SessionListView({ sessions }: { sessions: UpcomingSession[] }) {
  const navigate = useNavigate();
  const [requestedPage, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  // Live updates can shrink the list under the user: stay on a page that exists.
  const page = Math.min(requestedPage, totalPages - 1);
  const visible = sessions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="bg-card border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Todas las sesiones ({sessions.length})</h3>
        {totalPages > 1 && <span className="text-xs text-muted-foreground">Página {page + 1} de {totalPages}</span>}
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <CalendarDays className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No hay sesiones programadas próximamente</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border">
            {visible.map((s) => <SessionListRow key={s.sessionId} session={s} onOpen={() => navigate(sessionPath(s))} />)}
          </div>
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-4">
              <span className="text-xs text-muted-foreground">
                Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sessions.length)} de {sessions.length}
              </span>
              <div className="flex items-center gap-1">
                <button type="button" aria-label="Página anterior" onClick={() => setPage(page - 1)} disabled={page === 0} className={pageButton}>
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-current={i === page ? 'page' : undefined}
                    onClick={() => setPage(i)}
                    className={cn(
                      'w-7 h-7 rounded-lg text-xs font-medium border transition-colors',
                      i === page ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted text-foreground',
                    )}
                  >
                    {i + 1}
                  </button>
                ))}
                <button type="button" aria-label="Página siguiente" onClick={() => setPage(page + 1)} disabled={page === totalPages - 1} className={pageButton}>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
