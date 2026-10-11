import type { StudentHistoryData } from '@/services/reportsService';
import { Award, BookOpen, Star } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';

export function HistorySummary({ summary }: { summary: StudentHistoryData['summary'] }) {
  const tiles = [
    {
      label: 'Exámenes', value: summary.totalExams, icon: BookOpen,
      fg: 'text-blue-600 dark:text-blue-400',
      tooltip: 'Cantidad total de exámenes completados por el alumno',
    },
    {
      label: 'Promedio', value: `${summary.averageScore.toFixed(1)}%`, icon: Award,
      fg: 'text-emerald-600 dark:text-emerald-400',
      tooltip: 'Promedio de todos los porcentajes obtenidos en los exámenes',
    },
    {
      label: 'Mejor nota', value: `${summary.bestScore.toFixed(1)}%`, icon: Star,
      fg: 'text-amber-600 dark:text-amber-400',
      tooltip: 'El porcentaje más alto obtenido en cualquier examen',
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {tiles.map(({ label, value, icon, fg, tooltip }) => (
        <StatCard key={label} title={tooltip} label={label} value={value} icon={icon} iconClassName={fg} />
      ))}
    </div>
  );
}
