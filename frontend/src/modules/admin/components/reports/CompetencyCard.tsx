import type { CompetencyAnalysis, DashboardSummary } from '@/services/reportsService';
import { Brain } from 'lucide-react';
import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CHART_AXIS_TICK, CHART_CURSOR, CHART_TOOLTIP_STYLE, COMPETENCY_LABELS } from './constants';
import { ReportCard } from './ReportCard';
import { competencyChipClass, difficultyBadge, masteryBadge, MASTERY_BANDS, scoreTextClass } from './scoring';
import { ViewToggle, type ViewMode } from './ViewToggle';

interface CompetencyRow {
  competency: string;
  averageScore: number;
  studentsEvaluated: number;
}

/** Prefer the detailed breakdown; fall back to the dashboard ranking while it loads. */
function toRows(summary: DashboardSummary, competency: CompetencyAnalysis | undefined): CompetencyRow[] {
  if (competency) {
    return Object.entries(competency.competencyBreakdown).map(([name, data]) => ({
      competency: name,
      averageScore: data.averageScore ?? 0,
      studentsEvaluated: data.studentsEvaluated ?? 0,
    }));
  }
  return summary.competencyRanking.map((c) => ({
    competency: c.competency,
    averageScore: c.averageScore ?? 0,
    studentsEvaluated: c.studentsEvaluated ?? 0,
  }));
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function CompetencyChips({ competency }: { competency: CompetencyAnalysis }) {
  const evaluated = Object.entries(competency.competencyBreakdown)
    .filter(([, d]) => d.studentsEvaluated > 0)
    .sort(([, a], [, b]) => b.averageScore - a.averageScore);

  return (
    <div className="flex gap-1.5 mt-1.5 flex-wrap">
      {evaluated.map(([name, d]) => (
        <span key={name} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${competencyChipClass(d.averageScore)}`}>
          {COMPETENCY_LABELS[name] ?? name} {d.averageScore.toFixed(0)}%
        </span>
      ))}
    </div>
  );
}

function CompetencyChart({ ranking }: { ranking: DashboardSummary['competencyRanking'] }) {
  return (
    <>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={ranking.map((c) => ({ name: capitalize(c.competency), promedio: c.averageScore }))}
          margin={{ top: 4, right: 4, bottom: 4, left: -24 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="name" tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_CURSOR}
            formatter={(v: number) => [`${v.toFixed(1)}`, 'Promedio']} />
          <Bar dataKey="promedio" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-1.5 mt-2">
        {ranking.map((c) => {
          const difficulty = difficultyBadge(c.difficulty);
          return (
            <div key={c.competency} className="flex items-center justify-between px-2 py-1 rounded bg-muted/40 border border-border">
              <span className="text-xs text-foreground/80 capitalize">{c.competency.replace('_', ' ')}</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] px-1 rounded ${difficulty.className}`}>{difficulty.label}</span>
                <span className={`text-xs font-medium ${scoreTextClass(c.averageScore)}`}>{c.averageScore.toFixed(1)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function CompetencyTable({ rows }: { rows: CompetencyRow[] }) {
  return (
    <div className="overflow-auto max-h-[300px]">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b border-border">
            <th className="text-left py-1.5 text-muted-foreground font-medium">Competencia</th>
            <th className="text-right py-1.5 text-muted-foreground font-medium">Promedio</th>
            <th
              title={`Nivel de dominio basado en el promedio: Alto ≥${MASTERY_BANDS.high}%, Medio ${MASTERY_BANDS.medium}–${MASTERY_BANDS.high - 1}%, Bajo <${MASTERY_BANDS.medium}%`}
              className="text-right py-1.5 text-muted-foreground font-medium cursor-default"
            >
              Dominio
            </th>
            <th className="text-right py-1.5 text-muted-foreground font-medium">Evaluados</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ competency, averageScore, studentsEvaluated }) => {
            const hasData = studentsEvaluated > 0;
            const mastery = masteryBadge(averageScore);
            return (
              <tr key={competency} className={`border-b border-border/50 ${hasData ? '' : 'opacity-40'}`}>
                <td className="py-1.5 text-foreground font-medium">
                  {COMPETENCY_LABELS[competency] ?? competency}
                  {!hasData && <span className="ml-1.5 text-[10px] text-muted-foreground">(sin datos)</span>}
                </td>
                <td className="py-1.5 text-right">
                  {hasData
                    ? <span className={`font-medium ${scoreTextClass(averageScore)}`}>{averageScore.toFixed(1)}</span>
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="py-1.5 text-right">
                  {hasData
                    ? <span className={`text-[10px] px-1.5 py-0.5 rounded ${mastery.className}`}>{mastery.label}</span>
                    : <span className="text-muted-foreground">—</span>}
                </td>
                <td className="py-1.5 text-right text-muted-foreground">{hasData ? studentsEvaluated : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface CompetencyCardProps {
  summary: DashboardSummary;
  competency: CompetencyAnalysis | undefined;
}

export function CompetencyCard({ summary, competency }: CompetencyCardProps) {
  const [view, setView] = useState<ViewMode>('table');

  return (
    <ReportCard
      icon={Brain}
      title="Promedio por Competencia"
      actions={<ViewToggle view={view} onChange={setView} />}
      subheader={competency?.competencyBreakdown && <CompetencyChips competency={competency} />}
    >
      {view === 'chart'
        ? <CompetencyChart ranking={summary.competencyRanking} />
        : <CompetencyTable rows={toRows(summary, competency)} />}
    </ReportCard>
  );
}
