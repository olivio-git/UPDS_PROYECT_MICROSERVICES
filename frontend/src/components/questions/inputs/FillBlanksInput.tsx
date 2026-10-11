import { cn } from '@/lib/utils';
import { Fragment, useRef } from 'react';

interface FillBlanksInputProps {
  /** Sentence with `___` where each blank goes. */
  template: string;
  value: string[];
  onChange: (blanks: string[]) => void;
}

/**
 * The sentence reads as a sentence: each blank is an inline field that grows
 * with what the student types. Its width never depends on the expected answer,
 * so the field does not give away how long the answer is.
 */
export function FillBlanksInput({ template, value, onChange }: FillBlanksInputProps) {
  const parts = template.split('___');
  const blanks = parts.length - 1;
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const update = (index: number, text: string) => {
    const next = Array.from({ length: blanks }, (_, i) => value[i] ?? '');
    next[index] = text;
    onChange(next);
  };

  return (
    <p className="text-lg leading-[2.6] text-foreground">
      {parts.map((part, index) => (
        <Fragment key={index}>
          <span className="whitespace-pre-wrap">{part}</span>
          {index < blanks && (
            <span className="relative mx-1 inline-flex align-baseline">
              {blanks > 1 && (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] leading-none font-medium text-muted-foreground"
                >
                  {index + 1}
                </span>
              )}
              <input
                ref={(el) => { refs.current[index] = el; }}
                type="text"
                aria-label={`Espacio ${index + 1}`}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={value[index] ?? ''}
                onChange={(e) => update(index, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    refs.current[index + 1]?.focus();
                  }
                }}
                style={{ width: `${Math.max(6, (value[index] ?? '').length + 2)}ch` }}
                className={cn(
                  'h-9 rounded-t-md border-0 border-b-2 bg-muted/60 px-2 text-center text-base font-medium text-foreground transition-[background-color,border-color,width] duration-150 outline-none',
                  'focus:border-primary focus:bg-primary/5',
                  value[index]?.trim() ? 'border-primary/70 bg-primary/5' : 'border-input',
                )}
              />
            </span>
          )}
        </Fragment>
      ))}
    </p>
  );
}
