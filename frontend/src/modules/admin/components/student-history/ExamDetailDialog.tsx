import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/atoms/dialog';
import { QuestionResultCard, useAdminResultDetail } from '@/components/exam-review';
import { scoreBadgeClass, scoreBarClass, scoreTextClass } from '@/lib/scoreBands';
import { cn } from '@/lib/utils';
import { Award, BookOpen, Calendar, Clock, Loader2, Target } from 'lucide-react';
import type { ExamEntry } from './ExamHistoryTable';
import { formatDateTime, formatGradingTime, formatMinutes } from './format';

function MetaStats({ exam }: { exam: ExamEntry }) {
  const stats = [
    { label: 'Nivel', value: exam.level, icon: Target },
    { label: 'Tiempo', value: formatMinutes(exam.timeSpent), icon: Clock },
    { label: 'Puntos', value: `${exam.finalScore} / ${exam.maxScore}`, icon: Award },
    { label: 'Fecha', value: formatDateTime(exam.completedAt), icon: Calendar },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {stats.map(({ label, value, icon: Icon }) => (
        <div key={label} className="bg-muted/40 rounded-lg px-3 py-2 flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground leading-none">{label}</p>
            <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CompetencyBars({ scores }: { scores: ExamEntry['competencyScores'] }) {
  if (scores.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-foreground">Competencias</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {scores.map((cs) => (
          <div key={cs.competency} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="capitalize text-muted-foreground">{cs.competency.replace('_', ' ')}</span>
              <span className={cn('font-semibold', scoreTextClass(cs.percentage))}>{cs.percentage.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', scoreBarClass(cs.percentage))} style={{ width: `${Math.min(cs.percentage, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExamDetailBody({ exam }: { exam: ExamEntry }) {
  const detail = useAdminResultDetail(exam.resultId);
  const questions = detail.data?.questionResults ?? [];
  const gradingMs = detail.data?.gradingDurationMs ?? exam.gradingDurationMs;

  return (
    <div className="overflow-y-auto flex-1 p-5 space-y-4">
      <MetaStats exam={exam} />

      {gradingMs != null && (
        <div className="rounded-lg border border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10 px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">Tiempo de corrección</p>
          <span className="text-lg font-bold text-violet-700 dark:text-violet-300 shrink-0 tabular-nums">{formatGradingTime(gradingMs)}</span>
        </div>
      )}

      <CompetencyBars scores={exam.competencyScores} />

      {exam.feedback && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/15 dark:border-blue-800/30 p-3 space-y-1">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Retroalimentación general</p>
          <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">{exam.feedback}</p>
        </div>
      )}

      {detail.isLoading ? (
        <div className="flex items-center justify-center py-6 gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
          <span className="text-xs text-muted-foreground">Cargando preguntas...</span>
        </div>
      ) : detail.isError ? (
        <p className="text-xs text-red-600 dark:text-red-400 text-center py-4">No se pudo cargar el detalle de las preguntas</p>
      ) : (
        questions.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
              Preguntas
              <span className="text-muted-foreground font-normal">({questions.length})</span>
            </p>
            {questions.map((qr, index) => (
              <QuestionResultCard key={qr.questionId ?? index} index={index} result={qr} />
            ))}
          </div>
        )
      )}
    </div>
  );
}

interface ExamDetailDialogProps {
  exam: ExamEntry | null;
  onClose: () => void;
}

export function ExamDetailDialog({ exam, onClose }: ExamDetailDialogProps) {
  return (
    <Dialog open={exam !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden rounded-xl">
        {exam && (
          <>
            <div className="flex items-start justify-between gap-3 px-5 py-4 pr-12 border-b border-border shrink-0">
              <div className="min-w-0">
                <DialogTitle className="text-sm font-semibold text-foreground truncate">{exam.examTitle}</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">{exam.sessionName}</DialogDescription>
              </div>
              <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold border shrink-0', scoreBadgeClass(exam.percentage))}>
                {exam.percentage.toFixed(1)}%
              </span>
            </div>
            <ExamDetailBody exam={exam} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
