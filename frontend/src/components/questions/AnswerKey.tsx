import { cn } from '@/lib/utils';
import { ArrowRight, BookOpen, Check, Clock, Star } from 'lucide-react';
import { Fragment } from 'react';

interface KeyItem {
  id: string;
  content: string;
  correctPosition?: number;
  matchingPair?: string;
}

export interface AnswerKeyQuestion {
  type: string;
  competency?: string;
  content: {
    question?: string;
    context?: string;
    options?: Array<{ id: string; text: string; isCorrect?: boolean }>;
    template?: string;
    blanks?: Array<{ correctAnswers: string[] }>;
    correctAnswer?: string | string[];
    items?: KeyItem[];
    sampleAnswer?: string;
  };
  metadata?: { topic?: string; points?: number; estimatedTime?: number };
}

const byPosition = (items: KeyItem[]) =>
  items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (a.it.correctPosition ?? a.i + 1) - (b.it.correctPosition ?? b.i + 1))
    .map((x) => x.it);

/**
 * Read-only answer key: the question as the student sees it, with the right
 * answer filled in. Used wherever a teacher reviews a question (AI generator,
 * question detail).
 */
export function AnswerKey({ question, compact = false }: { question: AnswerKeyQuestion; compact?: boolean }) {
  const { content, type } = question;
  const items = content.items ?? [];
  const blankAnswers =
    content.blanks?.map((b) => b.correctAnswers) ??
    (Array.isArray(content.correctAnswer) ? content.correctAnswer.map((a) => [a]) : []);

  return (
    <div className={cn('flex flex-col gap-3', compact ? 'text-sm' : 'text-[15px]')}>
      {content.context && (
        <p
          className={cn(
            'rounded-lg border border-border bg-muted/30 px-3 py-2 leading-relaxed whitespace-pre-wrap text-foreground/85',
            compact && 'line-clamp-3',
          )}
        >
          {content.context}
        </p>
      )}

      {content.question && <p className="leading-snug font-medium text-foreground">{content.question}</p>}

      {(type === 'multiple_choice' || type === 'true_false') && !!content.options?.length && (
        <ul className="flex flex-col gap-1.5">
          {content.options.map((opt, i) => (
            <li
              key={opt.id}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5',
                opt.isCorrect ? 'border-primary/50 bg-primary/5 text-foreground' : 'border-border text-foreground/80',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                  opt.isCorrect ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                )}
              >
                {opt.isCorrect ? <Check className="size-3" /> : String.fromCharCode(65 + i)}
              </span>
              {opt.text}
            </li>
          ))}
        </ul>
      )}

      {type === 'fill_blanks' && content.template && (
        <p className="leading-loose text-foreground">
          {content.template.split('___').map((part, i, parts) => (
            <Fragment key={i}>
              {part}
              {i < parts.length - 1 && (
                <span className="mx-0.5 inline-flex items-baseline gap-1 rounded-md border-b-2 border-primary bg-primary/8 px-1.5 font-medium">
                  {blankAnswers[i]?.[0] || '___'}
                  {blankAnswers[i] && blankAnswers[i].length > 1 && (
                    <span className="text-xs font-normal text-muted-foreground">/ {blankAnswers[i].slice(1).join(' / ')}</span>
                  )}
                </span>
              )}
            </Fragment>
          ))}
        </p>
      )}

      {type === 'matching' && items.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {items.map((it, i) => (
            <li
              key={it.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2.5 rounded-lg border border-border px-2.5 py-1.5"
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">
                {i + 1}
              </span>
              <span className="text-foreground">{it.content}</span>
              <ArrowRight className="size-3.5 text-primary" />
              <span className="font-medium text-foreground">{it.matchingPair}</span>
            </li>
          ))}
        </ul>
      )}

      {type === 'ordering' && items.length > 0 && (
        <ol className="flex flex-col gap-1.5">
          {byPosition(items).map((it, i) => (
            <li key={it.id} className="flex items-center gap-2.5 rounded-lg border border-border px-2.5 py-1.5 text-foreground">
              <span className="flex size-5 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary">
                {i + 1}
              </span>
              {it.content}
            </li>
          ))}
        </ol>
      )}

      {type === 'drag_drop' && items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {byPosition(items).map((it) => (
            <span key={it.id} className="rounded-md border border-primary/30 bg-card px-2 py-1 text-foreground">
              {it.content}
            </span>
          ))}
        </div>
      )}

      {content.sampleAnswer && (
        <p className="border-l-2 border-primary/40 pl-3 leading-relaxed text-foreground/80 italic">{content.sampleAnswer}</p>
      )}

      {question.metadata && (
        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-muted-foreground">
          {question.metadata.topic && (
            <span className="inline-flex items-center gap-1">
              <BookOpen className="size-3.5" />
              {question.metadata.topic}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Star className="size-3.5" />
            {question.metadata.points ?? 1} pt
          </span>
          {question.metadata.estimatedTime ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {question.metadata.estimatedTime} min
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
