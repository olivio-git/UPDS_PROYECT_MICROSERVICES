import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/atoms/hover-card';
import { ChevronLeft, ChevronRight, Calendar, Clock, Loader2, User2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { notificationSocket } from '@/services/notifications/notificationSocket';
import { studentExamService, type NextExamData } from '../services/examService';

const DAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const statusDot = (status: string) => {
  if (status === 'in_progress') return 'bg-amber-500';
  if (status === 'scheduled') return 'bg-blue-500';
  return 'bg-muted-foreground';
};

const statusChip = (status: string) => {
  if (status === 'in_progress') return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/30';
  if (status === 'scheduled')   return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/30';
  return 'bg-muted text-muted-foreground border-border';
};

const statusLabel = (status: string) => {
  if (status === 'in_progress') return 'En progreso';
  if (status === 'scheduled')   return 'Programada';
  return status;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });

const fmtDayFull = (y: number, m: number, d: number) =>
  new Date(y, m, d).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' });

const DayHoverContent: React.FC<{ year: number; month: number; day: number; exams: NextExamData[] }> = ({ year, month, day, exams }) => (
  <div className="w-64 p-0 overflow-hidden">
    <div className="px-3 py-2.5 border-b border-border bg-muted/40">
      <p className="text-xs font-semibold text-foreground capitalize">{fmtDayFull(year, month, day)}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">
        {exams.length} examen{exams.length !== 1 ? 'es' : ''}
      </p>
    </div>
    <div className="divide-y divide-border">
      {exams.map(exam => (
        <div key={exam.sessionId} className="px-3 py-2.5">
          <div className="flex items-start gap-2 mb-1.5">
            <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${statusDot(exam.status)}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-foreground truncate">{exam.name}</p>
              {exam.exam?.name && exam.exam.name !== exam.name && (
                <p className="text-[10px] text-muted-foreground truncate">{exam.exam.name}</p>
              )}
            </div>
          </div>
          <div className="pl-4 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              <span>{fmtTime(exam.rawStartDate)} — {fmtTime(exam.rawEndDate)} · {exam.duration}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] px-1.5 py-0.5 rounded border font-medium bg-muted text-muted-foreground border-border">
                Nivel {exam.level}
              </span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${statusChip(exam.status)}`}>
                {statusLabel(exam.status)}
              </span>
            </div>
            {exam.createdBy && (
              <div className="flex items-center gap-1.5 mt-0.5">
                {exam.createdBy.avatarUrl ? (
                  <img
                    src={exam.createdBy.avatarUrl}
                    alt=""
                    className="w-4 h-4 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
                    <User2 className="h-2.5 w-2.5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <span className="text-[10px] text-foreground/80 font-medium">
                    {exam.createdBy.firstName} {exam.createdBy.lastName}
                  </span>
                  {exam.createdBy.email && (
                    <p className="text-[9px] text-muted-foreground truncate leading-tight">
                      {exam.createdBy.email}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const ExamCalendar = () => {
  const [exams, setExams] = useState<NextExamData[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const loadExams = () => {
    studentExamService
      .getNextExams(false)
      .then(setExams)
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadExams();

    const onStatusChanged = () => loadExams();
    const onNotification = (data: any) => {
      if (
        data?.type === 'session.candidate.added' ||
        data?.type === 'candidate.kicked' ||
        data?.type === 'session.candidate.removed'
      ) {
        loadExams();
      }
    };

    notificationSocket.on('session.status.changed', onStatusChanged);
    notificationSocket.on('notification.created', onNotification);
    notificationSocket.connect().catch(() => {});

    return () => {
      notificationSocket.off('session.status.changed', onStatusChanged);
      notificationSocket.off('notification.created', onNotification);
    };
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday-first offset
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const todayDay = isCurrentMonth ? today.getDate() : -1;

  // Group exams by day for this month
  const examsByDay: Record<number, NextExamData[]> = {};
  exams.forEach((exam) => {
    const d = new Date(exam.rawStartDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!examsByDay[day]) examsByDay[day] = [];
      examsByDay[day].push(exam);
    }
  });

  const selectedExams = selectedDay ? (examsByDay[selectedDay] ?? []) : [];

  const upcoming = [...exams]
    .sort((a, b) => new Date(a.rawStartDate).getTime() - new Date(b.rawStartDate).getTime())
    .slice(0, 4);

  const prevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };
  const nextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Mis Exámenes</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium text-foreground px-1 min-w-[100px] text-center">
            {MONTHS[month]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-0.5">
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-0.5">
            {/* Empty offset cells */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`off-${i}`} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const hasExam = !!examsByDay[day];
              const isToday = day === todayDay;
              const isSelected = day === selectedDay;
              const isPast = isCurrentMonth && day < todayDay;

              const cell = (
                <button
                  key={day}
                  onClick={() => hasExam && setSelectedDay(isSelected ? null : day)}
                  className={[
                    'relative flex flex-col items-center justify-center rounded-lg pb-1 pt-1.5 text-xs transition-all',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : isToday
                      ? 'bg-primary/10 text-primary font-bold'
                      : hasExam
                      ? 'hover:bg-muted cursor-pointer text-foreground'
                      : 'text-muted-foreground cursor-default',
                    isPast && !isToday ? 'opacity-40' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <span>{day}</span>
                  {hasExam && (
                    <div className="flex gap-0.5 mt-0.5">
                      {examsByDay[day].slice(0, 3).map((e, idx) => (
                        <span
                          key={idx}
                          className={`w-1 h-1 rounded-full ${
                            isSelected ? 'bg-primary-foreground' : statusDot(e.status)
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );

              if (!hasExam) return cell;

              return (
                <HoverCard key={day} openDelay={300} closeDelay={100}>
                  <HoverCardTrigger asChild>{cell}</HoverCardTrigger>
                  <HoverCardContent
                    side="right"
                    align="start"
                    className="w-64 p-0 overflow-hidden border border-border bg-card shadow-xl"
                  >
                    <DayHoverContent year={year} month={month} day={day} exams={examsByDay[day]} />
                  </HoverCardContent>
                </HoverCard>
              );
            })}
          </div>
        )}

        {/* Selected day detail */}
        {selectedExams.length > 0 && (
          <div className="border border-border rounded-lg p-2.5 space-y-2 bg-muted/30">
            {selectedExams.map((exam) => (
              <div key={exam.sessionId} className="flex items-start gap-2">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${statusDot(exam.status)}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{exam.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {exam.time} · Nivel {exam.level} · {exam.duration}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Upcoming list */}
        {!loading && upcoming.length > 0 && (
          <div className="pt-1 border-t border-border space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Proximos
            </p>
            {upcoming.map((exam) => {
              const d = new Date(exam.rawStartDate);
              const dayNum = d.getDate();
              const monthAbbr = MONTHS[d.getMonth()].slice(0, 3);
              return (
                <div key={exam.sessionId} className="flex items-center gap-2.5">
                  <div className="flex flex-col items-center w-8 shrink-0">
                    <span className="text-[10px] text-muted-foreground uppercase leading-none">
                      {monthAbbr}
                    </span>
                    <span className="text-sm font-bold text-foreground leading-tight">{dayNum}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{exam.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {exam.time} · {exam.level}
                    </p>
                  </div>
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot(exam.status)}`} />
                </div>
              );
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && exams.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="text-3xl">📅</span>
            <p className="text-xs text-muted-foreground">Sin exámenes programados</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamCalendar;
