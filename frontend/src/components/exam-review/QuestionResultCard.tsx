import { competencyBadgeClass } from '@/lib/competency';
import { scoreBadgeClass, scoreBarClass } from '@/lib/scoreBands';
import { cn } from '@/lib/utils';
import { CheckCircle, X } from 'lucide-react';
import { QuestionMedia } from './QuestionMedia';
import { QuestionResponseView } from './QuestionResponseView';
import type { EvaluationMethod, ReviewQuestionResult } from './types';

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: 'Opción múltiple',
  single_choice: 'Opción única',
  true_false: 'V/F',
  fill_blanks: 'Completar',
  fill_blank: 'Completar',
  matching: 'Emparejar',
  ordering: 'Ordenar',
  drag_drop: 'Arrastrar',
  essay: 'Ensayo',
  open_text: 'Texto',
  audio_response: 'Audio',
  speaking: 'Speaking',
  file_upload: 'Archivo',
};

const METHOD: Record<EvaluationMethod, { label: string; className: string }> = {
  automatic: { label: 'Automática', className: 'bg-muted/60 text-muted-foreground border-border/40' },
  ai_grading: { label: 'IA', className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/40' },
  manual: { label: 'Manual', className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700/40' },
};

interface QuestionResultCardProps {
  index: number;
  result: ReviewQuestionResult;
  /** Show how the answer was graded (automatic / AI / manual). */
  showEvaluationMethod?: boolean;
}

/** One graded question: header with score, the question as presented, the answer, and feedback. */
export function QuestionResultCard({ index, result, showEvaluationMethod = false }: QuestionResultCardProps) {
  const data = result.questionData;
  const type = result.questionType ?? data?.questionType;
  const competency = result.competency ?? data?.competency;
  const percentage = result.maxScore > 0 ? (result.score / result.maxScore) * 100 : 0;
  const method = showEvaluationMethod && result.evaluationMethod ? METHOD[result.evaluationMethod] : undefined;
  const ai = result.aiAnalysis;
  const criteria = Object.entries(ai?.criteria ?? {});
  const suggestions = ai?.suggestions ?? [];

  return (
    <article className="bg-muted/30 border border-border rounded-xl overflow-hidden">
      <header className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/50">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className="bg-muted text-foreground px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0">#{index + 1}</span>
          {type && <span className="text-xs text-foreground/80 font-medium">{TYPE_LABEL[type] ?? type.replace(/_/g, ' ')}</span>}
          {competency && (
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-xs capitalize', competencyBadgeClass(competency))}>
              {competency}
            </span>
          )}
          {method && (
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded border text-xs', method.className)}>{method.label}</span>
          )}
          {result.isCorrect === true && <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-label="Correcta" />}
          {result.isCorrect === false && <X className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" aria-label="Incorrecta" />}
        </div>
        <span className={cn('inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border shrink-0', scoreBadgeClass(percentage))}>
          {result.score}/{result.maxScore}
        </span>
      </header>

      <div className="px-4 py-3 space-y-3">
        {data?.context && (
          <div className="bg-card border border-border rounded-lg px-3 py-2">
            <p className="text-xs text-muted-foreground italic leading-relaxed">{data.context}</p>
          </div>
        )}
        {data?.instructions && <p className="text-xs text-muted-foreground">{data.instructions}</p>}
        {data?.questionText && <p className="text-sm text-foreground font-medium leading-snug">{data.questionText}</p>}
        <QuestionMedia data={data} />

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Respuesta del candidato</p>
          <QuestionResponseView questionType={type} response={result.response} questionData={data} />
        </div>

        <div className="h-1 w-full rounded-full bg-muted overflow-hidden" aria-hidden>
          <div className={cn('h-full rounded-full transition-all', scoreBarClass(percentage))} style={{ width: `${Math.min(percentage, 100)}%` }} />
        </div>

        {result.feedback && (
          <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-700/30 rounded-lg px-3 py-2.5">
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-0.5">Retroalimentación</p>
            <p className="text-xs text-blue-600 dark:text-blue-200 leading-relaxed">{result.feedback}</p>
          </div>
        )}

        {ai && (ai.feedback || suggestions.length > 0) && (
          <div className="bg-purple-50 border border-purple-200 dark:bg-purple-900/20 dark:border-purple-700/30 rounded-lg px-3 py-2.5 space-y-2">
            <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">Análisis IA</p>
            {ai.feedback && <p className="text-xs text-purple-600 dark:text-purple-200 leading-relaxed">{ai.feedback}</p>}
            {criteria.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {criteria.map(([key, value]) => (
                  <span key={key} className="text-xs text-purple-700 dark:text-purple-300">
                    <span className="capitalize text-purple-500 dark:text-purple-400">{key}:</span>{' '}
                    <span className="font-medium">{typeof value === 'number' ? value.toFixed(1) : String(value)}</span>
                  </span>
                ))}
              </div>
            )}
            {suggestions.length > 0 && (
              <ul className="space-y-0.5 text-xs text-purple-600 dark:text-purple-200 list-disc list-inside">
                {suggestions.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
