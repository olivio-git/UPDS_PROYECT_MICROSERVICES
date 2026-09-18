import type { SessionResultRow } from '@/services/examResultService';

const TIME_ZONE = 'America/La_Paz';

export const formatDateLong = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE,
  });

export const formatDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE,
  });

export function formatSessionDuration(startIso: string, endIso: string) {
  const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}min` : `${minutes} minutos`;
}


const NEUTRAL_BADGE = 'bg-muted text-muted-foreground border-border';
const BLUE_BADGE = 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40';
const PURPLE_BADGE = 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700/40';

const EXAM_TYPE_BADGE: Record<string, string> = {
  placement: PURPLE_BADGE,
  progress: BLUE_BADGE,
  final: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700/40',
  practice: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700/40',
};

const LEVEL_BADGE: Record<string, string> = {
  A1: NEUTRAL_BADGE, A2: NEUTRAL_BADGE, B1: BLUE_BADGE, B2: BLUE_BADGE, C1: PURPLE_BADGE, C2: PURPLE_BADGE,
};

export const examTypeBadgeClass = (type: string) => EXAM_TYPE_BADGE[type] ?? NEUTRAL_BADGE;
export const levelBadgeClass = (level: string) => LEVEL_BADGE[level] ?? NEUTRAL_BADGE;

const RESULT_STATUS: Record<SessionResultRow['status'], { label: string; className: string }> = {
  completed: {
    label: 'Completado',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40',
  },
  partial: {
    label: 'Parcial',
    className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700/40',
  },
  pending_ai_review: {
    label: 'Revisión IA',
    className: 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700/40',
  },
};

export const resultStatusPill = (status: SessionResultRow['status']) => RESULT_STATUS[status] ?? RESULT_STATUS.completed;

/** Name for a candidate id, or a short id when the name could not be resolved. */
export const candidateLabel = (candidateId: string, names: Record<string, string> | undefined) =>
  names?.[candidateId] ?? `...${candidateId.slice(-8)}`;

/**
 * ExamSession.createdBy is typed as a string id, but the API sometimes
 * populates it with the user document.
 */
export function creatorName(createdBy: unknown): string {
  if (createdBy && typeof createdBy === 'object') {
    const { firstName, lastName } = createdBy as { firstName?: string; lastName?: string };
    return `${firstName ?? ''} ${lastName ?? ''}`.trim();
  }
  return typeof createdBy === 'string' ? createdBy : '';
}
