import { Button } from '@/components/keel/button';
import { Textarea } from '@/components/keel/textarea';
import { cn } from '@/lib/utils';
import { SquareDashed, X } from 'lucide-react';
import { useRef, useState } from 'react';

export interface BlankDef {
  position: number;
  correctAnswers: string[];
  caseSensitive?: boolean;
}

interface FillBlanksEditorProps {
  template: string;
  blanks: BlankDef[];
  onChange: (next: { template: string; blanks: BlankDef[]; correctAnswer: string[] }) => void;
}

const MARK = '___';

/**
 * Keep each blank's answers attached to the right blank when the teacher types
 * or deletes a `___` in the middle of the sentence.
 */
function realign(prevTemplate: string, nextTemplate: string, blanks: BlankDef[]): BlankDef[] {
  const prev = prevTemplate.split(MARK);
  const next = nextTemplate.split(MARK);
  const delta = next.length - prev.length;
  if (delta === 0) return blanks;
  let at = 0;
  while (at < Math.min(prev.length, next.length) - 1 && prev[at] === next[at]) at++;
  const out = [...blanks];
  if (delta < 0) out.splice(at, -delta);
  else out.splice(at, 0, ...Array.from({ length: delta }, () => ({ position: 0, correctAnswers: [] })));
  return out;
}

/** Words around each blank, so a row reads "… I [1] to the …". */
function blankContexts(template: string) {
  const parts = template.split(MARK);
  return parts.slice(0, -1).map((before, i) => ({
    before: before.trim().split(/\s+/).slice(-3).join(' '),
    after: parts[i + 1].trim().split(/\s+/).slice(0, 3).join(' '),
  }));
}

function AnswerChips({
  values,
  onChange,
  autoFocus,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div className="flex min-h-9 flex-1 flex-wrap items-center gap-1.5 rounded-lg border border-input bg-card px-1.5 py-1 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30 dark:bg-input/30">
      {values.map((v, i) => (
        <span
          key={v}
          className={cn(
            'q-pop inline-flex h-6 items-center gap-1 rounded-md pr-0.5 pl-2 text-sm',
            i === 0 ? 'bg-primary/12 font-medium text-foreground' : 'bg-muted text-foreground',
          )}
        >
          {v}
          <button
            type="button"
            aria-label={`Quitar ${v}`}
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        autoFocus={autoFocus}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
          }
          if (e.key === 'Backspace' && !draft && values.length) onChange(values.slice(0, -1));
        }}
        onBlur={commit}
        placeholder={values.length ? 'Otra respuesta válida' : 'Respuesta'}
        className="h-6 min-w-24 flex-1 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

/**
 * Write the sentence, drop blanks where the cursor is, and give each blank its
 * accepted answers. The first answer is the main one; any other is also
 * accepted (upper/lower case is ignored when grading).
 */
export function FillBlanksEditor({ template, blanks, onChange }: FillBlanksEditorProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const contexts = blankContexts(template);
  const [focusRow, setFocusRow] = useState<number | null>(null);

  const emit = (nextTemplate: string, nextBlanks: BlankDef[]) => {
    const count = nextTemplate.split(MARK).length - 1;
    const normalized = Array.from({ length: count }, (_, i) => ({
      position: i,
      correctAnswers: nextBlanks[i]?.correctAnswers ?? [],
      caseSensitive: false,
    }));
    onChange({
      template: nextTemplate,
      blanks: normalized,
      correctAnswer: normalized.map((b) => b.correctAnswers[0] ?? ''),
    });
  };

  const insertBlank = () => {
    const el = ref.current;
    const start = el?.selectionStart ?? template.length;
    const end = el?.selectionEnd ?? template.length;
    // A selected word becomes the blank and its first answer.
    const selected = template.slice(start, end).trim();
    const before = template.slice(0, start);
    const after = template.slice(end);
    const pad = (s: string, side: 'l' | 'r') =>
      side === 'l' ? (s && !/\s$/.test(s) ? ' ' : '') : (s && !/^[\s.,;:!?]/.test(s) ? ' ' : '');
    const next = `${before}${pad(before, 'l')}${MARK}${pad(after, 'r')}${after}`;
    const index = before.split(MARK).length - 1;
    const nextBlanks = [...blanks];
    nextBlanks.splice(index, 0, { position: index, correctAnswers: selected ? [selected] : [] });
    emit(next, nextBlanks);
    setFocusRow(selected ? null : index);
    requestAnimationFrame(() => {
      if (!el) return;
      const caret = before.length + pad(before, 'l').length + MARK.length;
      if (selected) {
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Textarea
          ref={ref}
          rows={3}
          value={template}
          onChange={(e) => emit(e.target.value, realign(template, e.target.value, blanks))}
          placeholder="Yesterday I ___ to the market."
          className="resize-y pb-11 text-[15px] leading-relaxed md:text-[15px]"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="absolute bottom-2 left-2"
          onMouseDown={(e) => e.preventDefault()}
          onClick={insertBlank}
          title="Inserta un espacio en el cursor, o convierte la palabra seleccionada"
        >
          <SquareDashed />
          Espacio
        </Button>
      </div>

      {contexts.length > 0 && (
        <ol className="flex flex-col gap-2">
          {contexts.map((ctx, i) => (
            <li key={i} className="q-enter flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
              <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground sm:w-64 sm:shrink-0">
                {ctx.before && <span className="truncate">… {ctx.before}</span>}
                <span
                  className={cn(
                    'inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-semibold',
                    blanks[i]?.correctAnswers.length ? 'bg-primary text-primary-foreground' : 'border border-dashed border-primary/60 text-primary',
                  )}
                >
                  {i + 1}
                </span>
                {ctx.after && <span className="truncate">{ctx.after} …</span>}
              </span>
              <AnswerChips
                values={blanks[i]?.correctAnswers ?? []}
                autoFocus={focusRow === i}
                onChange={(values) => {
                  const next = [...blanks];
                  next[i] = { position: i, correctAnswers: values, caseSensitive: false };
                  emit(template, next);
                }}
              />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
