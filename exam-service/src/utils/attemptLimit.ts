/**
 * How many times a candidate may take the same exam (exam.configuration.attemptsAllowed).
 * Finished attempts in other sessions count; an attempt a proctor cancelled
 * does not (the student was removed, not assessed). A missing or non-positive
 * limit means no limit, so older exams without the field keep working.
 */
export const COUNTED_ATTEMPT_STATUSES = ['completed', 'expired'] as const;

export function attemptLimitError(attemptsAllowed: unknown, used: number): string | null {
  if (typeof attemptsAllowed !== 'number' || !Number.isFinite(attemptsAllowed) || attemptsAllowed <= 0) return null;
  if (used < attemptsAllowed) return null;
  return attemptsAllowed === 1
    ? 'Ya rendiste este examen. Solo se permite un intento.'
    : `Ya usaste los ${attemptsAllowed} intentos permitidos para este examen.`;
}

/**
 * How many times each listening recording may be played (exam.configuration.listeningPlays).
 * Two by default, as in Cambridge English listening papers; 0 means unlimited.
 */
export const DEFAULT_LISTENING_PLAYS = 2;
export function listeningPlaysOf(exam: any): number {
  const v = exam?.configuration?.listeningPlays;
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : DEFAULT_LISTENING_PLAYS;
}

/** An answer counts as given when it holds more than the listening play counter. */
export function hasAnswerContent(answer: unknown): boolean {
  if (!answer || typeof answer !== 'object') return Boolean(answer);
  return Object.keys(answer).some((k) => k !== 'audioPlays');
}
