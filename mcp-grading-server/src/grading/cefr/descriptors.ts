/**
 * CEFR "Overall written production" and "Overall oral production" scales
 * (Council of Europe, CEFR 2001 / Companion Volume 2020), quoted so that AI
 * grading judges a text against what the target level actually asks for.
 */
const WRITTEN: Record<string, string> = {
  A1: 'Can write simple isolated phrases and sentences.',
  A2: 'Can write a series of simple phrases and sentences linked with simple connectors like "and", "but" and "because".',
  B1: 'Can write straightforward connected texts on a range of familiar subjects within their field of interest, by linking a series of shorter discrete elements into a linear sequence.',
  B2: 'Can write clear, detailed texts on a variety of subjects related to their field of interest, synthesising and evaluating information and arguments from a number of sources.',
  C1: 'Can write clear, well-structured texts of complex subjects, underlining the relevant salient issues, expanding and supporting points of view at some length with subsidiary points, reasons and relevant examples, and rounding off with an appropriate conclusion.',
  C2: 'Can write clear, smoothly flowing, complex texts in an appropriate and effective style and a logical structure which helps the reader to find significant points.',
};

const ORAL: Record<string, string> = {
  A1: 'Can produce simple mainly isolated phrases about people and places.',
  A2: 'Can give a simple description or presentation of people, living or working conditions, daily routines, likes/dislikes, etc. as a short series of simple phrases and sentences linked into a list.',
  B1: 'Can reasonably fluently sustain a straightforward description of one of a variety of subjects within their field of interest, presenting it as a linear sequence of points.',
  B2: 'Can give clear, systematically developed descriptions and presentations, with appropriate highlighting of significant points, and relevant supporting detail.',
  C1: 'Can give clear, detailed descriptions and presentations on complex subjects, integrating sub-themes, developing particular points and rounding off with an appropriate conclusion.',
  C2: 'Can produce clear, smoothly flowing, well-structured speech with an effective logical structure which helps the recipient to notice and remember significant points.',
};

const ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Prompt lines with the descriptor of the target level and of the level below,
 * plus how to map them onto 0–100, so "a la altura del nivel" means the same in
 * every grading call.
 */
export function levelExpectationLines(level: string, competency: string): string[] {
  const scale = competency === 'speaking' ? ORAL : WRITTEN;
  const target = scale[level];
  if (!target) return [];
  const below = ORDER[ORDER.indexOf(level) - 1];
  const kind = competency === 'speaking' ? 'produccion oral' : 'produccion escrita';
  const lines = [`\nLo que pide el nivel ${level} (MCER, ${kind} global): "${target}"`];
  if (below && scale[below]) lines.push(`Nivel inferior (${below}): "${scale[below]}"`);
  lines.push(
    `Calibracion: una respuesta que cumple plenamente el descriptor ${level} merece 80-100; ` +
      `una que lo cumple en parte, 60-79; una que solo alcanza ${below ?? 'un nivel inferior'}, 30-59; ` +
      'una que no responde a la tarea o es ininteligible, 0-29.',
  );
  return lines;
}
