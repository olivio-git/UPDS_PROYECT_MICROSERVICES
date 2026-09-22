/**
 * How each exam session status is labeled and colored, everywhere in the app.
 * Screens used to define their own maps, so the same running session was green
 * on the detail page and amber on the calendar.
 */
export interface SessionStatusStyle {
  label: string;
  /** Pill: background, text and border. Pair with `border`. */
  badge: string;
  /** Small solid dot. */
  dot: string;
}

const SCHEDULED: SessionStatusStyle = {
  label: 'Programada',
  badge: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/30',
  dot: 'bg-blue-500',
};

const STATUS: Record<string, SessionStatusStyle> = {
  scheduled: SCHEDULED,
  in_progress: {
    label: 'En progreso',
    badge: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/30',
    dot: 'bg-green-500',
  },
  completed: {
    label: 'Completada',
    badge: 'bg-muted text-muted-foreground border-border',
    dot: 'bg-muted-foreground',
  },
  cancelled: {
    label: 'Cancelada',
    badge: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/30',
    dot: 'bg-red-500',
  },
  // Not in the ExamSession status union, but the API can return it.
  expired: {
    label: 'Expirada',
    badge: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800/30',
    dot: 'bg-orange-500',
  },
};

/** Style for a status; unknown values fall back to "scheduled". */
export const sessionStatus = (status: string): SessionStatusStyle => STATUS[status] ?? SCHEDULED;

/** Statuses shown in legends, in display order. */
export const SESSION_STATUS_LEGEND = ['scheduled', 'in_progress', 'completed', 'cancelled'] as const;
