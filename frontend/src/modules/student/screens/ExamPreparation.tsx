import { Alert, AlertDescription } from "@/components/atoms/alert";
import { Button } from "@/components/atoms/button";
import { Progress } from "@/components/atoms/progress";
import { MainLayout } from "@/components/layout";
import { cn } from "@/lib/utils";
import { examService } from "@/services/examService";
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
  Loader2,
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
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { studentExamService, type NextExamData } from "../services/examService";
import sessionManagerTechnicalService from "../services/sessionManagerTechnicalService";
import {
  technicalVerificationService,
  type TechnicalCheck,
  type TechnicalVerificationData,
} from "../services/technicalVerificationService";
import { TECH_CHECK_KEY } from "../components/SystemCheckPanel";

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function CheckStatusIcon({ status }: { status: TechnicalCheck["status"] }) {
  if (status === "pending")
    return (
      <div className="h-3.5 w-3.5 rounded-full border-2 border-border flex-shrink-0" />
    );
  if (status === "checking")
    return <Loader2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />;
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
  const setSessionData = useExamStore((s) => s.setSessionData);

  // Core state
  const [examData, setExamData] = useState<NextExamData | null>(null);
  const [verificationData, setVerificationData] =
    useState<TechnicalVerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

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

        // Chequear primero si hizo la prueba técnica anticipada desde el dashboard
        const preChecked = sessionStorage.getItem(TECH_CHECK_KEY(exam.sessionId)) === '1';

        // Si ya completó la verificación técnica (pre-check o backend), ir directo al examen
        const alreadyVerified =
          preChecked ||
          await technicalVerificationService.technicalVerificationExists(
            exam.sessionId
          );
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
          } else {
            const startResult = await examService.startExam(exam.sessionId);
            if (startResult?.success) navigate(`/student/exam/${exam.sessionId}`, { replace: true });
          }
          return;
        }

        // Inicializar en session-manager (retorna el verificationId directamente como string)
        const initVerificationId =
          await sessionManagerTechnicalService.initializeVerification(
            exam.sessionId
          );
        if (initVerificationId) {
          setVerificationId(initVerificationId);
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

    const handleKicked = (data: any) => {
      if (data?.type === 'candidate.kicked') {
        toast.error('Has sido expulsado de la sesión por el administrador.', { duration: 6000 });
        navigate('/student/dashboard');
      }
    };
    notificationSocket.on('notification.created', handleKicked);

    return () => {
      notificationSocket.off('session.status.changed', handler);
      notificationSocket.off('notification.created', handleKicked);
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
      toast.success("Prueba de conexión completada");
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
          : "Micrófono no detectado o sin permiso"
      );
      syncVerification();
      if (result.isWorking) {
        toast.success("Micrófono funcionando correctamente");
        startMicLevelMonitor();
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
    if (canHear) toast.success("Audio verificado correctamente");
    else toast.warning("Verifica tus auriculares o altavoces");
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
    setIsStarting(true);
    try {
      // Guardar verificación en backend
      await technicalVerificationService.submitVerificationToBackend();

      // Finalizar sesión de verificación técnica
      if (verificationId) {
        await sessionManagerTechnicalService.finalizeVerification(verificationId);
      }

      const sessionId = examData.sessionId || examId || "";

      setSessionData({
        sessionId,
        examId: examData.examId || examId || "",
        startTime: new Date().toISOString(),
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
    } catch (err) {
      console.error("Error starting exam:", err);
      toast.error("Error al iniciar el examen");
    } finally {
      setIsStarting(false);
    }
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
            <Loader2 className="h-3 w-3 animate-spin" />
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
            <Loader2 className="h-3 w-3 animate-spin" />
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
            <Loader2 className="h-3 w-3 animate-spin" />
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
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
            <p className="text-sm">Inicializando verificación técnica...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center p-4">
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
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-8 text-center">
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
        <div className="max-w-2xl mx-auto px-4 py-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Volver
          </button>
          <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-8 text-center">
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

  return (
    <MainLayout>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </button>

        {/* Exam info */}
        {examData && (
          <div className="mb-5 rounded-xl border border-border bg-card/60 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-foreground leading-snug">
                  {examData.name}
                </h1>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
                  {examData.date && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {examData.date}
                    </span>
                  )}
                  {examData.time && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {examData.time}
                    </span>
                  )}
                  {examData.duration && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 opacity-50" />
                      {examData.duration}
                    </span>
                  )}
                  {examData.level && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <GraduationCap className="h-3.5 w-3.5" />
                      Nivel {examData.level}
                    </span>
                  )}
                </div>
              </div>
              {examData.createdBy && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60 flex-shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5" />
                  {examData.createdBy.firstName} {examData.createdBy.lastName}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Entry status banners */}
        {entryStatus === 'prep_window' && (
          <div className="mb-5 rounded-xl border border-yellow-200 dark:border-yellow-500/30 bg-yellow-50 dark:bg-yellow-500/10 p-4 flex items-start gap-3">
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
          <div className="mb-5 rounded-xl border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 p-4 flex items-start gap-3">
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

        {/* Verification card */}
        <div className="mb-5 rounded-xl border border-border bg-card/60 overflow-hidden">

          {/* Header with progress */}
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-sm font-semibold text-foreground">
                Verificación del sistema
              </h2>
              <span className="text-xs text-muted-foreground font-medium tabular-nums">
                {verificationProgress}%
              </span>
            </div>
            <Progress value={verificationProgress} className="h-1" />
          </div>

          {/* Check rows */}
          {visibleChecks.length > 0 ? (
            <ul className="divide-y divide-border/50">
              {visibleChecks.map((check) => {
                const Icon = CHECK_ICONS[check.name] ?? Monitor;
                const badge = STATUS_BADGE[check.status];
                return (
                  <li key={check.name} className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {/* Type icon */}
                      <div className="h-8 w-8 rounded-lg bg-muted/80 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>

                      {/* Name + message */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight">
                          {check.name}
                        </p>
                        {check.message &&
                          check.status !== "pending" &&
                          check.status !== "checking" && (
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {check.message}
                            </p>
                          )}
                        {/* Mic live level visualizer — solo aparece tras test exitoso */}
                        {check.name === "Micrófono" && micResult?.isWorking && (
                          <MicLevelBars level={micLiveLevel} />
                        )}
                      </div>

                      {/* Action + status */}
                      <div className="flex items-center gap-2 flex-shrink-0">
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
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Cargando verificaciones...
            </div>
          )}

          {/* Audio confirmation (inline, aparece tras reproducir tono) */}
          {audioTestStep === "waiting-confirmation" && (
            <div className="mx-5 mb-4 p-4 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/25">
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

        {/* Instructions collapsible */}
        <details className="mb-5 group rounded-xl border border-border bg-card/60 overflow-hidden">
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

        {/* Start exam */}
        <div className="rounded-xl border border-border bg-card/60 p-5">
          {!canProceed && visibleChecks.length > 0 && (
            <p className="text-xs text-muted-foreground text-center mb-4">
              Completa todas las verificaciones requeridas para continuar
            </p>
          )}
          <Button
            onClick={handleStartExam}
            disabled={
              !canProceed ||
              isStarting ||
              entryStatus === 'blocked' ||
              entryStatus === 'too_early' ||
              entryStatus === 'prep_window'
            }
            className="w-full h-10 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isStarting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {examData?.myAttemptStatus === 'in_progress' ? 'Reconectando...' : 'Iniciando examen...'}
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                {examData?.myAttemptStatus === 'in_progress' ? 'Continuar Examen' : 'Comenzar Examen'}
              </>
            )}
          </Button>
          {entryStatus === 'prep_window' && (
            <p className="text-xs text-yellow-600/70 dark:text-yellow-400/60 text-center mt-2.5">
              La sesión aún no ha comenzado
            </p>
          )}
          {canProceed && !isStarting && entryStatus !== 'prep_window' && (
            <p className="text-xs text-green-600/70 dark:text-green-400/60 text-center mt-2.5">
              Sistema listo — todas las verificaciones completadas
            </p>
          )}
        </div>

      </div>
    </MainLayout>
  );
};

export default ExamPreparation;
