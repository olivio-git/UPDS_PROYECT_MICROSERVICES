import { Card } from '@/components/atoms/card';
import type { CompetencyAnalysis, DashboardSummary } from '@/services/reportsService';
import { COMPETENCY_LABELS } from './constants';

interface InsightsCardProps {
  summary: DashboardSummary;
  competency: CompetencyAnalysis | undefined;
}

/** Improvement areas (competencies below 70%) next to the generated recommendations. */
export function InsightsCard({ summary, competency }: InsightsCardProps) {
  // Only areas backed by real data: the backend can list a competency nobody was evaluated on.
  const areas = summary.improvementAreas
    .map((area) => ({ area, data: competency?.competencyBreakdown?.[area] }))
    .filter(({ data }) => (data?.studentsEvaluated ?? 0) > 0);

  return (
    <Card className="bg-card border-border shadow-none">
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <section>
          <p
            title="Competencias donde el promedio general está por debajo del 70%. Son las áreas donde el instituto debe reforzar más."
            className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1.5 cursor-default"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
            Áreas de Mejora
            {competency && <span className="ml-auto text-[10px] text-muted-foreground font-normal">puntaje &lt;70%</span>}
          </p>
          <div className="space-y-1.5">
            {areas.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sin áreas críticas identificadas</p>
            ) : (
              areas.map(({ area, data }) => (
                <div key={area} className="flex items-center gap-1.5 p-1.5 rounded border border-red-500/20 bg-red-500/5">
                  <span className="text-red-500 text-xs shrink-0">↓</span>
                  <span className="text-xs text-foreground/80 flex-1">{COMPETENCY_LABELS[area] ?? area}</span>
                  {data && <span className="text-[10px] text-red-400 font-medium">{data.averageScore.toFixed(1)}%</span>}
                </div>
              ))
            )}
          </div>
        </section>

        <section>
          <p
            title="Sugerencias generadas automáticamente basadas en los resultados del período. Ayudan a identificar acciones concretas para mejorar el rendimiento."
            className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-1.5 cursor-default"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
            Recomendaciones
          </p>
          <div className="space-y-1.5">
            {summary.recommendations.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sin recomendaciones</p>
            ) : (
              summary.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-1.5 p-1.5 rounded border border-blue-500/20 bg-blue-500/5">
                  <span className="text-blue-400 text-xs font-bold mt-0.5 shrink-0">{i + 1}.</span>
                  <span className="text-xs text-foreground/80 leading-snug">{rec}</span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </Card>
  );
}
