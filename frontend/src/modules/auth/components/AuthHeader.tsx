import { BrandLogo } from '@/components/BrandLogo';
import { cn } from '@/lib/utils';

const STEP_LABELS = ['Email', 'Código', 'Contraseña'] as const;

interface AuthHeaderProps {
  /** 0-based index of the active step in the email → code → password flow. */
  step: 0 | 1 | 2;
}

/**
 * Restrained product identity shared by the three auth screens (OtpInitialScreen,
 * OtpVerificator, LoginScreen) so they read as one flow instead of three
 * disconnected forms.
 *
 * A labelled `Steps` component (ported to src/components/keel/steps.tsx) was tried
 * here first but its fixed-width, `shrink-0` step buttons overflow this card at both
 * 1280px and 430px — "Contraseña" clips past the card's own `overflow-hidden` edge
 * (see scripts/e2e-browser/screenshots/after-0{1,2,3}-*-{1280,430}.png from the port
 * verification run). It needs a wider host than a max-w-md auth card gives it, so a
 * plain dot row is used here instead; `Steps` stays ported for a wider layout
 * (app shell / wizard) in a later slice.
 */
export function AuthHeader({ step }: AuthHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-3 mb-2">
      <BrandLogo className="h-16" />
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Plataforma de Evaluación
      </p>
      <ol className="flex items-center gap-1.5" aria-label="Progreso del inicio de sesión">
        {STEP_LABELS.map((label, i) => (
          <li key={label} className="flex items-center gap-1.5">
            <span
              aria-current={i === step ? 'step' : undefined}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === step ? 'w-5 bg-indigo-600' : i < step ? 'w-1.5 bg-indigo-600/40' : 'w-1.5 bg-border'
              )}
            />
            <span className="sr-only">{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
