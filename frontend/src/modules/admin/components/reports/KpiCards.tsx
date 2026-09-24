import { Card } from '@/components/atoms/card';
import type { DashboardSummary, StudentStats } from '@/services/reportsService';
import { Award, Clock, FileText, Target, Users, type LucideIcon } from 'lucide-react';
import { PERFORMANCE_BANDS } from './scoring';

interface Kpi {
  label: string;
  value: string | number;
  sub: string;
  icon: LucideIcon;
  color: string;
  tooltip: string;
}

function buildKpis(summary: DashboardSummary, stats: StudentStats | undefined): Kpi[] {
  const dist = summary.performanceDistribution;
  const graded = (dist.excellent ?? 0) + (dist.good ?? 0) + (dist.acceptable ?? 0) + (dist.needsImprovement ?? 0);
  const high = (dist.excellent ?? 0) + (dist.good ?? 0);
  const highRate = graded > 0 ? Math.round((high / graded) * 100) : 0;
  const avgMinutes = stats?.timeAnalysis?.averageDuration ?? null;

  return [
    {
      label: 'Estudiantes', value: summary.overview.totalStudents, sub: `${graded} evaluados`,
      icon: Users, color: 'text-blue-400',
      tooltip: 'Total de estudiantes registrados en el sistema. Entre paréntesis, los que han completado al menos un examen.',
    },
    {
      label: 'Promedio', value: summary.overview.averageScore.toFixed(1), sub: 'sobre 100',
      icon: Award, color: 'text-amber-400',
      tooltip: 'Promedio general de todos los exámenes completados, expresado sobre 100 puntos.',
    },
    {
      label: 'Evaluaciones', value: summary.overview.totalExams, sub: 'completadas',
      icon: FileText, color: 'text-emerald-400',
      tooltip: 'Cantidad total de exámenes completados y calificados en el período seleccionado.',
    },
    {
      label: 'Rend. alto',
      value: graded > 0 ? `${highRate}%` : '—',
      sub: graded > 0 ? `${high} de ${graded} (excelente/bueno)` : 'sin datos',
      icon: Target,
      color: highRate >= 60 ? 'text-emerald-400' : highRate >= 30 ? 'text-amber-400' : 'text-red-400',
      tooltip: `Porcentaje de exámenes con resultado Excelente (≥${PERFORMANCE_BANDS.excellent}%) o Bueno (${PERFORMANCE_BANDS.good}–${PERFORMANCE_BANDS.excellent - 1}%). Indica qué proporción del total tuvo buen desempeño.`,
    },
    {
      label: 'Tiempo prom.',
      value: avgMinutes !== null && avgMinutes > 0 ? `${avgMinutes} min` : '—',
      sub: 'por evaluación', icon: Clock, color: 'text-indigo-400',
      tooltip: 'Tiempo promedio que los estudiantes tardan en completar un examen, en minutos.',
    },
  ];
}

export function KpiCards({ summary, stats }: { summary: DashboardSummary; stats?: StudentStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      {buildKpis(summary, stats).map(({ label, value, sub, icon: Icon, color, tooltip }) => (
        <Card key={label} title={tooltip} className="rounded-none border border-border bg-card shadow-none cursor-default">
          <div className="p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
              <p className={`text-xs ${color}`}>{sub}</p>
            </div>
            <Icon className={`h-6 w-6 ${color} opacity-60`} />
          </div>
        </Card>
      ))}
    </div>
  );
}
