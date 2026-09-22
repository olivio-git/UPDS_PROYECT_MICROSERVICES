import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/atoms/hover-card';
import { cn } from '@/lib/utils';
import { SESSION_STATUS_LEGEND, sessionStatus } from '@/modules/exams/sessionStatus';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dayKey, localDayKey, MONTHS, monthLayout, WEEKDAYS, type UpcomingSession } from './calendar';
import { DaySessionsPopover } from './DaySessionsPopover';

const CHIPS_PER_DAY = 2;

interface DayCellProps {
  day: number;
  sessions: UpcomingSession[];
  isToday: boolean;
  isSelected: boolean;
  isPast: boolean;
}

function DayCellContent({ day, sessions, isToday, isSelected }: DayCellProps) {
  const extra = sessions.length - CHIPS_PER_DAY;
  return (
    <>
      <div className={cn(
        'w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 select-none',
        isToday ? 'bg-primary text-primary-foreground' : isSelected ? 'text-primary font-bold' : 'text-foreground',
      )}>
        {day}
      </div>
      <div className="space-y-0.5">
        {sessions.slice(0, CHIPS_PER_DAY).map((s) => (
          <div key={s.sessionId} className={cn('text-[10px] truncate px-1.5 py-0.5 rounded border leading-tight', sessionStatus(s.status).badge)}>
            {s.sessionName}
          </div>
        ))}
        {extra > 0 && <div className="text-[10px] text-muted-foreground px-1 leading-tight">+{extra} más</div>}
      </div>
    </>
  );
}

const cellClass = ({ isSelected, isToday, isPast }: Pick<DayCellProps, 'isSelected' | 'isToday' | 'isPast'>, interactive: boolean) =>
  cn(
    'min-h-[90px] p-1.5 rounded-lg border transition-all text-left align-top',
    isSelected ? 'border-primary bg-primary/10'
      : isToday ? 'border-primary/40 bg-primary/5'
      : interactive ? 'border-transparent hover:border-border hover:bg-muted/40 cursor-pointer'
      : 'border-transparent',
    isPast && !isToday && 'opacity-40',
  );

interface MonthCalendarProps {
  viewDate: Date;
  onViewDateChange: (date: Date) => void;
  sessionsByDay: Record<string, UpcomingSession[]>;
  selectedDay: string | null;
  onSelectDay: (key: string | null) => void;
  currentUserEmail?: string;
}

export function MonthCalendar({ viewDate, onViewDateChange, sessionsByDay, selectedDay, onSelectDay, currentUserEmail }: MonthCalendarProps) {
  const { year, month, daysInMonth, leadingBlanks } = monthLayout(viewDate);
  const todayKey = localDayKey(new Date());

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Mes anterior" onClick={() => onViewDateChange(new Date(year, month - 1, 1))}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground px-2 min-w-[140px] text-center" aria-live="polite">
            {MONTHS[month]} {year}
          </span>
          <button type="button" aria-label="Mes siguiente" onClick={() => onViewDateChange(new Date(year, month + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <button type="button" onClick={() => { onViewDateChange(new Date()); onSelectDay(null); }}
          className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
          Hoy
        </button>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((d) => <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1.5">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlanks }, (_, i) => <div key={`blank-${i}`} className="min-h-[90px]" />)}

          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const key = dayKey(year, month, day);
            const sessions = sessionsByDay[key] ?? [];
            const state = { isToday: key === todayKey, isSelected: key === selectedDay, isPast: key < todayKey };
            const content = <DayCellContent day={day} sessions={sessions} {...state} />;

            if (sessions.length === 0) {
              return <div key={key} className={cellClass(state, false)}>{content}</div>;
            }
            return (
              <HoverCard key={key} openDelay={300} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    aria-pressed={state.isSelected}
                    aria-label={`${day} de ${MONTHS[month]}: ${sessions.length} sesión${sessions.length !== 1 ? 'es' : ''}`}
                    onClick={() => onSelectDay(state.isSelected ? null : key)}
                    className={cellClass(state, true)}
                  >
                    {content}
                  </button>
                </HoverCardTrigger>
                <HoverCardContent side="right" align="start" className="w-72 p-0 overflow-hidden border border-border bg-card shadow-xl">
                  <DaySessionsPopover date={new Date(year, month, day)} sessions={sessions} currentUserEmail={currentUserEmail} />
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </div>

        <div className="flex items-center gap-4 pt-3 mt-2 border-t border-border">
          {SESSION_STATUS_LEGEND.map((status) => {
            const style = sessionStatus(status);
            return (
              <div key={status} className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full shrink-0', style.dot)} />
                <span className="text-[10px] text-muted-foreground">{style.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
