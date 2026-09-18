import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface SegmentedControlProps<T extends string> {
  /** Undefined means no option is selected. */
  value: T | undefined;
  onChange: (value: T) => void;
  options: ReadonlyArray<{ value: T; label: ReactNode; hint?: string }>;
  size?: 'sm' | 'xs' | 'icon';
}

/** Compact pill-style toggle group used across the report filters and cards. */
export function SegmentedControl<T extends string>({
  value, onChange, options, size = 'sm',
}: SegmentedControlProps<T>) {
  return (
    <div className="flex gap-0.5 bg-muted rounded p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.hint}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded font-medium transition-colors',
              size === 'icon' ? 'p-1' : size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[10px]',
              active ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
