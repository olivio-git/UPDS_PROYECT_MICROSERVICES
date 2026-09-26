import { CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDayLong, dateFromDayKey, sessionPath, type UpcomingSession } from './calendar';
import { SessionSummaryCard } from './SessionSummaryCard';

const PANEL_SIZE = 6;

interface AgendaPanelProps {
  /** Sessions to list, already sorted. */
  sessions: UpcomingSession[];
  /** Selected day key, or null for the next-7-days agenda. */
  selectedDay: string | null;
  onClearDay: () => void;
  onShowAll: () => void;
}

/** Side panel next to the calendar: the selected day, or the coming week. */
export function AgendaPanel({ sessions, selectedDay, onClearDay, onShowAll }: AgendaPanelProps) {
  const navigate = useNavigate();
  const title = selectedDay ? formatDayLong(dateFromDayKey(selectedDay)) : 'Próximos 7 días';
  const hidden = sessions.length - PANEL_SIZE;

  return (
    <div className="bg-card border border-border overflow-hidden sticky top-4">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground capitalize truncate">{title}</h3>
        {selectedDay && (
          <button type="button" onClick={onClearDay} className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0">
            Ver todo
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{selectedDay ? 'Sin sesiones este día' : 'Sin sesiones en los próximos 7 días'}</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border">
            {sessions.slice(0, PANEL_SIZE).map((s) => (
              <SessionSummaryCard key={s.sessionId} session={s} onOpen={() => navigate(sessionPath(s))} />
            ))}
          </div>
          {hidden > 0 && (
            <div className="px-4 py-2.5 border-t border-border">
              <button type="button" onClick={onShowAll} className="w-full text-xs text-primary hover:text-primary/80 text-center transition-colors">
                +{hidden} sesiones más — ver lista completa
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
