import { scoreBadgeClass } from '@/lib/scoreBands';
import { cn } from '@/lib/utils';
import { CheckCircle, MessageSquare, X } from 'lucide-react';
import { QuestionResponseView } from './QuestionResponseView';
import type { EvaluationMethod, ReviewQuestionResult } from './types';

const METHOD_LABEL: Record<EvaluationMethod, string> = {
  automatic: 'Automática',
  ai_grading: 'IA',
  manual: 'Manual',
};

interface QuestionResultCardProps {
  index: number;
  result: ReviewQuestionResult;
  /** Show how the answer was graded (automatic / AI / manual). */
  showEvaluationMethod?: boolean;
}

/** One graded question: header with score, question text, the answer, and any feedback. */
export function QuestionResultCard({ index, result, showEvaluationMethod = false }: QuestionResultCardProps) {
  const data = result.questionData;
  const type = result.questionType ?? data?.questionType;
  const competency = result.competency ?? data?.competency;
  const percentage = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;
  const suggestions = result.aiAnalysis?.suggestions ?? [];

  return (
    <article className="rounded-lg border border-border overflow-hidden">
      <header className="flex items-start justify-between gap-2 px-3 py-2 bg-muted/30 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-muted-foreground shrink-0">#{index + 1}</span>
          {type && (
            <span className="text-xs bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded-full shrink-0">
              {type.replace(/_/g, ' ')}
            </span>
          )}
          {competency && <span className="text-xs text-muted-foreground capitalize truncate">{competency}</span>}
          {showEvaluationMethod && result.evaluationMethod && (
            <span className="text-[10px] text-muted-foreground shrink-0">· {METHOD_LABEL[result.evaluationMethod]}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border', scoreBadgeClass(percentage))}>
            {result.score}/{result.maxScore}
          </span>
          {result.isCorrect === true && <CheckCircle className="h-3.5 w-3.5 text-emerald-500" aria-label="Correcta" />}
          {result.isCorrect === false && <X className="h-3.5 w-3.5 text-red-500" aria-label="Incorrecta" />}
        </div>
      </header>

      <div className="px-3 py-2.5 space-y-2">
        {data?.questionText && <p className="text-xs text-foreground leading-relaxed">{data.questionText}</p>}

        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground font-medium">Respuesta del estudiante</p>
          <QuestionResponseView questionType={type} response={result.response} questionData={data} />
        </div>

        {result.feedback && (
          <div className="rounded bg-blue-50 border border-blue-200 dark:bg-blue-900/15 dark:border-blue-800/30 px-2.5 py-1.5">
            <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-1.5">
              <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
              {result.feedback}
            </p>
          </div>
        )}

        {result.aiAnalysis?.feedback && (
          <div className="rounded bg-purple-50 border border-purple-200 dark:bg-purple-900/15 dark:border-purple-800/30 px-2.5 py-2 space-y-1.5">
            <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">Análisis</p>
            <p className="text-xs text-purple-600 dark:text-purple-400 leading-relaxed">{result.aiAnalysis.feedback}</p>
            {suggestions.length > 0 && (
              <ul className="space-y-0.5">
                {suggestions.map((s, i) => (
                  <li key={i} className="text-xs text-purple-600 dark:text-purple-400 flex items-start gap-1">
                    <span className="shrink-0 mt-0.5">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
