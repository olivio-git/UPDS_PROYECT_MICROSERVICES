import { CheckCircle } from 'lucide-react';
import { Panel } from './Panel';

export function HistoryRecommendations({ recommendations }: { recommendations: string[] }) {
  if (recommendations.length === 0) return null;
  return (
    <Panel icon={CheckCircle} title="Recomendaciones">
      <div className="p-3 space-y-1.5">
        {recommendations.map((rec, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-2">
            <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="text-xs text-foreground">{rec}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
