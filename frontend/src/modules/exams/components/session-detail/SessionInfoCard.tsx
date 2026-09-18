import { cn } from '@/lib/utils';
import { AlertTriangle, Calendar, DoorOpen, Lock, Settings, Shield, Zap, type LucideIcon } from 'lucide-react';
import type { ExamSession } from '../../types';
import { formatDateShort, formatSessionDuration } from './sessionDisplay';

function occupancyTone(pct: number) {
  if (pct > 90) return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400' };
  if (pct >= 70) return { bar: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' };
}

function Scheduling({ session }: { session: ExamSession }) {
  const { startDate, endDate, timeZone } = session.scheduling;
  const registered = session.participants.registeredCandidates?.length ?? 0;
  const capacity = session.participants.maxCandidates;
  const pct = capacity > 0 ? Math.round((registered / capacity) * 100) : 0;
  const tone = occupancyTone(pct);
  const rows: Array<[string, string]> = [
    ['Inicio', formatDateShort(startDate)],
    ['Fin', formatDateShort(endDate)],
    ['Duración', formatSessionDuration(startDate, endDate)],
    ['Timezone', timeZone],
  ];

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        <Calendar className="w-3.5 h-3.5 text-blue-400" />
        Programación
      </h2>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0 mt-0.5">{label}</span>
            <span className="text-xs text-foreground/80 text-right font-medium">{value}</span>
          </div>
        ))}
      </div>
      <div className="pt-2 border-t border-border space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Ocupación</span>
          <span className={cn('font-semibold', tone.text)}>{registered}/{capacity} ({pct}%)</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Ocupación de la sesión">
          <div className={cn('h-full rounded-full transition-all duration-500', tone.bar)} style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        {pct > 90 && (
          <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Capacidad casi agotada
          </p>
        )}
      </div>
    </div>
  );
}

interface SettingRowProps {
  icon: LucideIcon;
  title: string;
  description: string;
  value: string;
  /** Icon color when enabled; undefined renders the row as not applicable. */
  enabledIcon?: string;
  enabledBadge?: string;
  enabled: boolean;
}

function SettingRow({ icon: Icon, title, description, value, enabled, enabledIcon, enabledBadge }: SettingRowProps) {
  const notApplicable = enabledIcon === undefined;
  return (
    <div className={cn('flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border', notApplicable && 'opacity-50')}>
      <div className="flex items-center gap-2 min-w-0">
        <Icon className={cn('w-3.5 h-3.5 shrink-0', enabled && enabledIcon ? enabledIcon : 'text-muted-foreground/40')} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground leading-none">{title}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <span className={cn(
        'text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0',
        enabled && enabledBadge ? enabledBadge : 'bg-muted text-muted-foreground border-border',
      )}>
        {value}
      </span>
    </div>
  );
}

function SessionSettings({ settings }: { settings: ExamSession['settings'] }) {
  const lateMinutes = settings.lateEntryMinutes ?? 0;
  return (
    <div className="sm:pl-4 space-y-3">
      <h2 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
        <Settings className="w-3.5 h-3.5 text-muted-foreground" />
        Configuración
      </h2>
      <div className="space-y-1.5">
        <SettingRow
          icon={Shield} title="Proctor" description="Supervisor presente"
          enabled={settings.requireProctor} value={settings.requireProctor ? 'Sí' : 'No'}
          enabledIcon="text-blue-500"
          enabledBadge="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/30"
        />
        <SettingRow
          icon={Zap} title="Inicio automático" description="Inicia solo a la hora programada"
          enabled={settings.autoStart} value={settings.autoStart ? 'Sí' : 'No'}
          enabledIcon="text-green-500"
          enabledBadge="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/30"
        />
        <SettingRow
          icon={DoorOpen} title="Entrada tardía"
          description={settings.allowLateEntry ? `Tolerancia de ${lateMinutes} min` : 'No permitida'}
          enabled={settings.allowLateEntry} value={settings.allowLateEntry ? `+${lateMinutes}min` : 'No'}
          enabledIcon="text-orange-500"
          enabledBadge="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800/30"
        />
        {/* Kept as in the original screen: shown as not available, regardless of settings.browserLockdown. */}
        <SettingRow icon={Lock} title="Bloqueo de navegador" description="No disponible en navegadores web" enabled={false} value="N/D" />
      </div>
    </div>
  );
}

/** Scheduling and configuration of a session, side by side. */
export function SessionInfoCard({ session }: { session: ExamSession }) {
  return (
    <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:divide-x sm:divide-border">
        <Scheduling session={session} />
        <SessionSettings settings={session.settings} />
      </div>
    </div>
  );
}
