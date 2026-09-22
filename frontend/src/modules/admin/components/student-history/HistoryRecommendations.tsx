import { CheckCircle } from 'lucide-react';
import { Panel } from './Panel';

export function HistoryRecommendations({ recommendations }: { recommendations: string[] }) {
  if (recommendations.length === 0) return null;
  return (
    <Panel icon={CheckCircle} title="Recomendaciones">
      <div className="p-3 space-y-1.5">
        {recommendations.map((rec, i) => (
          <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/15 dark:border-blue-800/30">
            <CheckCircle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
            <span className="text-xs text-blue-700 dark:text-blue-300">{rec}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
