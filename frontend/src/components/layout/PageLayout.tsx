import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/keel/card';
import { cn } from '@/lib/utils';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Shared page scaffolding so every screen has the same frame: content fills
 * the width AppShell gives it (no centred, max-width column), sections are
 * flat regions separated by hairlines, and headers use one type scale.
 *
 * The session scheduler (SessionForm) and the student dashboard were the first
 * screens built this way; these components are that layout extracted.
 */

/** Outer wrapper of a screen: full width and height, one padding. */
export function Page({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex h-full min-h-0 flex-col gap-3 p-3', className)}>{children}</div>;
}

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons on the right (create, export, refresh…). */
  actions?: ReactNode;
  /** Extra content after the title, e.g. a status badge. */
  meta?: ReactNode;
  className?: string;
}

/** Title row of a list/overview screen. */
export function PageHeader({ title, description, actions, meta, className }: PageHeaderProps) {
  return (
    <div className={cn('flex shrink-0 flex-wrap items-center justify-between gap-2', className)}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-xl font-bold text-foreground">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

interface FormPageProps {
  /** Small uppercase label on the right of the top bar ("Nuevo examen"). */
  title: ReactNode;
  onBack?: () => void;
  backLabel?: string;
  /** Right-aligned actions in the bottom bar (Cancelar / Guardar). */
  footer?: ReactNode;
  /** Left side of the bottom bar (hints, counters). */
  footerStart?: ReactNode;
  /** Render as a <form> and submit with this handler. */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  className?: string;
  children: ReactNode;
}

/**
 * Create/edit screen: "‹ Volver" + title on top, full-width flat sections,
 * actions in a bar at the bottom — the same frame as the session scheduler.
 */
export function FormPage({
  title,
  onBack,
  backLabel = 'Volver',
  footer,
  footerStart,
  onSubmit,
  className,
  children,
}: FormPageProps) {
  const body = (
    <>
      <div className="flex shrink-0 items-center justify-between gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {backLabel}
          </button>
        ) : (
          <span />
        )}
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      </div>

      <div className="flex flex-col gap-3">{children}</div>

      {(footer || footerStart) && (
        <div className="-mx-3 mt-auto flex shrink-0 items-center justify-between gap-3 border-t border-border px-3 pt-3">
          <div className="flex items-center gap-2">{footerStart}</div>
          <div className="flex items-center gap-2">{footer}</div>
        </div>
      )}
    </>
  );

  const classes = cn('flex flex-col gap-4', className);
  return onSubmit ? (
    <form onSubmit={onSubmit} className={classes}>
      {body}
    </form>
  ) : (
    <div className={classes}>{body}</div>
  );
}

interface FormSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** Buttons on the right of the section title. */
  actions?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

/** One flat region of a form or detail screen. */
export function FormSection({
  title,
  description,
  icon,
  actions,
  className,
  contentClassName,
  children,
}: FormSectionProps) {
  return (
    <Card flat className={className}>
      {(title || actions) && (
        <CardHeader>
          {title && (
            <CardTitle className="flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
          )}
          {description && <CardDescription>{description}</CardDescription>}
          {actions && <CardAction className="flex items-center gap-2">{actions}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={cn('flex flex-col gap-4', contentClassName)}>{children}</CardContent>
    </Card>
  );
}
