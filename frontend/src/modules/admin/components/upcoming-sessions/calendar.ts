import type { UpcomingSessionsData } from '@/services/reportsService';

export type UpcomingSession = UpcomingSessionsData['upcomingSessions'][number];

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const pad = (n: number) => String(n).padStart(2, '0');

/** "YYYY-MM-DD" of a date in the browser's local time. */
export const localDayKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const dayKey = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;

/** A "YYYY-MM-DD" key as a Date at local noon, so no timezone shift can change the day. */
export const dateFromDayKey = (key: string) => new Date(`${key}T12:00`);

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });

export const formatDayLong = (date: Date) =>
  date.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' });

export const byStartDate = (a: UpcomingSession, b: UpcomingSession) =>
  new Date(a.startDate).getTime() - new Date(b.startDate).getTime();

export function groupByDay(sessions: UpcomingSession[]): Record<string, UpcomingSession[]> {
  const groups: Record<string, UpcomingSession[]> = {};
  for (const session of sessions) {
    const key = localDayKey(new Date(session.startDate));
    (groups[key] ??= []).push(session);
  }
  return groups;
}

/** Keys for today and the following `count - 1` days. */
export function nextDayKeys(count: number, from = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    return localDayKey(d);
  });
}

/** Month layout with weeks starting on Monday. */
export function monthLayout(viewDate: Date) {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  return {
    year,
    month,
    daysInMonth: new Date(year, month + 1, 0).getDate(),
    leadingBlanks: (new Date(year, month, 1).getDay() + 6) % 7,
  };
}

/** A running session opens the live monitor; any other opens its detail. */
export const sessionPath = (session: UpcomingSession) =>
  session.status === 'in_progress'
    ? `/sessions/${session.sessionId}/monitor`
    : `/sessions?sessionId=${session.sessionId}`;

export const capacityPercent = (session: UpcomingSession) =>
  session.maxCandidates > 0 ? Math.min(100, Math.round((session.registeredCandidates / session.maxCandidates) * 100)) : 0;
