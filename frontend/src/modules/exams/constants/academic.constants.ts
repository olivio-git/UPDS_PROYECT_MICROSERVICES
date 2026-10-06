// Constantes académicas compartidas entre frontend y backend

export const MCER_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type MCERLevel = typeof MCER_LEVELS[number];

/**
 * MCER competencies: the four communicative skills plus the two linguistic
 * competences (grammatical and lexical) the framework describes separately.
 * Each one can be its own exam section and gets its own score in the result.
 */
export const COMPETENCIES = [
  'reading',
  'writing',
  'listening',
  'speaking',
  'grammar',
  'vocabulary',
] as const;
export type Competency = typeof COMPETENCIES[number];

/** Rubrics are only for productive/open skills; grammar and vocabulary are auto-graded. */
export const RUBRIC_COMPETENCIES = ['reading', 'writing', 'listening', 'speaking'] as const;

export const COMPETENCY_LABELS: Record<Competency, string> = {
  reading: 'Comprensión Lectora',
  writing: 'Expresión Escrita',
  listening: 'Comprensión Auditiva',
  speaking: 'Expresión Oral',
  grammar: 'Gramática',
  vocabulary: 'Vocabulario',
};

export const COMPETENCY_SHORT: Record<Competency, string> = {
  reading: 'Lectura',
  writing: 'Escritura',
  listening: 'Escucha',
  speaking: 'Habla',
  grammar: 'Gramática',
  vocabulary: 'Vocabulario',
};

/**
 * Default share of the final score: the four skills carry the exam, the
 * linguistic competences support them (20/20/20/20/10/10). Every exam can
 * change it per section.
 */
export const DEFAULT_COMPETENCY_WEIGHT: Record<Competency, number> = {
  reading: 20,
  writing: 20,
  listening: 20,
  speaking: 20,
  grammar: 10,
  vocabulary: 10,
};

export const MCER_LEVEL_DESCRIPTIONS: Record<MCERLevel, string> = {
  A1: 'Acceso - Usuario básico',
  A2: 'Plataforma - Usuario básico', 
  B1: 'Umbral - Usuario independiente',
  B2: 'Avanzado - Usuario independiente',
  C1: 'Dominio operativo eficaz - Usuario competente',
  C2: 'Maestría - Usuario competente'
};

export const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5] as const;
export type DifficultyLevel = typeof DIFFICULTY_LEVELS[number];

export const SCORING_TYPES = ['holistic', 'analytic'] as const;
export type ScoringType = typeof SCORING_TYPES[number];

export const SCORING_TYPE_LABELS: Record<ScoringType, string> = {
  holistic: 'Evaluación Holística',
  analytic: 'Evaluación Analítica'
};
