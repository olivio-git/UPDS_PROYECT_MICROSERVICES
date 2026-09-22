/** Accent colors per MCER competency, for badges and progress bars. */

const BADGE: Record<string, string> = {
  reading: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40',
  writing: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700/40',
  listening: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700/40',
  speaking: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/40',
};

const BAR: Record<string, string> = {
  reading: 'bg-blue-500',
  writing: 'bg-purple-500',
  listening: 'bg-orange-500',
  speaking: 'bg-green-500',
};

export const competencyBadgeClass = (competency: string) =>
  BADGE[competency.toLowerCase()] ?? 'bg-muted text-muted-foreground border-border';

export const competencyBarClass = (competency: string) =>
  BAR[competency.toLowerCase()] ?? 'bg-muted-foreground';
