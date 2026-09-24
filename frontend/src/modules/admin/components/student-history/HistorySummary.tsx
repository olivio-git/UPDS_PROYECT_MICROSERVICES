import type { StudentHistoryData } from '@/services/reportsService';
import { Award, BookOpen, Star } from 'lucide-react';

export function HistorySummary({ summary }: { summary: StudentHistoryData['summary'] }) {
  const tiles = [
    {
      label: 'Exámenes', value: summary.totalExams, icon: BookOpen,
      bg: 'bg-blue-100 dark:bg-blue-900/30', fg: 'text-blue-600 dark:text-blue-400',
      tooltip: 'Cantidad total de exámenes completados por el alumno',
    },
    {
      label: 'Promedio', value: `${summary.averageScore.toFixed(1)}%`, icon: Award,
      bg: 'bg-emerald-100 dark:bg-emerald-900/30', fg: 'text-emerald-600 dark:text-emerald-400',
      tooltip: 'Promedio de todos los porcentajes obtenidos en los exámenes',
    },
    {
      label: 'Mejor nota', value: `${summary.bestScore.toFixed(1)}%`, icon: Star,
      bg: 'bg-amber-100 dark:bg-amber-900/30', fg: 'text-amber-600 dark:text-amber-400',
      tooltip: 'El porcentaje más alto obtenido en cualquier examen',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map(({ label, value, icon: Icon, bg, fg, tooltip }) => (
        <div key={label} title={tooltip} className="bg-card border border-border p-3 flex items-center gap-2.5 cursor-default">
          <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
            <Icon className={`h-4 w-4 ${fg}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground leading-none">{label}</p>
            <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
