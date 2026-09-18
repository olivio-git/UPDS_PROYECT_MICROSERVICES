/** CEFR/MCER levels in ascending order. */
export const MCER_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export type McerLevel = (typeof MCER_LEVELS)[number];
