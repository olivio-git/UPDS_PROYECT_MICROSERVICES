import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Loader2,
  Mic,
  Monitor,
  RefreshCw,
  Save,
  Volume2,
  Wifi,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

// Clave de sessionStorage para marcar una sesión como pre-verificada
export const TECH_CHECK_KEY = (sessionId: string) => `tech_precheck_ok_${sessionId}`;

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckStatus = 'pending' | 'checking' | 'success' | 'warning' | 'error';

interface LocalCheck {
  id: string;
  label: string;
  status: CheckStatus;
  message: string;
}

type AudioStep = 'idle' | 'playing' | 'confirm';

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_CHECKS: LocalCheck[] = [
  { id: 'browser',  label: 'Navegador',  status: 'pending', message: '' },
  { id: 'screen',   label: 'Pantalla',   status: 'pending', message: '' },
  { id: 'internet', label: 'Conexión',   status: 'pending', message: '' },
  { id: 'mic',      label: 'Micrófono',  status: 'pending', message: '' },
  { id: 'audio',    label: 'Audio',      status: 'pending', message: '' },
];

const BAR_MULTIPLIERS = [0.5, 0.75, 1, 0.75, 0.5];

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: CheckStatus }) {
  if (status === 'pending')
    return <div className="h-3 w-3 rounded-full border-2 border-border flex-shrink-0" />;
  if (status === 'checking')
    return <Loader2 className="h-3 w-3 animate-spin text-blue-500 flex-shrink-0" />;
  if (status === 'success')
    return <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />;
  if (status === 'warning')
    return <AlertTriangle className="h-3 w-3 text-yellow-500 flex-shrink-0" />;
  return <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />;
}

function MicBars({ level }: { level: number }) {
  return (
    <div className="flex items-end gap-[2px] h-3 ml-1">
      {BAR_MULTIPLIERS.map((m, i) => (
        <div
          key={i}
          className="w-[2px] rounded-full bg-green-400"
          style={{
            height: `${Math.max(0.15, level * m) * 100}%`,
            transition: 'height 60ms ease',
          }}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SystemCheckPanelProps {
  sessionId?: string;
}

const SystemCheckPanel: React.FC<SystemCheckPanelProps> = ({ sessionId }) => {
  const [checks, setChecks] = useState<LocalCheck[]>(INITIAL_CHECKS);
  const [isRunningAuto, setIsRunningAuto] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [isTestingInternet, setIsTestingInternet] = useState(false);
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [audioStep, setAudioStep] = useState<AudioStep>('idle');
  const [micLevel, setMicLevel] = useState(0);
  const [micWorking, setMicWorking] = useState(false);
  const [saved, setSaved] = useState(false);

  const micStreamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micRafRef = useRef<number | null>(null);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const update = useCallback((id: string, status: CheckStatus, message: string) => {
    setChecks((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status, message } : c))
    );
  }, []);

  const stopMicMonitor = () => {
    if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    micCtxRef.current?.close();
    micCtxRef.current = null;
    setMicLevel(0);
  };

  useEffect(() => () => stopMicMonitor(), []);

  // ── Auto-checks on mount ─────────────────────────────────────────────────────

  const runInternetCheck = useCallback(async () => {
    if (!navigator.onLine) {
      update('internet', 'error', 'Sin conexión a internet');
      return;
    }
    const base =
      import.meta.env.VITE_SESSION_MANAGER_URL?.replace('/api/v1', '') ||
      'http://localhost:80';
    const authBase =
      import.meta.env.VITE_AUTH_SERVICE_URL || 'http://localhost:3001';
    const urls = [`${base}/health`, `${authBase}/health`];
    const t0 = performance.now();
    let ok = 0;
    for (const url of urls) {
      try {
        await fetch(url, { method: 'HEAD', cache: 'no-cache' });
        ok++;
      } catch {}
    }
    const latency = Math.round((performance.now() - t0) / urls.length);
    if (ok === 0) {
      update('internet', 'warning', 'Servidores no alcanzables — verifica tu red');
    } else if (latency < 300) {
      update('internet', 'success', `Buena conexión · ${latency} ms`);
    } else if (latency < 700) {
      update('internet', 'warning', `Conexión lenta · ${latency} ms`);
    } else {
      update('internet', 'warning', `Conexión muy lenta · ${latency} ms`);
    }
  }, [update]);

  useEffect(() => {
    (async () => {
      setIsRunningAuto(true);

      // 1 — Navegador
      update('browser', 'checking', '');
      await delay(150);
      const ok =
        Boolean(navigator.mediaDevices) &&
        Boolean(window.AudioContext || (window as any).webkitAudioContext);
      update(
        'browser',
        ok ? 'success' : 'error',
        ok ? 'Compatible' : 'Usa Chrome, Firefox o Safari'
      );

      // 2 — Pantalla
      update('screen', 'checking', '');
      await delay(150);
      const { width, height } = screen;
      const screenOk = width >= 1024 && height >= 768;
      update(
        'screen',
        screenOk ? 'success' : 'warning',
        `${width}×${height}${screenOk ? '' : ' — mínimo recomendado 1024×768'}`
      );

      // 3 — Internet
      update('internet', 'checking', '');
      await runInternetCheck();

      setIsRunningAuto(false);
    })();
  }, [runInternetCheck, update]);

  // ── Manual tests ──────────────────────────────────────────────────────────────

  const handleRetestInternet = async () => {
    if (isTestingInternet || isRunningAuto) return;
    setIsTestingInternet(true);
    update('internet', 'checking', '');
    await runInternetCheck();
    setIsTestingInternet(false);
  };

  const handleMicTest = async () => {
    if (isTestingMic) return;
    setIsTestingMic(true);
    update('mic', 'checking', 'Solicitando permiso...');
    stopMicMonitor();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      micCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicLevel(avg / 255);
        micRafRef.current = requestAnimationFrame(tick);
      };
      tick();
      setMicWorking(true);
      update('mic', 'success', 'Micrófono detectado — habla para ver el nivel');
    } catch {
      setMicWorking(false);
      update('mic', 'error', 'Sin permiso o micrófono no detectado');
    }
    setIsTestingMic(false);
  };

  const handleAudioTest = async () => {
    if (isTestingAudio) return;
    setIsTestingAudio(true);
    setAudioStep('playing');
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx: AudioContext = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 440;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
      gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 2.9);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3);
      osc.start();
      osc.stop(ctx.currentTime + 3);
      await delay(3100);
      setAudioStep('confirm');
    } catch {
      update('audio', 'error', 'Error al reproducir — verifica volumen del sistema');
      setAudioStep('idle');
      setIsTestingAudio(false);
    }
  };

  const confirmAudio = (heard: boolean) => {
    update(
      'audio',
      heard ? 'success' : 'error',
      heard ? 'Audio funcionando correctamente' : 'Verifica altavoces o auriculares'
    );
    setAudioStep('idle');
    setIsTestingAudio(false);
  };

  // ── Summary ───────────────────────────────────────────────────────────────────

  const allDone = checks.every(
    (c) => c.status !== 'pending' && c.status !== 'checking'
  );
  const hasErrors = checks.some((c) => c.status === 'error');
  const hasWarnings = checks.some((c) => c.status === 'warning');
  const summaryStatus = !allDone
    ? null
    : hasErrors
    ? 'error'
    : hasWarnings
    ? 'warning'
    : 'success';

  // Cuando todos los checks pasan (sin errores), guardar en sessionStorage
  // para que ExamPreparation lo detecte y salte la verificación
  useEffect(() => {
    if (summaryStatus === 'success' && sessionId && !saved) {
      sessionStorage.setItem(TECH_CHECK_KEY(sessionId), '1');
      setSaved(true);
    }
  }, [summaryStatus, sessionId, saved]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="mt-3 rounded-lg border border-line bg-muted/10 overflow-hidden">

      {/* Check rows */}
      <ul className="divide-y divide-border/40">
        {checks.map((c) => {
          const Icon =
            c.id === 'internet' ? Wifi
            : c.id === 'mic' ? Mic
            : c.id === 'audio' ? Volume2
            : Monitor;

          return (
            <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
              {/* Type icon */}
              <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

              {/* Label + message */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground">{c.label}</span>
                  {c.id === 'mic' && micWorking && <MicBars level={micLevel} />}
                </div>
                {c.message && c.status !== 'pending' && c.status !== 'checking' && (
                  <p className="text-[11px] text-muted-foreground leading-tight mt-0.5 truncate">
                    {c.message}
                  </p>
                )}
              </div>

              {/* Action button + status dot */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {c.id === 'internet' && (
                  <button
                    onClick={handleRetestInternet}
                    disabled={isTestingInternet || c.status === 'checking' || isRunningAuto}
                    className="h-6 px-2 text-[11px] border border-border rounded-md text-muted-foreground
                      hover:bg-muted flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none
                      transition-colors"
                  >
                    <RefreshCw className="h-2.5 w-2.5" />
                    Retest
                  </button>
                )}
                {c.id === 'mic' && (
                  <button
                    onClick={handleMicTest}
                    disabled={isTestingMic}
                    className="h-6 px-2 text-[11px] border border-border rounded-md text-muted-foreground
                      hover:bg-muted flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none
                      transition-colors"
                  >
                    {isTestingMic
                      ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
                      : <Mic className="h-2.5 w-2.5" />
                    }
                    Probar
                  </button>
                )}
                {c.id === 'audio' && audioStep === 'idle' && (
                  <button
                    onClick={handleAudioTest}
                    disabled={isTestingAudio}
                    className="h-6 px-2 text-[11px] border border-border rounded-md text-muted-foreground
                      hover:bg-muted flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none
                      transition-colors"
                  >
                    <Volume2 className="h-2.5 w-2.5" />
                    Probar
                  </button>
                )}
                {c.id === 'audio' && audioStep === 'playing' && (
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    Reproduciendo...
                  </span>
                )}
                <StatusDot status={c.status} />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Audio confirmation inline */}
      {audioStep === 'confirm' && (
        <div className="px-4 py-3 bg-blue-500/5 border-t border-blue-200/20">
          <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
            Se reprodujo un tono de 440 Hz. ¿Lo escuchaste?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => confirmAudio(true)}
              className="flex items-center gap-1 h-6 px-3 text-[11px] rounded-md
                bg-green-500/10 border border-green-400/30 text-green-600
                hover:bg-green-500/20 transition-colors"
            >
              <Check className="h-2.5 w-2.5" />
              Sí, lo escuché
            </button>
            <button
              onClick={() => confirmAudio(false)}
              className="flex items-center gap-1 h-6 px-3 text-[11px] rounded-md
                border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              <XCircle className="h-2.5 w-2.5" />
              No escuché nada
            </button>
          </div>
        </div>
      )}

      {/* Summary bar */}
      {summaryStatus && (
        <div
          className={cn(
            'px-4 py-2 border-t text-xs flex items-center gap-2',
            summaryStatus === 'success' &&
              'border-green-200/20 bg-green-500/5 text-green-600 dark:text-green-400',
            summaryStatus === 'warning' &&
              'border-yellow-200/20 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400',
            summaryStatus === 'error' &&
              'border-red-200/20 bg-red-500/5 text-red-600 dark:text-red-400'
          )}
        >
          {summaryStatus === 'success' && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" />
              Sistema listo para el examen
              {saved && sessionId && (
                <span className="ml-auto flex items-center gap-1 text-green-500/70">
                  <Save className="h-3 w-3" />
                  Verificación recordada — puedes entrar sin repetirla
                </span>
              )}
            </>
          )}
          {summaryStatus === 'warning' && (
            <>
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              Algunas advertencias — revisa antes de entrar
            </>
          )}
          {summaryStatus === 'error' && (
            <>
              <XCircle className="h-3.5 w-3.5 flex-shrink-0" />
              Se encontraron problemas — corrígelos antes del examen
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SystemCheckPanel;
