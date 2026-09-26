import { Alert, AlertDescription } from "@/components/keel/alert";
import { Button } from "@/components/keel/button";
import { MainLayout } from "@/components/layout";
import { Item, ItemActions, ItemContent, ItemMedia, ItemTitle } from "@/components/keel/item";
import { Progress } from "@/components/keel/progress";
import { Spinner } from "@/components/keel/spinner";
import { cn } from "@/lib/utils";
import {
  examService,
  getTechnicalVerificationRequiredInfo,
} from "@/services/examService";
import { authSDK } from "@/services/sdk-simple-auth";
import { notificationSocket } from "@/services/notifications/notificationSocket";
import { useExamStore } from "@/stores/examStore";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  GraduationCap,
  Info,
  Mic,
  Monitor,
  Play,
  RefreshCw,
  User,
  Volume2,
  Wifi,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { studentExamService, type NextExamData } from "../services/examService";
import sessionManagerTechnicalService from "../services/sessionManagerTechnicalService";
import {
  technicalVerificationService,
  type TechnicalCheck,
  type TechnicalVerificationData,
} from "../services/technicalVerificationService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NetworkQuality {
  effectiveType: "4g" | "3g" | "2g" | "slow-2g";
  downlink: number;
  rtt: number;
  quality: "excellent" | "good" | "fair" | "poor";
  status: "checking" | "success" | "warning" | "error";
}

interface MicrophoneTestResult {
  level: number;
  isWorking: boolean;
  isRecording: boolean;
  audioUrl?: string;
  duration?: number;
}

// ─── Lookup maps ──────────────────────────────────────────────────────────────

const CHECK_ICONS: Record<string, React.ElementType> = {
  "Conexión a Internet": Wifi,
  "Navegador Compatible": Monitor,
  "Resolución de Pantalla": Monitor,
  "Micrófono": Mic,
  "Auriculares/Altavoces": Volume2,
};

const STATUS_LABEL: Record<TechnicalCheck["status"], string> = {
  pending: "Pendiente",
  checking: "Verificando",
  success: "Correcto",
  warning: "Advertencia",
  error: "Error",
};

const STATUS_BADGE: Record<
  TechnicalCheck["status"],
  { border: string; text: string; bg: string }
> = {
  pending: {
    border: "border-border",
    text: "text-muted-foreground",
    bg: "bg-transparent",
  },
  checking: {
    border: "border-blue-200 dark:border-blue-500/40",
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-500/10",
  },
  success: {
    border: "border-green-200 dark:border-green-500/40",
    text: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-500/10",
  },
  warning: {
    border: "border-yellow-200 dark:border-yellow-500/40",
    text: "text-yellow-600 dark:text-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-500/10",
  },
  error: {
    border: "border-red-200 dark:border-red-500/40",
    text: "text-red-600 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-500/10",
  },
};

// Left accent per row — makes the row's state readable at a glance, before
// even reading the badge text, which is the point of a pre-flight list.
const STATUS_ACCENT: Record<TechnicalCheck["status"], string> = {
  pending: "border-l-border",
  checking: "border-l-blue-400 dark:border-l-blue-500",
  success: "border-l-green-400 dark:border-l-green-500",
  warning: "border-l-yellow-400 dark:border-l-yellow-500",
  error: "border-l-red-400 dark:border-l-red-500",
};

// Checks the candidate never presses a button for — startAutomaticChecks
// runs them on mount, so their "pending" hint is different from the ones
// that wait on a manual "Probar" click.
const AUTOMATIC_CHECK_NAMES = new Set([
  "Conexión a Internet",
  "Navegador Compatible",
  "Resolución de Pantalla",
]);

// What the row should tell the candidate to DO while it's still pending —
// this is the "not green yet, here's the fix" copy the redesign brief asks
// for, shown before `check.message` exists (which only appears once a check
// has actually run at least once).
const PENDING_HINTS: Record<string, string> = {
  "Micrófono": "Pulsa Probar y permite el acceso al micrófono.",
  "Auriculares/Altavoces": "Pulsa Probar audio y confirma si escuchaste el tono.",
};

// Guía amigable por código de motivo cuando el servidor rechaza el inicio
// del examen (TECHNICAL_VERIFICATION_REQUIRED). El `message` ya viene en
// español desde session-manager-service — esto solo agrega el "cómo lo arreglo".
const TECHNICAL_REASON_HINTS: Record<string, string> = {
  MICROPHONE_FAILED: "Presiona \"Probar\" junto a Micrófono y habla durante la prueba. Si el navegador lo bloqueó, permite el acceso al micrófono.",
  NETWORK_UNSTABLE: "Tu conexión es inestable, verifica tu red.",
  BROWSER_INCOMPATIBLE: "Usa Chrome, Firefox, Edge o Safari.",
  LOW_SCORE: "Vuelve a realizar la verificación técnica para mejorar tu puntaje.",
  NOT_FOUND: "No se encontró una verificación técnica reciente. Complétala nuevamente.",
  EXPIRED: "Tu verificación técnica expiró. Vuelve a realizarla.",
  INTERNAL_ERROR: "Ocurrió un error inesperado. Intenta nuevamente.",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function CheckStatusIcon({ status }: { status: TechnicalCheck["status"] }) {
  if (status === "pending")
    return (
      <div className="h-3.5 w-3.5 rounded-full border-2 border-border flex-shrink-0" />
    );
  if (status === "checking")
    return <Spinner className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />;
  if (status === "success")
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />;
  if (status === "warning")
    return <AlertTriangle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />;
  return <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400 flex-shrink-0" />;
}

// Multiplicadores para darle forma de onda: los del centro son más altos
const BAR_MULTIPLIERS = [0.5, 0.75, 1, 0.75, 0.5];

function MicLevelBars({ level }: { level: number }) {
  return (
    <div className="flex items-end gap-[3px] h-4 mt-1.5">
      {BAR_MULTIPLIERS.map((m, i) => {
        const h = Math.max(0.15, level * m);
        return (
          <div
            key={i}
            className="w-[3px] rounded-full bg-green-400/80"
            style={{
              height: `${h * 100}%`,
              transition: "height 60ms ease",
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Constants / types ────────────────────────────────────────────────────────

const PREP_WINDOW_MINUTES = 10; // Periféricos disponibles N min antes del inicio
const GRACE_PERIOD_MINUTES = 2; // Gracia fija aunque no se permita entrada tardía

type EntryStatus = 'loading' | 'too_early' | 'prep_window' | 'ok' | 'reduced_time' | 'blocked';

// ─── Main component ───────────────────────────────────────────────────────────

const ExamPreparation = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const setSessionData = useExamStore((s) => s.setSessionData);

  // Core state
  const [examData, setExamData] = useState<NextExamData | null>(null);
  const [verificationData, setVerificationData] =
    useState<TechnicalVerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  // Non-null when exam-service's server-side gate rejected the start with
  // TECHNICAL_VERIFICATION_REQUIRED (403) — the client-side `canProceed`
  // below is only a local UX hint, this is the authoritative block.
  // Initialized from router state when a runner (ExamRunnerHTTP /
  // AdaptiveExamRunner) redirected here after a deep-link 403, so the
  // candidate sees the reasons immediately instead of re-discovering them.
  const [verificationBlocked, setVerificationBlocked] = useState<
    { code: string; message: string }[] | null
  >((location.state as any)?.technicalVerificationReasons ?? null);

  // Entry timing state
  const [countdown, setCountdown] = useState<number | null>(null);
  const [entryStatus, setEntryStatus] = useState<EntryStatus>('loading');
  const [availableMinutes, setAvailableMinutes] = useState<number | null>(null);

  // Test states
  const [isTestingInternet, setIsTestingInternet] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micResult, setMicResult] = useState<MicrophoneTestResult | null>(null);
  const [isTestingAudio, setIsTestingAudio] = useState(false);
  const [audioTestStep, setAudioTestStep] = useState<
    "idle" | "playing" | "waiting-confirmation"
  >("idle");

  // Mic live level monitor
  const [micLiveLevel, setMicLiveLevel] = useState(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micAnimFrameRef = useRef<number | null>(null);

  // Camera — deshabilitada por ahora
  // const [isTestingCamera, setIsTestingCamera] = useState(false);
  // const [cameraResult, setCameraResult] = useState<CameraTestResult | null>(null);

  // ── Computed ──────────────────────────────────────────────────────────────

  const visibleChecks = useMemo(
    () =>
      (verificationData?.checks ?? []).filter((c) => c.name !== "Cámara Web"),
    [verificationData]
  );

  const verificationProgress = useMemo(() => {
    if (!visibleChecks.length) return 0;
    const done = visibleChecks.filter(
      (c) => c.status === "success" || c.status === "warning"
    ).length;
    return Math.round((done / visibleChecks.length) * 100);
  }, [visibleChecks]);

  const canProceed = useMemo(
    () =>
      visibleChecks.length > 0 &&
      visibleChecks
        .filter((c) => c.required)
        .every((c) => c.status === "success" || c.status === "warning"),
    [visibleChecks]
  );

  // Which required checks are still keeping the candidate from starting —
  // named explicitly instead of a generic "complete every check" line, so
  // the disabled button always says exactly what's missing.
  const missingRequiredChecks = useMemo(
    () =>
      visibleChecks
        .filter((c) => c.required && c.status !== "success" && c.status !== "warning")
        .map((c) => c.name),
    [visibleChecks]
  );

  const checksDoneCount = useMemo(
    () => visibleChecks.filter((c) => c.status === "success" || c.status === "warning").length,
    [visibleChecks]
  );

  // ── Entry status computation ──────────────────────────────────────────────

  const computeEntryStatus = useCallback((data: NextExamData): EntryStatus => {
    const now = new Date();
    const startDate = new Date(data.rawStartDate);
    const endDate = new Date(data.rawEndDate);
    const examDurationSecs = data.examDurationMinutes * 60;
    const minutesUntilStart = (startDate.getTime() - now.getTime()) / 60000;
    const minutesLate = (now.getTime() - startDate.getTime()) / 60000;
    const sessionRemainingSecs = Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / 1000));

    if (data.status === 'scheduled') {
      if (minutesUntilStart > PREP_WINDOW_MINUTES) {
        setCountdown(null);
        setAvailableMinutes(null);
        return 'too_early';
      }
      setCountdown(Math.max(0, Math.floor(minutesUntilStart * 60)));
      setAvailableMinutes(null);
      return 'prep_window';
    }

    if (data.status === 'in_progress') {
      // If student already has an in-progress attempt, skip late-entry check
      // (re-entry for connection loss / PC change is always allowed while session is open)
      const isReEntry = data.myAttemptStatus === 'in_progress';
      if (!isReEntry) {
        const lateBlocked = data.allowLateEntry
          ? minutesLate > data.lateEntryMinutes
          : minutesLate > GRACE_PERIOD_MINUTES;
        if (lateBlocked) {
          setCountdown(null);
          setAvailableMinutes(null);
          return 'blocked';
        }
      }
      if (sessionRemainingSecs < examDurationSecs) {
        setAvailableMinutes(Math.floor(sessionRemainingSecs / 60));
        setCountdown(null);
        return 'reduced_time';
      }
      setCountdown(null);
      setAvailableMinutes(null);
      return 'ok';
    }

    setCountdown(null);
    setAvailableMinutes(null);
    return 'blocked';
  }, []);

  const syncVerification = () => {
    const data = technicalVerificationService.getVerificationState();
    if (data) setVerificationData({ ...data });
  };

  // ── Mic level monitor ─────────────────────────────────────────────────────

  const stopMicLevelMonitor = () => {
    if (micAnimFrameRef.current) cancelAnimationFrame(micAnimFrameRef.current);
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    micAudioCtxRef.current?.close();
    micAudioCtxRef.current = null;
    setMicLiveLevel(0);
  };

  const startMicLevelMonitor = async () => {
    stopMicLevelMonitor();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const ctx = new AudioContext();
      micAudioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setMicLiveLevel(avg / 255);
        micAnimFrameRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Si no hay acceso, el monitor simplemente no arranca — no rompe nada
    }
  };

  useEffect(() => () => stopMicLevelMonitor(), []);

  // ── Initialization ────────────────────────────────────────────────────────

  const startAutomaticChecks = useCallback(async (sync: () => void) => {
    await technicalVerificationService.checkBrowserCompatibility();
    sync();
    await new Promise((r) => setTimeout(r, 500));
    await technicalVerificationService.checkScreenResolution();
    sync();
    await new Promise((r) => setTimeout(r, 500));
    await technicalVerificationService.checkInternetConnection();
    sync();
  }, []);

  const initializeExamPreparation = useCallback(
    async (id: string) => {
      try {
        setLoading(true);
        setError(null);

        const exams = await studentExamService.getNextExams();
        const exam =
          exams.find(
            (e) => e.examId === id || e.sessionId === id || e.id === id
          ) ?? exams[0];

        if (!exam) {
          setError("No se encontró el examen especificado.");
          return;
        }
        setExamData(exam);

        const computedStatus = computeEntryStatus(exam);
        setEntryStatus(computedStatus);

        // Don't initialize verification for sessions not yet accessible
        if (computedStatus === 'too_early' || computedStatus === 'blocked') {
          return;
        }

        const candidateId =
          (await technicalVerificationService.getCandidateId()) ?? "";

        // Store A (session-manager-service's own Redis record) is the single
        // source of truth for "already verified" — self-check against the
        // authenticated user's real verification via canUserProceed(). This
        // replaces the old identity-service technicalSetup lookup (Store B,
        // removed — it was a separate, unauthenticated-by-ownership cache
        // that exam-service's gate never actually read).
        const authUserId = authSDK.getCurrentUser()?.id;
        const proceedCheck = authUserId
          ? await sessionManagerTechnicalService.canUserProceedWithReasons(authUserId)
          : { canProceed: false, reasons: [] };
        const alreadyVerified = proceedCheck.canProceed;

        if (!alreadyVerified) {
          // Tell the candidate WHY they're verifying again instead of
          // silently restarting the checks — most commonly because their
          // previous verification's Redis record expired or was never found
          // (first-time visit is also NOT_FOUND, so only show this when a
          // prior verification clearly lapsed rather than never existing).
          const expiredReason = proceedCheck.reasons.find(
            (r) => r.code === 'EXPIRED' || r.code === 'NOT_FOUND'
          );
          if (expiredReason) {
            toast.info('Tu verificación anterior venció, vuelve a verificar tu equipo.', { duration: 6000 });
          }
        }

        if (alreadyVerified) {
          toast.info("Verificación técnica ya completada anteriormente");
          if (computedStatus === 'prep_window') {
            return; // Session not started yet, stay on prep page
          }
          // Iniciar sesión directamente
          const sessionData = {
            sessionId: exam.sessionId,
            examId: exam.examId,
            startTime: new Date().toISOString(),
            browserLockdown: exam.browserLockdown ?? false,
          };
          setSessionData(sessionData);
          const isAdaptive =
            exam.exam?.type === "placement" &&
            exam.exam?.placementConfig?.mode === "adaptive";
          if (isAdaptive) {
            navigate(`/student/exam/${exam.sessionId}/adaptive`, { replace: true });
            return;
          }
          try {
            const startResult = await examService.startExam(exam.sessionId);
            if (startResult?.success) {
              navigate(`/student/exam/${exam.sessionId}`, { replace: true });
              return;
            }
          } catch (startErr: any) {
            const technicalInfo = getTechnicalVerificationRequiredInfo(startErr);
            if (technicalInfo) {
              // Store A's self-check preview said yes but exam-service's
              // authoritative gate said no (e.g. it also requires a
              // microphone check this preview doesn't run) — fall through
              // to the normal verification flow below instead of leaving
              // the candidate stuck.
              setVerificationBlocked(technicalInfo.reasons);
            } else {
              throw startErr;
            }
          }
        }

        // Inicializar en session-manager (retorna el verificationId directamente como string)
        const initVerificationId =
          await sessionManagerTechnicalService.initializeVerification(
            exam.sessionId
          );
        if (initVerificationId) {
          setVerificationId(initVerificationId);
          // The backend gate reads these from its own record, so tell it what
          // this browser and machine are before any check runs.
          await sessionManagerTechnicalService.reportEnvironment(initVerificationId);
          // The connection flag is only set by the backend's own test, and the
          // automatic checks below are local, so run it here too instead of
          // waiting for the student to press the manual button.
          try {
            await sessionManagerTechnicalService.performNetworkTest(initVerificationId);
          } catch (networkError) {
            console.error('No se pudo registrar la prueba de red:', networkError);
          }
        }

        // Inicializar servicio local
        const initialData = await technicalVerificationService.initializeVerification(
          id,
          candidateId
        );
        setVerificationData({ ...initialData });

        await startAutomaticChecks(syncVerification);
      } catch (err) {
        console.error("Error initializing exam preparation:", err);
        setError("Error al inicializar la verificación técnica.");
      } finally {
        setLoading(false);
      }
    },
    [startAutomaticChecks, navigate, setSessionData, computeEntryStatus]
  );

  useEffect(() => {
    if (examId) initializeExamPreparation(examId);
  }, [examId]);

  // ── Countdown tick for prep_window ────────────────────────────────────────
  useEffect(() => {
    if (entryStatus !== 'prep_window') return;
    const interval = setInterval(() => {
      setCountdown(prev => (prev === null || prev <= 0) ? 0 : prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [entryStatus]);

  // Re-fetch when countdown hits 0 to detect session going in_progress
  useEffect(() => {
    if (countdown !== 0 || entryStatus !== 'prep_window' || !examId) return;
    studentExamService.getNextExams().then(exams => {
      const exam = exams.find(e => e.examId === examId || e.sessionId === examId || e.id === examId) ?? exams[0];
      if (exam) {
        setExamData(exam);
        setEntryStatus(computeEntryStatus(exam));
      }
    });
  }, [countdown, entryStatus, examId, computeEntryStatus]);

  // ── Socket: re-compute on session status change ───────────────────────────
  useEffect(() => {
    if (!examData) return;
    const sessionId = examData.sessionId;
    const handler = (data: any) => {
      if (data.sessionId !== sessionId) return;
      studentExamService.getNextExams().then(exams => {
        const exam = exams.find(e => e.sessionId === sessionId) ?? exams[0];
        if (exam) {
          setExamData(exam);
          setEntryStatus(computeEntryStatus(exam));
        }
      });
    };
    notificationSocket.on('session.status.changed', handler);

    // notifications-service creates the in-app notification with type
    // 'session.candidate.kicked' (see kafka-consumer.service.ts) — accept
    // both that and the older 'candidate.kicked' string so this doesn't
    // regress again if either side changes independently.
    const handleKicked = (data: any) => {
      if (data?.type === 'candidate.kicked' || data?.type === 'session.candidate.kicked') {
        toast.error('Has sido expulsado de la sesión por el administrador.', { duration: 6000 });
        navigate('/student/dashboard');
      }
    };
    notificationSocket.on('notification.created', handleKicked);

    // Also listen to the dedicated socket event directly, scoped to this
    // exam's session — it's pushed alongside (or instead of, if the
    // in-app notification write races) the notification.created event.
    const handleKickedSocket = (data: any) => {
      if (String(data?.sessionId) !== String(sessionId)) return;
      toast.error('Has sido expulsado de la sesión por el administrador.', { duration: 6000 });
      navigate('/student/dashboard');
    };
    notificationSocket.on('session.candidate.kicked', handleKickedSocket);

    return () => {
      notificationSocket.off('session.status.changed', handler);
      notificationSocket.off('notification.created', handleKicked);
      notificationSocket.off('session.candidate.kicked', handleKickedSocket);
    };
  }, [examData?.sessionId, computeEntryStatus, navigate]);

  // ── Manual tests ──────────────────────────────────────────────────────────

  const testInternetConnectivity = async () => {
    if (!verificationId) {
      toast.error("ID de verificación no disponible");
      return;
    }
    setIsTestingInternet(true);
    try {
      const result =
        await sessionManagerTechnicalService.performNetworkTest(verificationId);
      const quality =
        result.latency < 100 && result.downloadSpeed >= 5
          ? "excellent"
          : result.latency < 300 && result.downloadSpeed >= 1
          ? "good"
          : result.latency < 600
          ? "fair"
          : "poor";
      const networkStatus: NetworkQuality["status"] =
        quality === "poor" ? "error" : quality === "fair" ? "warning" : "success";
      technicalVerificationService.updateCheck(
        "Conexión a Internet",
        networkStatus,
        `Latencia: ${result.latency}ms · Velocidad: ${result.downloadSpeed.toFixed(1)} Mbps`
      );
      syncVerification();
      // La fila del chequeo ya muestra el resultado.
    } catch {
      technicalVerificationService.updateCheck(
        "Conexión a Internet",
        "error",
        "No se pudo verificar la conexión"
      );
      syncVerification();
      toast.error("Error al probar la conexión");
    } finally {
      setIsTestingInternet(false);
    }
  };

  const handleMicrophoneTest = async () => {
    if (!verificationId) {
      toast.error("ID de verificación no disponible");
      return;
    }
    setIsTestingMic(true);
    try {
      const result =
        await sessionManagerTechnicalService.performMicrophoneTest(
          verificationId
        );
      await technicalVerificationService.requestMicrophonePermission();
      setMicResult({
        level: result.level,
        isWorking: result.isWorking,
        isRecording: false,
      });
      technicalVerificationService.updateCheck(
        "Micrófono",
        result.isWorking ? "success" : "error",
        result.isWorking
          ? `Detectado · Nivel: ${Math.round(result.level * 100)}%`
          : "No detectamos sonido: habla durante la prueba o revisa el permiso"
      );
      syncVerification();
      if (result.isWorking) {
        // La fila del chequeo ya muestra "Correcto".
        startMicLevelMonitor();
        // The server now has a working microphone on THIS verification. If
        // the microphone was the only reason the start was refused, lift the
        // block so "Comenzar Examen" can use it right away.
        setVerificationBlocked((prev) =>
          prev && prev.every((r) => r.code === 'MICROPHONE_FAILED') ? null : prev
        );
      } else {
        toast.error("No se detectó micrófono");
      }
    } catch {
      technicalVerificationService.updateCheck(
        "Micrófono",
        "error",
        "Error al acceder al micrófono"
      );
      syncVerification();
      toast.error("Error al probar el micrófono");
    } finally {
      setIsTestingMic(false);
    }
  };

  const startAudioTest = async () => {
    setIsTestingAudio(true);
    setAudioTestStep("playing");
    try {
      await technicalVerificationService.playTestTone(440, 3);
      setAudioTestStep("waiting-confirmation");
    } catch {
      toast.error("Error al reproducir el tono de prueba");
      setAudioTestStep("idle");
      setIsTestingAudio(false);
    }
  };

  const confirmAudioTest = async (canHear: boolean) => {
    await technicalVerificationService.confirmAudioTest(canHear);
    syncVerification();
    setAudioTestStep("idle");
    setIsTestingAudio(false);
    // El éxito ya se ve en la fila del chequeo; sólo el problema necesita aviso.
    if (!canHear) toast.warning("Verifica tus auriculares o altavoces");
  };

  // Cámara — deshabilitada por ahora
  // const handleCameraTest = async () => {
  //   if (!verificationId) return;
  //   setIsTestingCamera(true);
  //   try {
  //     const result = await sessionManagerTechnicalService.performCameraTest(verificationId);
  //     await technicalVerificationService.requestCameraPermission();
  //     setCameraResult({ hasPermission: result.hasPermission, isActive: result.isWorking, resolution: result.resolution });
  //     technicalVerificationService.updateCheck("Cámara Web", result.isWorking ? "success" : "error", `${result.resolution.width}x${result.resolution.height}`);
  //     syncVerification();
  //   } catch { ... }
  //   finally { setIsTestingCamera(false); }
  // };

  // ── Start exam ────────────────────────────────────────────────────────────

  const handleStartExam = async () => {
    if (isStarting || !examData) return;

    // Fullscreen must be requested synchronously from a user gesture — this
    // click is that gesture. Fire it before any `await` below so the
    // browser still considers it "in response to" the click; do it before
    // setIsStarting/setVerificationBlocked too, since those state updates
    // are synchronous and harmless to the gesture but keep this the very
    // first thing that happens. Best-effort: if the session doesn't have
    // browserLockdown on, or the browser rejects it, this is a no-op.
    if (examData.browserLockdown) {
      try {
        const el = document.documentElement as any;
        const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        req?.call(el)?.catch(() => { /* ignore — useBrowserLockdown's overlay covers re-entry */ });
      } catch {
        // Fullscreen API unavailable — ignore, lockdown degrades gracefully.
      }
    }

    setIsStarting(true);
    setVerificationBlocked(null);
    try {
      // Finalizar sesión de verificación técnica — sessionManagerTechnicalService
      // (Store A) es la única fuente de verdad; ya no se replica en
      // identity-service (ver technicalVerificationService.ts, métodos
      // technicalVerificationExists/submitVerificationToBackend removidos).
      if (verificationId) {
        await sessionManagerTechnicalService.finalizeVerification(verificationId);
      }

      const sessionId = examData.sessionId || examId || "";

      setSessionData({
        sessionId,
        browserLockdown: examData.browserLockdown ?? false,
      });

      const isAdaptive =
        examData.exam?.type === "placement" &&
        examData.exam?.placementConfig?.mode === "adaptive";

      if (isAdaptive) {
        navigate(`/student/exam/${sessionId}/adaptive`, { replace: true });
        return;
      }

      const startResult = await examService.startExam(sessionId);
      if (!startResult?.success) {
        toast.error("No se pudo iniciar el examen. Intenta de nuevo.");
        return;
      }

      // replace: true so the back button doesn't return to preparation
      navigate(`/student/exam/${sessionId}`, { replace: true });
    } catch (err: any) {
      console.error("Error starting exam:", err);
      if (err?.response?.data?.code === "CANDIDATE_REMOVED") {
        toast.error("Has sido expulsado de esta sesión por el supervisor.", { duration: 6000 });
        navigate("/student/dashboard");
        return;
      }
      const technicalInfo = getTechnicalVerificationRequiredInfo(err);
      if (technicalInfo) {
        setVerificationBlocked(technicalInfo.reasons);
      } else if (err?.response?.data?.code === "TECHNICAL_GATE_UNAVAILABLE") {
        // session-manager-service is reachable but misconfigured/erroring —
        // fails closed with a specific student-facing message (see
        // exam-service session-manager.integration.ts).
        toast.error(err.response.data.message || "No se pudo validar la verificación técnica. Avisa al supervisor.", { duration: 8000 });
      } else {
        toast.error("Error al iniciar el examen");
      }
    } finally {
      setIsStarting(false);
    }
  };

  // Server said no despite passing local checks — let the candidate redo
  // the technical verification from scratch (fresh Store A record).
  const resetVerification = () => {
    const reasons = verificationBlocked ?? [];
    setVerificationBlocked(null);
    // Starting over creates a NEW verification record, which throws away any
    // check already sent (e.g. the microphone test). Only do that when the
    // current record is gone; otherwise retry the start against it.
    const mustRestart =
      !verificationId || reasons.some((r) => r.code === 'EXPIRED' || r.code === 'NOT_FOUND');
    if (mustRestart) {
      if (examId) initializeExamPreparation(examId);
      return;
    }
    handleStartExam();
  };

  // ── Action button per check ───────────────────────────────────────────────

  const renderCheckAction = (check: TechnicalCheck) => {
    const btnBase =
      "h-7 px-3 text-xs border border-border bg-transparent text-muted-foreground hover:border-border/80 hover:bg-muted rounded-md flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:pointer-events-none";

    if (check.name === "Conexión a Internet") {
      return (
        <button
          onClick={testInternetConnectivity}
          disabled={isTestingInternet || check.status === "checking"}
          className={btnBase}
        >
          {isTestingInternet ? (
            <Spinner className="h-3 w-3" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Probar
        </button>
      );
    }
    if (check.name === "Micrófono") {
      return (
        <button
          onClick={handleMicrophoneTest}
          disabled={isTestingMic || check.status === "checking"}
          className={btnBase}
        >
          {isTestingMic ? (
            <Spinner className="h-3 w-3" />
          ) : (
            <Mic className="h-3 w-3" />
          )}
          Probar
        </button>
      );
    }
    if (check.name === "Auriculares/Altavoces") {
      return (
        <button
          onClick={startAudioTest}
          disabled={isTestingAudio || check.status === "checking"}
          className={btnBase}
        >
          {isTestingAudio && audioTestStep === "playing" ? (
            <Spinner className="h-3 w-3" />
          ) : (
            <Volume2 className="h-3 w-3" />
          )}
          Probar audio
        </button>
      );
    }
    return null;
  };

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <MainLayout>
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Spinner className="h-7 w-7 text-blue-500" />
            <p className="text-sm">Inicializando verificación técnica...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="flex h-full items-center justify-center p-4">
          <div className="max-w-md w-full space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ── Entry status helpers & early returns ─────────────────────────────────

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (entryStatus === 'too_early' && examData) {
    const startTs = new Date(examData.rawStartDate).toLocaleString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    });
    return (
      <MainLayout>
        <div className="relative flex h-full flex-col items-center justify-center gap-6 p-4">
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <div className="w-full max-w-md rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-8 text-center">
            <Clock className="h-10 w-10 text-blue-500 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-blue-800 dark:text-blue-200 mb-2">
              Aún no es el momento
            </h2>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-1">
              La sesión <strong>{examData.name}</strong> inicia el
            </p>
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-100 capitalize mb-4">
              {startTs}
            </p>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/60">
              Vuelve {PREP_WINDOW_MINUTES} minutos antes para verificar tus periféricos.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (entryStatus === 'blocked' && examData) {
    return (
      <MainLayout>
        <div className="relative flex h-full flex-col items-center justify-center gap-6 p-4">
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <div className="w-full max-w-md rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-8 text-center">
            <XCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <h2 className="text-base font-semibold text-red-800 dark:text-red-200 mb-2">
              Acceso no permitido
            </h2>
            <p className="text-sm text-red-700 dark:text-red-300">
              No se permite la entrada tardía a esta sesión. El período de acceso ha finalizado.
            </p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  //
  // Full-height two-pane layout: the system checks own the left pane (they're
  // the thing the candidate repeatedly interacts with, so they get the most
  // room and their own scroll), the right pane holds the session summary and
  // instructions with the start action pinned below it — outside the
  // scrollable area — so it's always reachable without scrolling on a
  // 1280x800 screen.

  return (
    <MainLayout>
      <div className="flex h-full flex-col gap-4 p-4 lg:p-6">
        {/* Back button + exam title — compact header row */}
        <div className="shrink-0 space-y-3">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </button>

          {entryStatus === 'prep_window' && (
            <div className="rounded-xl border border-yellow-200 dark:border-yellow-500/30 bg-yellow-50 dark:bg-yellow-500/10 p-4 flex items-start gap-3">
              <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  La sesión inicia en{' '}
                  <span className="font-mono">{countdown !== null ? formatCountdown(countdown) : '--:--'}</span>
                </p>
                <p className="text-xs text-yellow-700/70 dark:text-yellow-400/60 mt-0.5">
                  Puedes verificar tus periféricos mientras esperas. El botón de inicio se habilitará cuando comience la sesión.
                </p>
              </div>
            </div>
          )}

          {entryStatus === 'reduced_time' && examData && (
            <div className="rounded-xl border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 p-4 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Tiempo disponible reducido</p>
                <p className="text-xs text-orange-700/80 dark:text-orange-300/80 mt-0.5">
                  Tendrás <strong>{availableMinutes} min</strong> disponibles — la sesión cierra a las{' '}
                  <strong>
                    {new Date(examData.rawEndDate).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </strong>.
                  El tiempo original del examen es <strong>{examData.examDurationMinutes} min</strong>.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          {/* ── LEFT: system checks — owns the pane, scrolls on its own ── */}
          <div className="flex min-h-0 flex-col border border-border bg-card/60 overflow-hidden">
            <div className="shrink-0 px-5 py-4 border-b border-border">
              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Verificación del sistema
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Revisa cada equipo antes de comenzar — el examen no se puede pausar.
                  </p>
                </div>
                {visibleChecks.length > 0 && (
                  <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground/80 tabular-nums">
                    {checksDoneCount}/{visibleChecks.length}
                  </span>
                )}
              </div>
              <Progress value={verificationProgress} className="h-1" />
            </div>

            {visibleChecks.length > 0 ? (
              <ul className="min-h-0 flex-1 overflow-auto divide-y divide-border/50 p-2">
                {visibleChecks.map((check) => {
                  const Icon = CHECK_ICONS[check.name] ?? Monitor;
                  const badge = STATUS_BADGE[check.status];
                  const isSettled = check.status === "success" || check.status === "warning";
                  const pendingHint =
                    check.status === "pending"
                      ? AUTOMATIC_CHECK_NAMES.has(check.name)
                        ? "Se verifica automáticamente."
                        : (PENDING_HINTS[check.name] ?? "Pendiente de verificar.")
                      : null;
                  return (
                    <Item
                      key={check.name}
                      render={<li />}
                      variant="default"
                      className={cn(
                        "items-start border-l-4 rounded-l-none",
                        STATUS_ACCENT[check.status],
                        isSettled && "opacity-90"
                      )}
                    >
                      <ItemMedia variant="icon" className="mt-0.5 h-8 w-8 rounded-lg bg-muted/80">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </ItemMedia>

                      <ItemContent>
                        <ItemTitle className="font-medium">{check.name}</ItemTitle>
                        {check.message &&
                          check.status !== "pending" &&
                          check.status !== "checking" && (
                            <p className="text-xs text-muted-foreground truncate">
                              {check.message}
                            </p>
                          )}
                        {pendingHint && (
                          <p className="text-xs text-muted-foreground/80 truncate">{pendingHint}</p>
                        )}
                        {check.status === "checking" && (
                          <p className="text-xs text-blue-600/80 dark:text-blue-400/70 truncate">
                            Verificando…
                          </p>
                        )}
                        {check.name === "Micrófono" && micResult?.isWorking && (
                          <MicLevelBars level={micLiveLevel} />
                        )}
                      </ItemContent>

                      <ItemActions className="flex-wrap justify-end gap-2">
                        {renderCheckAction(check)}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border",
                            badge.border,
                            badge.text,
                            badge.bg
                          )}
                        >
                          <CheckStatusIcon status={check.status} />
                          {STATUS_LABEL[check.status]}
                        </span>
                      </ItemActions>
                    </Item>
                  );
                })}
              </ul>
            ) : (
              <div className="flex flex-1 items-center justify-center py-12 text-muted-foreground text-sm">
                <Spinner className="h-4 w-4 mr-2" />
                Cargando verificaciones...
              </div>
            )}

            {/* Audio confirmation (inline, aparece tras reproducir tono) */}
            {audioTestStep === "waiting-confirmation" && (
              <div className="shrink-0 mx-5 mb-4 p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/25">
                <p className="text-sm text-blue-700 dark:text-blue-200 mb-3">
                  Se reprodujo un tono a 440 Hz. ¿Pudiste escucharlo?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => confirmAudioTest(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-green-100 hover:bg-green-200 dark:bg-green-500/15 dark:hover:bg-green-500/25 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-500/30 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Sí, lo escuché
                  </button>
                  <button
                    onClick={() => confirmAudioTest(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    No escuché nada
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT: session summary + instructions (scrolls), start action pinned below ── */}
          <div className="flex min-h-0 flex-col gap-4">
            <div className="min-h-0 flex-1 overflow-auto space-y-4 pr-0.5">
              {examData && (
                <div className="border border-border bg-card/60 p-5">
                  <h1 className="text-base font-semibold text-foreground leading-snug">
                    {examData.name}
                  </h1>

                  {/* Session facts — scannable at a glance instead of a
                      stacked list, so the candidate reads all of it in one
                      pass instead of one line at a time. */}
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 mt-3">
                    {examData.date && (
                      <div className="flex items-start gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Fecha</dt>
                          <dd className="text-xs text-foreground/90 truncate">{examData.date}</dd>
                        </div>
                      </div>
                    )}
                    {examData.time && (
                      <div className="flex items-start gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Hora</dt>
                          <dd className="text-xs text-foreground/90 truncate">{examData.time}</dd>
                        </div>
                      </div>
                    )}
                    {examData.duration && (
                      <div className="flex items-start gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Duración</dt>
                          <dd className="text-xs text-foreground/90 truncate">{examData.duration}</dd>
                        </div>
                      </div>
                    )}
                    {examData.level && (
                      <div className="flex items-start gap-1.5">
                        <GraduationCap className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Nivel</dt>
                          <dd className="text-xs text-foreground/90 truncate">{examData.level}</dd>
                        </div>
                      </div>
                    )}
                    {examData.exam?.type === 'placement' &&
                      examData.exam?.placementConfig?.mode === 'adaptive' &&
                      examData.exam?.placementConfig?.maxQuestions && (
                      <div className="flex items-start gap-1.5">
                        <Info className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Preguntas</dt>
                          <dd className="text-xs text-foreground/90 truncate">
                            Hasta {examData.exam.placementConfig.maxQuestions} (adaptativo)
                          </dd>
                        </div>
                      </div>
                    )}
                    {examData.createdBy && (
                      <div className="flex items-start gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground/70 flex-shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground/60">Docente</dt>
                          <dd className="text-xs text-foreground/90 truncate">
                            {examData.createdBy.firstName} {examData.createdBy.lastName}
                          </dd>
                        </div>
                      </div>
                    )}
                  </dl>

                  {/* Browser-lockdown disclosure — the candidate must know
                      BEFORE starting that leaving fullscreen gets recorded,
                      not discover it mid-exam. */}
                  <div
                    className={cn(
                      "mt-3.5 flex items-start gap-2 rounded-lg border px-3 py-2.5",
                      examData.browserLockdown
                        ? "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
                        : "border-border bg-muted/40"
                    )}
                  >
                    <Monitor
                      className={cn(
                        "h-3.5 w-3.5 flex-shrink-0 mt-0.5",
                        examData.browserLockdown ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
                      )}
                    />
                    <p
                      className={cn(
                        "text-xs leading-relaxed",
                        examData.browserLockdown
                          ? "text-amber-800 dark:text-amber-200"
                          : "text-muted-foreground"
                      )}
                    >
                      {examData.browserLockdown ? (
                        <>
                          Este examen se rinde en <strong>pantalla completa</strong>. Salir de ella durante
                          el examen queda registrado como una infracción.
                        </>
                      ) : (
                        "Este examen no bloquea el navegador."
                      )}
                    </p>
                  </div>
                </div>
              )}

              <details className="group border border-border bg-card/60 overflow-hidden">
                <summary className="flex items-center justify-between px-5 py-3.5 cursor-pointer list-none select-none">
                  <span className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                    <Info className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                    Instrucciones importantes
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground/60 transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-4 pt-3 border-t border-border">
                  <ul className="space-y-2.5">
                    {[
                      "Asegúrate de estar en un lugar tranquilo y sin interrupciones.",
                      "Cierra todas las aplicaciones innecesarias antes de iniciar.",
                      "Mantén tu conexión a internet activa durante todo el examen.",
                      "No cierres el navegador ni la pestaña durante el examen.",
                      "Responde todas las preguntas dentro del tiempo asignado.",
                      "Usa auriculares para las secciones de listening.",
                    ].map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-500/60 dark:text-blue-400/50 flex-shrink-0 mt-0.5" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </details>

              {verificationBlocked && (
                <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-red-800 dark:text-red-200">
                        No es posible iniciar el examen
                      </h3>
                      <p className="text-xs text-red-700/80 dark:text-red-300/80 mt-0.5">
                        El servidor rechazó la verificación técnica por los siguientes motivos:
                      </p>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-4">
                    {verificationBlocked.map((reason) => (
                      <li
                        key={reason.code}
                        className="text-xs bg-red-100/60 dark:bg-red-500/10 rounded-md px-3 py-2"
                      >
                        <p className="font-medium text-red-800 dark:text-red-200">
                          {reason.message}
                        </p>
                        {TECHNICAL_REASON_HINTS[reason.code] && (
                          <p className="text-red-600/80 dark:text-red-400/70 mt-0.5">
                            {TECHNICAL_REASON_HINTS[reason.code]}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={resetVerification}
                    className="w-full h-9 flex items-center justify-center gap-1.5 rounded-md border border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-300 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Volver a verificar
                  </button>
                </div>
              )}
            </div>

            {/* Start exam — outside the scroll area, always visible. The
                button is the one thing to do on this screen, so whatever is
                keeping it disabled is always spelled out below it — never a
                generic "complete the checks" line. */}
            <div className="shrink-0 border border-border bg-card/60 p-5">
              <Button
                onClick={handleStartExam}
                disabled={
                  !canProceed ||
                  isStarting ||
                  !!verificationBlocked ||
                  entryStatus === 'blocked' ||
                  entryStatus === 'too_early' ||
                  entryStatus === 'prep_window'
                }
                className="w-full h-10 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isStarting ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    {examData?.myAttemptStatus === 'in_progress' ? 'Reconectando...' : 'Iniciando examen...'}
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    {examData?.myAttemptStatus === 'in_progress' ? 'Continuar Examen' : 'Comenzar Examen'}
                  </>
                )}
              </Button>

              {!isStarting && verificationBlocked && (
                <p className="text-xs text-red-600/80 dark:text-red-400/70 text-center mt-2.5">
                  El servidor rechazó la verificación — revisa los motivos arriba.
                </p>
              )}
              {!isStarting && !verificationBlocked && entryStatus === 'prep_window' && (
                <p className="text-xs text-yellow-600/70 dark:text-yellow-400/60 text-center mt-2.5">
                  La sesión aún no ha comenzado — el botón se habilita solo.
                </p>
              )}
              {!isStarting && !verificationBlocked && entryStatus !== 'prep_window' && !canProceed && missingRequiredChecks.length > 0 && (
                <p className="text-xs text-muted-foreground text-center mt-2.5">
                  Falta completar: <strong className="text-foreground/80">{missingRequiredChecks.join(', ')}</strong>
                </p>
              )}
              {canProceed && !isStarting && !verificationBlocked && entryStatus !== 'prep_window' && (
                <p className="text-xs text-green-600/70 dark:text-green-400/60 text-center mt-2.5">
                  Sistema listo — todas las verificaciones completadas
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ExamPreparation;
