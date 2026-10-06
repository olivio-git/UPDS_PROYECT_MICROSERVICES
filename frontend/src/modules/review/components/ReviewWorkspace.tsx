import { AudioPlayer } from '@/components/audio';
import { Dialog, DialogContent, DialogTitle } from '@/components/keel/dialog';
import { toBrowserMediaUrl } from '@/lib/mediaUrl';
import { cn } from '@/lib/utils';
import type { ReviewTask } from '@/services/reviewService';
import { Image as ImageIcon, Maximize2 } from 'lucide-react';
import { useState } from 'react';
import { COMPETENCY_SHORT, TYPE_LABEL, countWords } from '../reviewFormat';

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{children}</p>;
}

/** Word count against the target range, as a slim bar with the range shaded. */
function WordMeter({ words, target }: { words: number; target?: { min: number; max: number } }) {
  if (!target) return <span className="text-xs text-muted-foreground tabular-nums">{words} palabras</span>;
  const scaleMax = Math.max(target.max * 1.4, words, 1);
  const inRange = words >= target.min && words <= target.max;
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-1.5 w-40 overflow-hidden rounded-full bg-muted">
        <span
          aria-hidden="true"
          className="absolute inset-y-0 bg-primary/15"
          style={{ left: `${(target.min / scaleMax) * 100}%`, width: `${((target.max - target.min) / scaleMax) * 100}%` }}
        />
        <span
          className={cn('absolute inset-y-0 left-0 rounded-full transition-[width] duration-500', inRange ? 'bg-primary' : 'bg-amber-500')}
          style={{ width: `${Math.min(100, (words / scaleMax) * 100)}%` }}
        />
      </div>
      <span className={cn('text-xs tabular-nums', inRange ? 'text-muted-foreground' : 'text-amber-600 dark:text-amber-400')}>
        {words} palabras · meta {target.min}–{target.max}
      </span>
    </div>
  );
}

/** The prompt the student saw, and what they answered. */
export function ReviewWorkspace({ task }: { task: ReviewTask }) {
  const [zoom, setZoom] = useState(false);
  const { question, response } = task;
  const image = question.mediaType === 'image' && question.mediaUrl ? toBrowserMediaUrl(question.mediaUrl) : null;
  const words = countWords(response.text);

  return (
    <div className="q-enter @container flex flex-col gap-8">
      {/* Prompt */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-foreground/80">{COMPETENCY_SHORT[task.competency] ?? task.competency}</span>
          <span className="rounded-md bg-muted px-2 py-0.5 font-medium text-foreground/80">{task.level}</span>
          <span>{TYPE_LABEL[task.questionType] ?? task.questionType}</span>
          <span aria-hidden="true">·</span>
          <span>Pregunta {task.questionNumber}</span>
        </div>

        <div className="flex items-start gap-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg leading-snug font-semibold text-foreground">{question.question}</h2>
            {question.instructions && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{question.instructions}</p>}
            {image && question.mediaAlt && (
              <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
                <ImageIcon className="mt-0.5 size-3 shrink-0" />
                {question.mediaAlt}
              </p>
            )}
            {question.context && (
              <p className="mt-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground/85">
                {question.context}
              </p>
            )}
          </div>

          {image && (
            <button
              type="button"
              onClick={() => setZoom(true)}
              className="group relative w-40 shrink-0 overflow-hidden rounded-xl border border-border bg-muted/30 outline-none focus-visible:ring-3 focus-visible:ring-ring/40 @2xl:w-56"
              aria-label="Ampliar imagen"
            >
              <img src={image} alt={question.mediaAlt ?? ''} className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              <span className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-md bg-background/85 text-foreground opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100">
                <Maximize2 className="size-3" />
              </span>
            </button>
          )}
        </div>
      </section>

      {/* Answer */}
      <section>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <Label>Respuesta de {task.studentName.split(' ')[0]}</Label>
          {response.text !== undefined && <WordMeter words={words} target={question.wordTarget} />}
        </div>

        {response.audioUrl && (
          <AudioPlayer src={toBrowserMediaUrl(response.audioUrl)} variant="compact" title="Respuesta oral" knownDuration={response.audioDuration} />
        )}

        {response.text !== undefined && (
          <div className="rounded-xl border border-border bg-background/60 px-5 py-4">
            {response.text.trim() ? (
              <p className="max-w-prose text-[15px] leading-[1.8] whitespace-pre-wrap text-foreground">{response.text}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Sin respuesta</p>
            )}
          </div>
        )}
      </section>

      {image && (
        <Dialog open={zoom} onOpenChange={setZoom}>
          <DialogContent className="max-w-4xl p-2 sm:max-w-4xl">
            <DialogTitle className="sr-only">Imagen de la pregunta</DialogTitle>
            <img src={image} alt={question.mediaAlt ?? ''} className="max-h-[80vh] w-full rounded-lg object-contain" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
