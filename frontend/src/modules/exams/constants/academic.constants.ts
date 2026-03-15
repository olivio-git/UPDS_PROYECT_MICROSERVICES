// Constantes académicas compartidas entre frontend y backend

export const MCER_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export type MCERLevel = typeof MCER_LEVELS[number];

export const COMPETENCIES = [
  'reading', 
  'writing', 
  'listening', 
  'speaking', 
  'grammar', 
  'vocabulary'
] as const;
export type Competency = typeof COMPETENCIES[number];

export const COMPETENCY_LABELS: Record<Competency, string> = {
  reading: 'Comprensión Lectora',
  writing: 'Expresión Escrita', 
  listening: 'Comprensión Auditiva',
  speaking: 'Expresión Oral',
  grammar: 'Gramática',
  vocabulary: 'Vocabulario'
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
