import { Button } from '@/components/keel/button';
import { cn } from '@/lib/utils';
import { Check, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { QuestionOption } from '@/modules/exams/types';
import { uid } from './uid';

interface ChoiceEditorProps {
  options: QuestionOption[];
  onChange: (options: QuestionOption[]) => void;
}

/**
 * Options are edited in place, in the same card shape the student sees. The
 * circle on the left marks the correct answer; Enter in the last field adds
 * a new option, Backspace on an empty one removes it.
 */
export function ChoiceEditor({ options, onChange }: ChoiceEditorProps) {
  const [draft, setDraft] = useState('');
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const draftRef = useRef<HTMLInputElement | null>(null);

  const setText = (id: string, text: string) =>
    onChange(options.map((o) => (o.id === id ? { ...o, text } : o)));
  const markCorrect = (id: string) => onChange(options.map((o) => ({ ...o, isCorrect: o.id === id })));
  const remove = (index: number) => {
    onChange(options.filter((_, i) => i !== index));
    requestAnimationFrame(() => (refs.current[index - 1] ?? draftRef.current)?.focus());
  };
  const add = () => {
    if (!draft.trim()) return;
    onChange([...options, { id: uid(), text: draft.trim(), isCorrect: options.length === 0 }]);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-2">
      {options.map((opt, index) => (
        <div
          key={opt.id}
          className={cn(
            'q-enter group flex items-center gap-3 rounded-xl border px-3 py-2 transition-colors',
            opt.isCorrect ? 'border-primary/60 bg-primary/5' : 'border-border bg-card',
          )}
        >
          <button
            type="button"
            onClick={() => markCorrect(opt.id)}
            aria-pressed={!!opt.isCorrect}
            aria-label={opt.isCorrect ? 'Respuesta correcta' : 'Marcar como correcta'}
            title={opt.isCorrect ? 'Respuesta correcta' : 'Marcar como correcta'}
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
              opt.isCorrect
                ? 'q-pop bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-primary/15 hover:text-primary',
            )}
          >
            {opt.isCorrect ? <Check className="size-3.5" /> : String.fromCharCode(65 + index)}
          </button>
          <input
            ref={(el) => { refs.current[index] = el; }}
            value={opt.text}
            onChange={(e) => setText(opt.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                (refs.current[index + 1] ?? draftRef.current)?.focus();
              }
              if (e.key === 'Backspace' && !opt.text) {
                e.preventDefault();
                remove(index);
              }
            }}
            className="h-8 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Quitar opción"
            className="text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
            onClick={() => remove(index)}
          >
            <X />
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-3 py-2 transition-colors focus-within:border-primary/50">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          <Plus className="size-3.5" />
        </span>
        <input
          ref={draftRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="Nueva opción"
          className="h-8 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}

const TF_OPTIONS = [
  { id: 'true', text: 'Verdadero' },
  { id: 'false', text: 'Falso' },
];

/** True / false: two cards, pick the right one. */
export function TrueFalseEditor({ options, onChange }: ChoiceEditorProps) {
  const correct = options.find((o) => o.isCorrect);
  const correctId = correct
    ? correct.id?.toLowerCase() === 'true' || ['true', 'verdadero'].includes(correct.text?.toLowerCase())
      ? 'true'
      : 'false'
    : undefined;
  const pick = (id: string) => onChange(TF_OPTIONS.map((o) => ({ ...o, isCorrect: o.id === id })));

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {TF_OPTIONS.map((opt) => {
        const selected = correctId === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={selected}
            onClick={() => pick(opt.id)}
            className={cn(
              'flex h-12 items-center gap-3 rounded-xl border px-3 text-left text-[15px] transition-all duration-150',
              selected
                ? 'border-primary bg-primary/5 font-medium text-foreground ring-3 ring-primary/15'
                : 'border-border bg-card text-foreground hover:border-primary/40',
            )}
          >
            <span
              key={selected ? 'on' : 'off'}
              className={cn(
                'flex size-7 items-center justify-center rounded-full transition-colors',
                selected ? 'q-pop bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
              )}
            >
              {selected && <Check className="size-3.5" />}
            </span>
            {opt.text}
          </button>
        );
      })}
    </div>
  );
}
