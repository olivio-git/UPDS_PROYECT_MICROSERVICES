import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface ProgressRingProps {
  /** 0–1 fraction filled. Values outside that range are clamped. */
  ratio: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Classes for the background track circle (defaults to `stroke-muted`). */
  trackClassName?: string;
  /** Classes for the filled indicator circle (defaults to `stroke-primary`). */
  indicatorClassName?: string;
  /** Centered content — a timer readout, a score, an icon. */
  children?: ReactNode;
  role?: string;
  'aria-label'?: string;
}

/**
 * Shared circular progress indicator: two concentric SVG circles (a track +
 * a stroke-dashoffset indicator rotated -90deg so 0% starts at 12 o'clock),
 * with arbitrary centered content. This is the geometry behind both the exam
 * runner's draining timer ring (`ExamRunnerHTTP`'s `TimerRing`) and the
 * result screen's score ring (`StudentResults`) — extracted here once both
 * needed the same SVG so a future tweak (stroke cap, rotation, animation)
 * only has to happen in one place.
 */
export function ProgressRing({
  ratio,
  size = 84,
  strokeWidth = 6,
  className,
  trackClassName,
  indicatorClassName,
  children,
  role,
  'aria-label': ariaLabel,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, Number.isFinite(ratio) ? ratio : 0));
  const dashOffset = circumference * (1 - clamped);

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={cn('relative flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          className={cn('stroke-muted', trackClassName)}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={cn(
            'stroke-primary transition-[stroke-dashoffset] duration-1000 ease-linear',
            indicatorClassName
          )}
        />
      </svg>
      {children && (
        <span className="absolute inset-0 flex items-center justify-center">{children}</span>
      )}
    </div>
  );
}
