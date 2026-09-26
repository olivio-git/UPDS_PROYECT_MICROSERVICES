import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/atoms/dialog';
import { CompetencyMasteryPanel, QuestionResultCard, useAdminResultDetail, type ReviewCompetencyScore } from '@/components/exam-review';
import { competencyBarClass } from '@/lib/competency';
import { scoreTextClass } from '@/lib/scoreBands';
import { cn } from '@/lib/utils';
import type { SessionResultRow } from '@/services/examResultService';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { resultStatusPill } from './sessionDisplay';

function CompetencyScores({ scores }: { scores: ReviewCompetencyScore[] }) {
  if (scores.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Competencias</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {scores.map((cs) => (
          <div key={cs.competency} className="bg-muted/50 border border-border rounded-lg px-3 py-2 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-foreground/80 capitalize truncate">{cs.competency}</span>
              <span className={cn('text-xs font-semibold shrink-0', scoreTextClass(cs.percentage))}>{cs.percentage.toFixed(0)}%</span>
            </div>
            <div
              className="h-1 w-full rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-valuenow={cs.percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${cs.competency} ${cs.percentage.toFixed(0)}%`}
            >
              <div className={cn('h-full rounded-full transition-all duration-500', competencyBarClass(cs.competency))} style={{ width: `${Math.min(cs.percentage, 100)}%` }} />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{cs.totalScore}/{cs.maxScore} pts</span>
              {(cs.pendingEvaluationCount ?? 0) > 0 && (
                <span className="text-yellow-600 dark:text-yellow-500">{cs.pendingEvaluationCount} pend.</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailBody({ resultId }: { resultId: string }) {
  const detail = useAdminResultDetail(resultId);

  if (detail.isLoading) {
    return (
      <div className="flex items-center gap-2 py-6">
        <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
        <span className="text-sm text-muted-foreground">Cargando detalle del examen...</span>
      </div>
    );
  }
  if (detail.isError) {
    return (
      <div className="flex items-center gap-2 py-4">
        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
        <span className="text-sm text-red-600 dark:text-red-400">{detail.error.message || 'Error al cargar detalle'}</span>
      </div>
    );
  }
  const data = detail.data;
  if (!data) return null;

  return (
    <>
      <CompetencyScores scores={data.competencyScores ?? []} />
      <CompetencyMasteryPanel mastery={data.competencyMastery} />
      {data.overallFeedback && (
        <div className="bg-muted/40 border border-border rounded-lg px-3 py-2.5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Retroalimentación general</p>
          <p className="text-xs text-foreground/80 italic leading-relaxed">{data.overallFeedback}</p>
        </div>
      )}
      {data.questionResults.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preguntas</p>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
              {data.questionResults.length}
            </span>
          </div>
          {data.questionResults.map((qr, index) => (
            <QuestionResultCard key={qr.questionId ?? index} index={index} result={qr} showEvaluationMethod />
          ))}
        </div>
      )}
    </>
  );
}

interface ResultDetailDialogProps {
  result: SessionResultRow | null;
  candidateName: string;
  onClose: () => void;
}

export function ResultDetailDialog({ result, candidateName, onClose }: ResultDetailDialogProps) {
  const status = result ? resultStatusPill(result.status) : null;
  return (
    <Dialog open={result !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden rounded-xl">
        {result && status && (
          <>
            <div className="flex items-center gap-2.5 flex-wrap min-w-0 px-4 py-3 pr-12 border-b border-border shrink-0">
              <DialogTitle className="text-sm font-semibold text-foreground">Detalle del resultado</DialogTitle>
              <span className="text-muted-foreground/40">·</span>
              <DialogDescription className="text-sm text-foreground/70 font-medium truncate max-w-[180px]">{candidateName}</DialogDescription>
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold', scoreTextClass(result.percentage))}>
                {result.percentage.toFixed(1)}%
              </span>
              <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', status.className)}>{status.label}</span>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              <DetailBody resultId={result.id} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
