export const COMPETENCY_SHORT: Record<string, string> = {
  reading: 'Lectura',
  writing: 'Escritura',
  listening: 'Escucha',
  speaking: 'Habla',
  grammar: 'Gramática',
  vocabulary: 'Vocabulario',
};

export const TYPE_LABEL: Record<string, string> = {
  essay: 'Ensayo',
  open_text: 'Respuesta abierta',
  audio_response: 'Respuesta oral',
  file_upload: 'Archivo',
};

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');

export function timeAgo(iso: string, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.round(hours / 24)} d`;
}

export const countWords = (text?: string) => (text?.trim() ? text.trim().split(/\s+/).length : 0);

export const itemKey = (i: { resultId: string; questionId: string }) => `${i.resultId}:${i.questionId}`;

/** Stable pseudonym for blind marking, derived from the result id. */
export const anonymousLabel = (resultId: string) => `Respuesta #${resultId.slice(-4).toUpperCase()}`;
