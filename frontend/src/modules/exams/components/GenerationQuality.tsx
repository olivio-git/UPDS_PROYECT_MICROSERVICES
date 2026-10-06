import { AlertTriangle, ShieldCheck } from 'lucide-react';

/** Automatic review returned by grading-service with every generated question. */
export interface QualityReport {
  score: number;
  issues: { code: string; severity: 'block' | 'warn'; label: string }[];
}

const tone = (score: number) =>
  score >= 90
    ? { text: 'Lista', cls: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600/40 dark:bg-emerald-900/20 dark:text-emerald-300' }
    : { text: 'Revisar', cls: 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600/40 dark:bg-amber-900/20 dark:text-amber-300' };

/** Small pill for lists: "Lista" or "Revisar · 2". */
export function QualityBadge({ quality }: { quality?: QualityReport }) {
  if (!quality) return null;
  const t = tone(quality.score);
  const n = quality.issues.length;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium ${t.cls}`}
      title={n ? quality.issues.map((i) => i.label).join(' · ') : 'Sin observaciones'}
    >
      {n ? <AlertTriangle className="size-3" /> : <ShieldCheck className="size-3" />}
      {t.text}
      {n > 0 && <span className="tabular-nums">· {n}</span>}
    </span>
  );
}

/** Panel under the preview: what the automatic review checked and what the teacher should look at. */
export function QualityPanel({ quality, attempts }: { quality?: QualityReport; attempts?: number }) {
  if (!quality) return null;
  const fixed = (attempts ?? 1) > 1;
  if (!quality.issues.length) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div>
          <p className="font-medium text-foreground">Revisión automática sin observaciones</p>
          <p className="text-xs text-muted-foreground">
            Idioma, respuesta correcta, nivel MCER y repetición con el banco
            {fixed ? `. La IA la corrigió antes de mostrarla (${attempts} intentos).` : '.'}
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm dark:border-amber-600/40 dark:bg-amber-900/20">
      <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
        <AlertTriangle className="size-4 shrink-0" />
        Revisa antes de guardar
      </p>
      <ul className="mt-1.5 space-y-0.5 pl-6 text-xs text-amber-800 dark:text-amber-200 list-disc">
        {quality.issues.map((i) => (
          <li key={i.code}>{i.label}</li>
        ))}
      </ul>
    </div>
  );
}
