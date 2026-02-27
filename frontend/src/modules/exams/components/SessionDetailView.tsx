import React, { useEffect, useState } from "react";
import { authSDK } from "@/services/sdk-simple-auth";
import {
  ArrowLeft,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  DoorOpen,
  Edit,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  Settings,
  Shield,
  TrendingUp,
  User2,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import type { ExamSession } from "../types";
import { Button } from "@/components/atoms/button";
import { candidateService } from "@/services/candidateService";
import { examService } from "@/services/examService";

// ── Tipos locales ────────────────────────────────────────────────────────────

interface SessionResult {
  id: string;
  candidateId: string;
  percentage: number;
  totalScore: number;
  maxScore: number;
  status: "completed" | "partial" | "pending_ai_review";
  examDuration: number;
  timeAllowed: number;
  competencyScores: Array<{
    competency: string;
    percentage: number;
    totalScore: number;
    maxScore: number;
  }>;
  recommendedLevel?: string;
  evaluatedAt: string;
}

interface QuestionResult {
  questionId: string;
  questionType: string;
  competency: string;
  response: any;
  isCorrect?: boolean;
  score: number;
  maxScore: number;
  feedback?: string;
  evaluationMethod: "automatic" | "ai_grading" | "manual";
  evaluatedAt?: string;
  aiAnalysis?: {
    criteria: Record<string, number>;
    feedback: string;
    suggestions: string[];
  };
  // Populated by admin endpoint
  questionData?: {
    questionText?: string;
    instructions?: string;
    context?: string;
    options?: Array<{ id: string; text: string; isCorrect?: boolean }>;
    items?: Array<{ id: string; content: string; correctPosition?: number; matchingPair?: string }>;
    template?: string;
    blanks?: Array<{ position: number; correctAnswers: string[]; caseSensitive?: boolean }>;
    correctAnswer?: string | string[];
    mediaUrl?: string;
    mediaType?: "audio" | "image" | "video";
  };
}

interface DetailedResult {
  _id: string;
  examName: string;
  examLevel: string;
  percentage: number;
  totalScore: number;
  maxScore: number;
  status: string;
  evaluatedAt: string;
  examDuration: number;
  timeAllowed: number;
  questionResults: QuestionResult[];
  competencyScores: Array<{
    competency: string;
    totalScore: number;
    maxScore: number;
    percentage: number;
    questionCount: number;
    autoEvaluatedCount: number;
    aiEvaluatedCount: number;
    pendingEvaluationCount: number;
  }>;
  overallFeedback?: string;
  recommendations?: string[];
  recommendedLevel?: string;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  session: ExamSession;
  onBack: () => void;
  onEdit: () => void;
  onManageCandidates: () => void;
}

// ── Helpers de detalle ────────────────────────────────────────────────────────

const typeLabel: Record<string, string> = {
  multiple_choice: "Múlt.",
  true_false: "V/F",
  fill_blanks: "Relleno",
  matching: "Emparej.",
  ordering: "Orden",
  drag_drop: "Arrastrar",
  essay: "Ensayo",
  open_text: "Texto",
  audio_response: "Audio",
};

const competencyColor: Record<string, string> = {
  reading: "bg-blue-900/30 text-blue-300 border-blue-700/40",
  writing: "bg-purple-900/30 text-purple-300 border-purple-700/40",
  listening: "bg-orange-900/30 text-orange-300 border-orange-700/40",
  speaking: "bg-green-900/30 text-green-300 border-green-700/40",
  grammar: "bg-teal-900/30 text-teal-300 border-teal-700/40",
  vocabulary: "bg-teal-900/30 text-teal-300 border-teal-700/40",
};

const competencyBarColor: Record<string, string> = {
  reading: "bg-blue-500",
  writing: "bg-purple-500",
  listening: "bg-orange-500",
  speaking: "bg-green-500",
  grammar: "bg-teal-500",
  vocabulary: "bg-teal-500",
};

function getCompetencyColor(competency: string): string {
  const key = competency.toLowerCase();
  return competencyColor[key] ?? "bg-gray-800 text-gray-300 border-gray-600";
}

function getCompetencyBarColor(competency: string): string {
  const key = competency.toLowerCase();
  return competencyBarColor[key] ?? "bg-gray-500";
}

function renderMedia(questionData?: QuestionResult["questionData"]): React.ReactNode {
  if (!questionData?.mediaUrl) return null;
  const url = questionData.mediaUrl;
  const type = questionData.mediaType
    ?? (url.match(/\.(mp3|wav|ogg|m4a|aac|opus)$/i) ? "audio"
      : url.match(/\.(mp4|webm|mov|avi)$/i) ? "video"
      : "image");

  if (type === "audio") {
    return (
      <div className="bg-gray-800/40 border border-line rounded-lg p-2">
        <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
          <span>🔊</span> Audio
        </p>
        <audio controls className="w-full h-8" style={{ colorScheme: "dark" }}>
          <source src={url} />
        </audio>
      </div>
    );
  }
  if (type === "video") {
    return (
      <div className="bg-gray-800/40 border border-line rounded-lg p-2">
        <p className="text-xs text-gray-500 mb-1.5">🎬 Video</p>
        <video controls className="w-full rounded max-h-48">
          <source src={url} />
        </video>
      </div>
    );
  }
  return (
    <div className="bg-gray-800/40 border border-line rounded-lg p-2">
      <img src={url} alt="Imagen de la pregunta" className="max-h-40 rounded object-contain" />
    </div>
  );
}

function renderResponse(qr: QuestionResult): React.ReactNode {
  const { questionType, response, questionData } = qr;
  const options = questionData?.options ?? [];

  if (!response) {
    return <p className="text-xs text-gray-500 italic">Sin respuesta registrada</p>;
  }

  switch (questionType) {
    case "multiple_choice": {
      const selected: string[] = response?.selectedOptions ?? [];
      if (options.length > 0) {
        return (
          <div className="space-y-1.5">
            {options.map((opt) => {
              const isSelected = selected.includes(String(opt.id));
              const isCorrect = !!opt.isCorrect;
              let cls = "border border-line bg-gray-800/40 text-gray-400";
              if (isSelected && isCorrect) cls = "border border-emerald-600/50 bg-emerald-900/20 text-emerald-300";
              else if (isSelected && !isCorrect) cls = "border border-red-600/50 bg-red-900/20 text-red-300";
              else if (!isSelected && isCorrect) cls = "border border-emerald-600/30 bg-emerald-900/10 text-emerald-400/60";
              return (
                <div key={opt.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${cls}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${isSelected ? "bg-current/20" : "bg-gray-700"}`}>
                    {isSelected ? "●" : "○"}
                  </span>
                  <span>{opt.text}</span>
                  {isCorrect && <span className="ml-auto text-emerald-400/70 text-xs">✓ correcta</span>}
                </div>
              );
            })}
          </div>
        );
      }
      const selected2: string[] = response?.selectedOptions ?? [];
      return <p className="text-xs text-gray-300 bg-gray-800/40 px-3 py-2 rounded-lg">Opción(es): {selected2.join(", ") || "—"}</p>;
    }

    case "true_false": {
      const ans = response?.answer;
      const userTrue = ans === true || ans === "true" || String(ans).toLowerCase() === "verdadero";
      const userFalse = ans === false || ans === "false" || String(ans).toLowerCase() === "falso";
      const correctOpt = (options).find(o => o.isCorrect);
      const correctIsTrue = correctOpt?.id?.toLowerCase() === "true" || correctOpt?.text?.toLowerCase() === "true" || correctOpt?.text?.toLowerCase() === "verdadero";
      return (
        <div className="flex gap-2">
          {["Verdadero", "Falso"].map((label) => {
            const isThisTrue = label === "Verdadero";
            const isSelected = isThisTrue ? userTrue : userFalse;
            const isCorrect = isThisTrue ? correctIsTrue : !correctIsTrue;
            let cls = "border border-line bg-gray-800/40 text-gray-400";
            if (isSelected && isCorrect) cls = "border border-emerald-600/50 bg-emerald-900/20 text-emerald-300 font-semibold";
            else if (isSelected && !isCorrect) cls = "border border-red-600/50 bg-red-900/20 text-red-300 font-semibold";
            else if (!isSelected && isCorrect) cls = "border border-emerald-600/30 bg-emerald-900/10 text-emerald-400/60";
            return (
              <div key={label} className={`px-4 py-2 rounded-lg text-xs ${cls}`}>
                {label}
              </div>
            );
          })}
        </div>
      );
    }

    case "fill_blanks": {
      const blanks: string[] = response?.blanks ?? [];
      if (blanks.length === 0) return <p className="text-xs text-gray-500 italic">Sin respuesta</p>;
      const correctBlanks = questionData?.blanks ?? [];
      return (
        <div className="flex flex-wrap gap-2">
          {blanks.map((b, i) => {
            const correctAnswers = correctBlanks[i]?.correctAnswers ?? [];
            const isOk = correctAnswers.length > 0
              ? correctAnswers.some(c => c.trim().toLowerCase() === b.trim().toLowerCase())
              : null;
            const cls = isOk === true
              ? "bg-emerald-900/20 border-emerald-600/40 text-emerald-300"
              : isOk === false
              ? "bg-red-900/20 border-red-600/40 text-red-300"
              : "bg-gray-800/40 border-line text-gray-300";
            return (
              <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs ${cls}`}>
                <span className="text-gray-500">[{i+1}]</span>
                <span className="font-medium">{b || "—"}</span>
                {isOk === false && correctAnswers.length > 0 && (
                  <span className="text-emerald-400/70 ml-1">✓ {correctAnswers[0]}</span>
                )}
              </span>
            );
          })}
        </div>
      );
    }

    case "matching": {
      const pairs: Record<string, string> = response?.pairs ?? {};
      const items = questionData?.items ?? [];
      if (Object.keys(pairs).length === 0) return <p className="text-xs text-gray-500 italic">Sin respuesta</p>;
      return (
        <div className="space-y-1">
          {Object.entries(pairs).map(([k, v]) => {
            const item = items.find(i => i.id === k);
            const isOk = item?.matchingPair === v;
            return (
              <div key={k} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${isOk ? "border-emerald-600/40 bg-emerald-900/10 text-emerald-300" : "border-red-600/40 bg-red-900/10 text-red-300"}`}>
                <span className="font-medium">{item?.content ?? k}</span>
                <span className="text-gray-500">→</span>
                <span>{v}</span>
                {!isOk && item?.matchingPair && <span className="ml-auto text-emerald-400/60">✓ {item.matchingPair}</span>}
              </div>
            );
          })}
        </div>
      );
    }

    case "ordering": {
      const order: string[] = response?.order ?? [];
      const items = questionData?.items ?? [];
      if (order.length === 0) return <p className="text-xs text-gray-500 italic">Sin respuesta</p>;
      return (
        <div className="space-y-1">
          {order.map((id, idx) => {
            const item = items.find(i => i.id === id);
            const correctPos = item?.correctPosition;
            const isOk = correctPos !== undefined ? correctPos === idx : null;
            return (
              <div key={id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${isOk === true ? "border-emerald-600/40 bg-emerald-900/10 text-emerald-300" : isOk === false ? "border-red-600/40 bg-red-900/10 text-red-300" : "border-line bg-gray-800/40 text-gray-300"}`}>
                <span className="text-gray-500 font-mono">#{idx+1}</span>
                <span>{item?.content ?? id}</span>
                {isOk === false && correctPos !== undefined && <span className="ml-auto text-emerald-400/60 text-xs">✓ pos {correctPos+1}</span>}
              </div>
            );
          })}
        </div>
      );
    }

    case "drag_drop": {
      // positions: { [itemId]: zoneIndex }
      const positions: Record<string, number> = response?.positions ?? {};
      const items = questionData?.items ?? [];
      if (Object.keys(positions).length === 0)
        return <p className="text-xs text-gray-500 italic">Sin respuesta</p>;

      // Sort entries by zone index assigned by user
      const sorted = Object.entries(positions).sort(([, a], [, b]) => a - b);
      return (
        <div className="space-y-1">
          {sorted.map(([itemId, zoneIdx]) => {
            const item = items.find(i => String(i.id) === String(itemId));
            const isOk =
              item?.correctPosition !== undefined
                ? item.correctPosition === zoneIdx
                : null;
            const cls =
              isOk === true
                ? "border-emerald-600/40 bg-emerald-900/10 text-emerald-300"
                : isOk === false
                ? "border-red-600/40 bg-red-900/10 text-red-300"
                : "border-line bg-gray-800/40 text-gray-300";
            return (
              <div
                key={itemId}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${cls}`}
              >
                <span className="text-gray-500 font-mono shrink-0">
                  Zona {zoneIdx + 1}
                </span>
                <span className="flex-1">{item?.content ?? `Item ${itemId}`}</span>
                {isOk === false && item?.correctPosition !== undefined && (
                  <span className="ml-auto text-emerald-400/60 shrink-0">
                    ✓ Zona {item.correctPosition + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    case "audio_response":
    case "speaking": {
      const rawUrl: string = response?.audioUrl ?? response?.url ?? response?.audio_url ?? '';
      // Rewrite internal Docker MinIO hostname to public URL accessible by browser
      const audioUrl: string = rawUrl
        ? rawUrl.replace(/^https?:\/\/minio(:\d+)?/, 'http://localhost:9000')
        : '';
      const transcription: string | undefined =
        response?.transcription ?? response?.text;
      if (!audioUrl && !transcription)
        return <p className="text-xs text-gray-500 italic">Sin audio registrado</p>;
      return (
        <div className="space-y-2">
          {audioUrl && (
            <div className="bg-gray-800/40 border border-line rounded-lg p-2.5">
              <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                🔊 Audio del candidato
              </p>
              <audio controls className="w-full" style={{ colorScheme: "dark" }}>
                <source src={audioUrl} type="audio/webm" />
                <source src={audioUrl} />
              </audio>
            </div>
          )}
          {transcription && (
            <div className="bg-gray-800/40 border border-line rounded-lg px-3 py-2">
              <p className="text-xs text-gray-500 mb-1">Transcripción</p>
              <p className="text-xs text-gray-200 whitespace-pre-wrap leading-relaxed">{transcription}</p>
            </div>
          )}
        </div>
      );
    }

    case "file_upload": {
      const fileUrl: string | undefined = response?.fileUrl ?? response?.url;
      if (!fileUrl)
        return <p className="text-xs text-gray-500 italic">Sin archivo</p>;
      return (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-blue-700/40 bg-blue-900/20 text-blue-300 hover:bg-blue-900/40 transition-colors"
        >
          📎 Ver archivo adjunto
        </a>
      );
    }

    case "essay":
    case "open_text": {
      const text = typeof response === "string" ? response : response?.text ?? response?.answer ?? response?.essay ?? "";
      return (
        <div className="bg-gray-800/40 border border-line rounded-lg px-3 py-2.5">
          <p className="text-xs text-gray-200 whitespace-pre-wrap leading-relaxed">{String(text) || "Sin texto"}</p>
        </div>
      );
    }

    default: {
      const str = typeof response === "string" ? response : JSON.stringify(response);
      return (
        <div className="bg-gray-800/40 border border-line rounded-lg px-3 py-2">
          <p className="text-xs text-gray-400 font-mono">{str.length > 200 ? str.slice(0, 200) + "…" : str}</p>
        </div>
      );
    }
  }
}

// ── Componente principal ─────────────────────────────────────────────────────

const SessionDetailView: React.FC<Props> = ({
  session,
  onBack,
  onEdit,
  onManageCandidates,
}) => {
  // ── Estado para resultados ────────────────────────────────────────────────
  const [results, setResults] = useState<SessionResult[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);
  const [resultsFetched, setResultsFetched] = useState(false);
  const [candidateNames, setCandidateNames] = useState<Record<string, string>>({});
  const [regrading, setRegrading] = useState(false);

  // ── Estado para panel de detalle expandible ───────────────────────────────
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<DetailedResult | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // ── Utilidades de formato ─────────────────────────────────────────────────
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/La_Paz",
    });

  const formatDateShort = (date: string) =>
    new Date(date).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/La_Paz",
    });

  // ── Mapa de estado ────────────────────────────────────────────────────────
  const statusInfo = (() => {
    const m = {
      scheduled: {
        color: "bg-blue-900/20 text-blue-300 border-blue-800/30",
        dot: "bg-blue-400",
        icon: Clock,
        text: "Programada",
      },
      in_progress: {
        color: "bg-green-900/20 text-green-300 border-green-800/30",
        dot: "bg-green-400",
        icon: Clock,
        text: "En Progreso",
      },
      completed: {
        color: "bg-gray-900/20 text-gray-300 border-gray-700",
        dot: "bg-gray-400",
        icon: CheckCircle,
        text: "Completada",
      },
      cancelled: {
        color: "bg-red-900/20 text-red-300 border-red-800/30",
        dot: "bg-red-400",
        icon: X,
        text: "Cancelada",
      },
      expired: {
        color: "bg-orange-900/20 text-orange-300 border-orange-800/30",
        dot: "bg-orange-400",
        icon: X,
        text: "Expirada",
      },
    } as const;
    return (m as any)[session.status] || m.scheduled;
  })();

  // ── Cálculo de duración de sesión ─────────────────────────────────────────
  const calculateDuration = () => {
    const start = new Date(session.scheduling.startDate);
    const end = new Date(session.scheduling.endDate);
    const diffMs = end.getTime() - start.getTime();
    const h = Math.floor(diffMs / (1000 * 60 * 60));
    const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return h > 0 ? `${h}h ${m}min` : `${m} minutos`;
  };

  // ── Datos derivados ───────────────────────────────────────────────────────
  const registeredCount = session.participants.registeredCandidates?.length ?? 0;
  const maxCandidates = session.participants.maxCandidates;
  const occupancyPct =
    maxCandidates > 0 ? Math.round((registeredCount / maxCandidates) * 100) : 0;

  const occupancyColor =
    occupancyPct > 90
      ? { bar: "bg-red-500", text: "text-red-400" }
      : occupancyPct >= 70
      ? { bar: "bg-orange-500", text: "text-orange-400" }
      : { bar: "bg-emerald-500", text: "text-emerald-400" };

  const isReadOnly =
    session.status === "completed" || session.status === "cancelled";

  // ── Badges de tipo y nivel ────────────────────────────────────────────────
  const examTypeBadge: Record<string, string> = {
    placement: "bg-purple-900/30 text-purple-300 border-purple-700/40",
    progress: "bg-blue-900/30 text-blue-300 border-blue-700/40",
    final: "bg-orange-900/30 text-orange-300 border-orange-700/40",
    practice: "bg-teal-900/30 text-teal-300 border-teal-700/40",
  };

  const levelBadge: Record<string, string> = {
    A1: "bg-gray-800 text-gray-300 border-gray-600",
    A2: "bg-gray-800 text-gray-300 border-gray-600",
    B1: "bg-blue-900/30 text-blue-300 border-blue-700/40",
    B2: "bg-blue-900/30 text-blue-300 border-blue-700/40",
    C1: "bg-purple-900/30 text-purple-300 border-purple-700/40",
    C2: "bg-purple-900/30 text-purple-300 border-purple-700/40",
  };

  // ── Fetch de resultados ───────────────────────────────────────────────────
  const fetchResults = async () => {
    setResultsLoading(true);
    setResultsError(null);
    try {
      const token = authSDK.getAccessToken();
      const baseUrl =
        import.meta.env.VITE_EXAM_SERVICE_URL || "http://localhost:3003";
      const res = await fetch(
        `${baseUrl}/api/v1/sessions/${session._id}/results`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al cargar resultados");
      const fetchedResults: SessionResult[] = data.data.results;
      setResults(fetchedResults);
      setResultsFetched(true);

      // Resolver nombres de candidatos en background
      const uniqueIds = [...new Set(fetchedResults.map((r) => r.candidateId))];
      if (uniqueIds.length > 0) {
        candidateService.getCandidatesByIds(uniqueIds).then((res) => {
          const nameMap: Record<string, string> = {};
          const candidates = Array.isArray(res.data) ? res.data : [];
          for (const c of candidates) {
            const fullName = `${c.personalInfo.firstName} ${c.personalInfo.lastName}`.trim();
            if (fullName) nameMap[c._id] = fullName;
          }
          setCandidateNames(nameMap);
        }).catch(() => {/* silencioso, fallback al ID */});
      }
    } catch (err: any) {
      setResultsError(err.message);
    } finally {
      setResultsLoading(false);
    }
  };

  useEffect(() => {
    if (session.status === "completed" && session._id && !resultsFetched) {
      fetchResults();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session._id, session.status]);

  // ── Recalcular calificaciones ─────────────────────────────────────────────
  const handleRegrade = async () => {
    if (regrading) return;
    setRegrading(true);
    try {
      const result = await examService.regradeSession(session._id as string);
      const { queued, total } = result?.data ?? {};
      // Reload results after regrading
      await fetchResults();
      alert(`Recalificación completada: ${queued ?? 0}/${total ?? 0} intentos procesados`);
    } catch {
      alert("Error al iniciar la recalificación");
    } finally {
      setRegrading(false);
    }
  };

  // ── Handler para expandir detalle de un resultado ────────────────────────
  const handleSelectResult = async (result: SessionResult) => {
    // Toggle off si se hace click en la misma fila
    if (selectedResultId === result.id) {
      setSelectedResultId(null);
      setDetailData(null);
      return;
    }
    setSelectedResultId(result.id);
    setDetailData(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const token = authSDK.getAccessToken();
      const baseUrl =
        import.meta.env.VITE_EXAM_SERVICE_URL || "http://localhost:3003";
      const res = await fetch(
        `${baseUrl}/api/v1/exam-results/${result.id}/admin`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al cargar detalle");
      setDetailData(data.data);
    } catch (err: any) {
      setDetailError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Helpers de tabla de resultados ───────────────────────────────────────
  const getScoreColor = (pct: number) =>
    pct >= 70
      ? "text-emerald-400"
      : pct >= 50
      ? "text-orange-400"
      : "text-red-400";

  const getScoreBarColor = (pct: number) =>
    pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-orange-500" : "bg-red-500";

  const resultStatusPill: Record<
    SessionResult["status"],
    { label: string; cls: string }
  > = {
    completed: {
      label: "Completado",
      cls: "bg-emerald-900/30 text-emerald-300 border-emerald-700/40",
    },
    partial: {
      label: "Parcial",
      cls: "bg-orange-900/30 text-orange-300 border-orange-700/40",
    },
    pending_ai_review: {
      label: "Revisión IA",
      cls: "bg-yellow-900/30 text-yellow-300 border-yellow-700/40",
    },
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* ══ Fila 1: Header ═══════════════════════════════════════════════════ */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            onClick={onBack}
            variant="outline"
            size="sm"
            className="mt-0.5 shrink-0 border-line text-gray-400 hover:text-gray-200 hover:bg-gray-800"
            aria-label="Volver atrás"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-gray-100 leading-tight">
                {session.sessionName}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${statusInfo.color}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`} />
                {statusInfo.text}
              </span>
            </div>
            {session.exam?.name && (
              <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                {session.exam.name}
              </p>
            )}
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex gap-2 shrink-0 pl-10 sm:pl-0">
            <Button
              onClick={onManageCandidates}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              aria-label="Gestionar candidatos"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              Candidatos
            </Button>
            <Button
              onClick={onEdit}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              aria-label="Editar sesión"
            >
              <Edit className="w-4 h-4 mr-1.5" />
              Editar
            </Button>
          </div>
        )}
      </div>

      {/* ══ Fila 2: 4 metric cards compactas ════════════════════════════════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Capacidad */}
        <div className="bg-box border border-line rounded-xl p-3 flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-900/30 shrink-0">
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-gray-100 leading-none">
              {maxCandidates}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Capacidad</p>
          </div>
        </div>

        {/* Registrados */}
        <div className="bg-box border border-line rounded-xl p-3 flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-900/30 shrink-0">
            <UserPlus className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-gray-100 leading-none">
              {registeredCount}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Registrados</p>
          </div>
        </div>

        {/* Duración de sesión */}
        <div className="bg-box border border-line rounded-xl p-3 flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-900/30 shrink-0">
            <Clock className="w-4 h-4 text-orange-400" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-100 leading-none">
              {calculateDuration()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Duración sesión</p>
          </div>
        </div>

        {/* Promedio */}
        <div className="bg-box border border-line rounded-xl p-3 flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-900/30 shrink-0">
            <BarChart3 className="w-4 h-4 text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-gray-100 leading-none">
              {session.stats?.averageScore != null
                ? `${session.stats.averageScore.toFixed(1)}%`
                : "—"}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Promedio</p>
          </div>
        </div>
      </div>

      {/* ══ Fila 3: Grid 2 columnas ══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Columna izquierda (col-span-2): Programación + Configuración en una sola card */}
        <div className="lg:col-span-2 bg-box border border-line rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:divide-x sm:divide-line">

            {/* Programación */}
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Programación
              </h2>

              <div className="space-y-2">
                {(
                  [
                    ["Inicio", formatDateShort(session.scheduling.startDate)],
                    ["Fin", formatDateShort(session.scheduling.endDate)],
                    ["Duración", calculateDuration()],
                    ["Timezone", session.scheduling.timeZone],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wide shrink-0 mt-0.5">
                      {label}
                    </span>
                    <span className="text-xs text-gray-200 text-right font-medium">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Barra de ocupación */}
              <div className="pt-2 border-t border-line space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Ocupación</span>
                  <span className={`font-semibold ${occupancyColor.text}`}>
                    {registeredCount}/{maxCandidates} ({occupancyPct}%)
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full bg-gray-700 overflow-hidden"
                  role="progressbar"
                  aria-valuenow={occupancyPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Ocupación de la sesión"
                >
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${occupancyColor.bar}`}
                    style={{ width: `${Math.min(occupancyPct, 100)}%` }}
                  />
                </div>
                {occupancyPct > 90 && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Capacidad casi agotada
                  </p>
                )}
              </div>
            </div>

            {/* Configuración */}
            <div className="sm:pl-4 space-y-3">
              <h2 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-gray-400" />
                Configuración
              </h2>

              <div className="grid grid-cols-2 gap-2">
                {/* Proctor */}
                <div className="flex items-center gap-1.5 bg-gray-800/40 border border-line rounded-lg px-2.5 py-2">
                  <Shield
                    className={`w-3.5 h-3.5 shrink-0 ${
                      session.settings.requireProctor
                        ? "text-emerald-400"
                        : "text-gray-600"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 leading-none">Proctor</p>
                    <span
                      className={`text-xs font-medium px-1 py-0.5 rounded ${
                        session.settings.requireProctor
                          ? "text-emerald-300"
                          : "text-red-400"
                      }`}
                    >
                      {session.settings.requireProctor ? "Si" : "No"}
                    </span>
                  </div>
                </div>

                {/* Entrada tardía */}
                <div className="flex items-center gap-1.5 bg-gray-800/40 border border-line rounded-lg px-2.5 py-2">
                  <DoorOpen
                    className={`w-3.5 h-3.5 shrink-0 ${
                      session.settings.allowLateEntry
                        ? "text-emerald-400"
                        : "text-gray-600"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 leading-none">
                      Tardía
                    </p>
                    {session.settings.allowLateEntry ? (
                      <span className="text-xs font-medium text-emerald-300">
                        +{session.settings.lateEntryMinutes ?? 0}min
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-red-400">No</span>
                    )}
                  </div>
                </div>

                {/* Auto-inicio */}
                <div className="flex items-center gap-1.5 bg-gray-800/40 border border-line rounded-lg px-2.5 py-2">
                  <Zap
                    className={`w-3.5 h-3.5 shrink-0 ${
                      session.settings.autoStart
                        ? "text-emerald-400"
                        : "text-gray-600"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 leading-none">
                      Auto-inicio
                    </p>
                    <span
                      className={`text-xs font-medium ${
                        session.settings.autoStart
                          ? "text-emerald-300"
                          : "text-red-400"
                      }`}
                    >
                      {session.settings.autoStart ? "Si" : "No"}
                    </span>
                  </div>
                </div>

                {/* Bloqueo */}
                <div className="flex items-center gap-1.5 bg-gray-800/40 border border-line rounded-lg px-2.5 py-2">
                  <Lock
                    className={`w-3.5 h-3.5 shrink-0 ${
                      session.settings.browserLockdown
                        ? "text-emerald-400"
                        : "text-gray-600"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 leading-none">
                      Bloqueo
                    </p>
                    <span
                      className={`text-xs font-medium ${
                        session.settings.browserLockdown
                          ? "text-emerald-300"
                          : "text-red-400"
                      }`}
                    >
                      {session.settings.browserLockdown ? "Activo" : "No"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Columna derecha (col-span-1): Examen vinculado + Stats */}
        <div className="lg:col-span-1 bg-box border border-line rounded-xl p-4 space-y-4">

          {/* Examen vinculado */}
          <div className="space-y-2.5">
            <h2 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-purple-400" />
              Examen vinculado
            </h2>

            {session.exam ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-100 leading-snug">
                  {session.exam.name}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {session.exam.type && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        examTypeBadge[session.exam.type] ??
                        "bg-gray-800 text-gray-300 border-gray-600"
                      }`}
                    >
                      {session.exam.type.charAt(0).toUpperCase() +
                        session.exam.type.slice(1)}
                    </span>
                  )}
                  {session.exam.targetLevel && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        levelBadge[session.exam.targetLevel] ??
                        "bg-gray-800 text-gray-300 border-gray-600"
                      }`}
                    >
                      Nivel {session.exam.targetLevel}
                    </span>
                  )}
                </div>

                {session.exam.structure && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-line">
                    <div className="text-xs">
                      <span className="text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Duración
                      </span>
                      <span className="text-gray-200 font-medium">
                        {session.exam.structure.totalDuration} min
                      </span>
                    </div>
                    <div className="text-xs">
                      <span className="text-gray-500 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Preguntas
                      </span>
                      <span className="text-gray-200 font-medium">
                        {session.exam.structure.totalQuestions}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">Información no disponible</p>
            )}
          </div>

          {/* Stats — solo si existen */}
          {session.stats && (
            <div className="space-y-2 pt-3 border-t border-line">
              <h2 className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                Estadísticas
              </h2>

              <div className="grid grid-cols-2 gap-2">
                {/* Registrados */}
                <div className="bg-blue-900/15 border border-blue-800/30 rounded-lg p-2">
                  <p className="text-base font-bold text-blue-300 leading-none">
                    {session.stats.totalRegistered ?? 0}
                  </p>
                  <p className="text-xs text-blue-400 mt-0.5">Registrados</p>
                  <div className="mt-1.5 h-px rounded-full bg-blue-900/40 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: "100%" }} />
                  </div>
                </div>

                {/* Completados */}
                <div className="bg-emerald-900/15 border border-emerald-800/30 rounded-lg p-2">
                  <p className="text-base font-bold text-emerald-300 leading-none">
                    {session.stats.totalCompleted ?? 0}
                  </p>
                  <p className="text-xs text-emerald-400 mt-0.5">Completados</p>
                  <div className="mt-1.5 h-px rounded-full bg-emerald-900/40 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{
                        width: `${
                          (session.stats.totalRegistered ?? 0) > 0
                            ? Math.round(
                                ((session.stats.totalCompleted ?? 0) /
                                  (session.stats.totalRegistered ?? 1)) *
                                  100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Abandonados */}
                <div className="bg-red-900/15 border border-red-800/30 rounded-lg p-2">
                  <p className="text-base font-bold text-red-300 leading-none">
                    {session.stats.totalAbandoned ?? 0}
                  </p>
                  <p className="text-xs text-red-400 mt-0.5">Abandonados</p>
                  <div className="mt-1.5 h-px rounded-full bg-red-900/40 overflow-hidden">
                    <div
                      className="h-full bg-red-500 rounded-full"
                      style={{
                        width: `${
                          (session.stats.totalRegistered ?? 0) > 0
                            ? Math.round(
                                ((session.stats.totalAbandoned ?? 0) /
                                  (session.stats.totalRegistered ?? 1)) *
                                  100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>

                {/* Promedio */}
                <div className="bg-purple-900/15 border border-purple-800/30 rounded-lg p-2">
                  <p className="text-base font-bold text-purple-300 leading-none">
                    {session.stats.averageScore != null
                      ? `${session.stats.averageScore.toFixed(1)}%`
                      : "—"}
                  </p>
                  <p className="text-xs text-purple-400 mt-0.5">Promedio</p>
                  {session.stats.averageScore != null && (
                    <div className="mt-1.5 h-px rounded-full bg-purple-900/40 overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{
                          width: `${Math.min(session.stats.averageScore, 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══ Fila 4: Tabla de resultados (full width) ════════════════════════ */}
      <div className="bg-box border border-line rounded-xl overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-gray-300">
              Resultados de candidatos
            </h2>
            {session.status === "completed" && !resultsLoading && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-line">
                {results.length}
              </span>
            )}
          </div>
          {session.status === "completed" && resultsFetched && !resultsLoading && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleRegrade}
                disabled={regrading}
                title="Recalcular calificaciones con la lógica actual (incluye preguntas sin responder)"
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Recalcular calificaciones"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${regrading ? "animate-spin" : ""}`} />
                {regrading ? "Recalculando..." : "Recalcular"}
              </button>
              <span className="text-gray-700">|</span>
              <button
                onClick={fetchResults}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
                aria-label="Recargar resultados"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Actualizar
              </button>
            </div>
          )}
        </div>

        {/* Contenido del card */}
        {session.status !== "completed" ? (
          /* Estado: sesión no completada */
          <div className="flex flex-col items-center justify-center py-12 px-4 gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-gray-600" />
            </div>
            <p className="text-sm text-gray-500 text-center">
              Disponible cuando la sesión esté completada
            </p>
          </div>
        ) : resultsLoading ? (
          /* Estado: cargando */
          <div className="flex items-center justify-center py-12 gap-2">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="text-sm text-gray-400">Cargando resultados...</span>
          </div>
        ) : resultsError ? (
          /* Estado: error */
          <div className="flex flex-col items-center justify-center py-10 px-4 gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <p className="text-sm text-red-400 text-center">{resultsError}</p>
            <button
              onClick={fetchResults}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-line transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reintentar
            </button>
          </div>
        ) : results.length === 0 ? (
          /* Estado: sin resultados */
          <div className="flex flex-col items-center justify-center py-12 px-4 gap-3">
            <User2 className="w-8 h-8 text-gray-600" />
            <p className="text-sm text-gray-500">
              No hay resultados registrados aun
            </p>
          </div>
        ) : (
          /* Tabla de resultados */
          <div className="overflow-x-auto">
            <table className="w-full text-xs" role="table" aria-label="Resultados de candidatos">
              <thead>
                <tr className="border-b border-line">
                  {/* Chevron column */}
                  <th className="px-2 py-2.5 w-6" aria-label="Expandir" />
                  <th className="px-3 py-2.5 text-left text-gray-500 font-medium w-8">#</th>
                  <th className="px-3 py-2.5 text-left text-gray-500 font-medium">
                    Candidato
                  </th>
                  <th className="px-3 py-2.5 text-left text-gray-500 font-medium w-24">
                    %
                  </th>
                  <th className="px-3 py-2.5 text-left text-gray-500 font-medium">
                    Puntaje
                  </th>
                  <th className="px-3 py-2.5 text-left text-gray-500 font-medium">
                    Estado
                  </th>
                  <th className="px-3 py-2.5 text-left text-gray-500 font-medium">
                    Competencias
                  </th>
                  <th className="px-3 py-2.5 text-left text-gray-500 font-medium">
                    Tiempo
                  </th>
                  <th className="px-3 py-2.5 text-left text-gray-500 font-medium">
                    Nivel rec.
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, idx) => {
                  const durationMin = Math.round(result.examDuration / 60);
                  const timeUsedPct =
                    result.timeAllowed > 0
                      ? result.examDuration / result.timeAllowed
                      : 0;
                  const timeOverUsed = timeUsedPct > 0.8;
                  const statusPill =
                    resultStatusPill[result.status] ??
                    resultStatusPill.completed;
                  const topCompetencies = result.competencyScores.slice(0, 3);
                  const remaining =
                    result.competencyScores.length - topCompetencies.length;
                  const isExpanded = selectedResultId === result.id;

                  return (
                    <React.Fragment key={result.id}>
                      <tr
                        onClick={() => handleSelectResult(result)}
                        className={`border-b border-line/60 hover:bg-gray-800/30 transition-colors cursor-pointer${
                          isExpanded ? " bg-blue-900/10" : ""
                        }`}
                        aria-expanded={isExpanded}
                      >
                        {/* Chevron */}
                        <td className="px-2 py-2.5 text-gray-500">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </td>

                        {/* # */}
                        <td className="px-3 py-2.5 text-gray-500">{idx + 1}</td>

                        {/* Candidato */}
                        <td className="px-3 py-2.5">
                          {candidateNames[result.candidateId] ? (
                            <span className="text-gray-200 font-medium">
                              {candidateNames[result.candidateId]}
                            </span>
                          ) : (
                            <span className="font-mono text-gray-500 text-xs">
                              ...{result.candidateId.slice(-8)}
                            </span>
                          )}
                        </td>

                        {/* % */}
                        <td className="px-3 py-2.5">
                          <div className="space-y-1">
                            <span
                              className={`font-bold text-sm ${getScoreColor(result.percentage)}`}
                            >
                              {result.percentage.toFixed(1)}%
                            </span>
                            <div className="h-1 w-16 rounded-full bg-gray-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getScoreBarColor(result.percentage)}`}
                                style={{
                                  width: `${Math.min(result.percentage, 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Puntaje */}
                        <td className="px-3 py-2.5 text-gray-300">
                          {result.totalScore}/{result.maxScore}
                        </td>

                        {/* Estado */}
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border ${statusPill.cls}`}
                          >
                            {statusPill.label}
                          </span>
                        </td>

                        {/* Competencias */}
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {topCompetencies.map((c) => (
                              <span
                                key={c.competency}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-800 text-gray-300 border border-line"
                              >
                                {c.competency} {c.percentage.toFixed(0)}%
                              </span>
                            ))}
                            {remaining > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-800 text-gray-500 border border-line">
                                +{remaining}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Tiempo */}
                        <td className="px-3 py-2.5">
                          <span
                            className={`font-medium ${timeOverUsed ? "text-orange-400" : "text-gray-300"}`}
                          >
                            {durationMin}min
                          </span>
                        </td>

                        {/* Nivel recomendado */}
                        <td className="px-3 py-2.5">
                          {result.recommendedLevel ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-300 border border-line">
                              {result.recommendedLevel}
                            </span>
                          ) : (
                            <span className="text-gray-600">—</span>
                          )}
                        </td>
                      </tr>

                      {/* ── Panel de detalle expandible ─────────────────── */}
                      {isExpanded && (
                        <tr key={`detail-${result.id}`}>
                          <td colSpan={9} className="px-0 py-0 bg-gray-900/50 border-b border-line">
                            <div className="p-4 space-y-4">

                              {/* Estado: cargando detalle */}
                              {detailLoading && (
                                <div className="flex items-center gap-2 py-6">
                                  <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                                  <span className="text-sm text-gray-400">
                                    Cargando detalle del examen...
                                  </span>
                                </div>
                              )}

                              {/* Estado: error al cargar detalle */}
                              {!detailLoading && detailError && (
                                <div className="flex items-center gap-2 py-4">
                                  <AlertTriangle className="w-4 h-4 text-red-400" />
                                  <span className="text-sm text-red-400">{detailError}</span>
                                </div>
                              )}

                              {/* Contenido del detalle */}
                              {!detailLoading && !detailError && detailData && (
                                <>
                                  {/* Sección 1: Barras de competencias */}
                                  {detailData.competencyScores.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                        Competencias
                                      </p>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {detailData.competencyScores.map((cs) => (
                                          <div
                                            key={cs.competency}
                                            className="bg-gray-800/50 border border-line rounded-lg px-3 py-2 space-y-1"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-xs text-gray-300 capitalize truncate">
                                                {cs.competency}
                                              </span>
                                              <span
                                                className={`text-xs font-semibold shrink-0 ${getScoreColor(cs.percentage)}`}
                                              >
                                                {cs.percentage.toFixed(0)}%
                                              </span>
                                            </div>
                                            <div
                                              className="h-1 w-full rounded-full bg-gray-700 overflow-hidden"
                                              role="progressbar"
                                              aria-valuenow={cs.percentage}
                                              aria-valuemin={0}
                                              aria-valuemax={100}
                                              aria-label={`${cs.competency} ${cs.percentage.toFixed(0)}%`}
                                            >
                                              <div
                                                className={`h-full rounded-full transition-all duration-500 ${getCompetencyBarColor(cs.competency)}`}
                                                style={{
                                                  width: `${Math.min(cs.percentage, 100)}%`,
                                                }}
                                              />
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                              <span>{cs.totalScore}/{cs.maxScore} pts</span>
                                              {cs.pendingEvaluationCount > 0 && (
                                                <span className="text-yellow-500">
                                                  {cs.pendingEvaluationCount} pend.
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Sección 2: Feedback general */}
                                  {detailData.overallFeedback && (
                                    <div className="bg-gray-800/40 border border-line rounded-lg px-3 py-2.5">
                                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                                        Retroalimentación general
                                      </p>
                                      <p className="text-xs text-gray-300 italic leading-relaxed">
                                        {detailData.overallFeedback}
                                      </p>
                                    </div>
                                  )}

                                  {/* Sección 3: Lista de preguntas */}
                                  {detailData.questionResults.length > 0 && (
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                          Preguntas
                                        </p>
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-line">
                                          {detailData.questionResults.length}
                                        </span>
                                      </div>

                                      {detailData.questionResults.map((qr, qIdx) => {
                                        const qScorePct = qr.maxScore > 0 ? (qr.score / qr.maxScore) * 100 : 0;
                                        const methodLabel = qr.evaluationMethod === "automatic" ? "Automática" : qr.evaluationMethod === "ai_grading" ? "IA" : "Manual";
                                        const methodCls = qr.evaluationMethod === "automatic"
                                          ? "bg-gray-700/60 text-gray-300 border-gray-600/40"
                                          : qr.evaluationMethod === "ai_grading"
                                          ? "bg-blue-900/40 text-blue-300 border-blue-700/40"
                                          : "bg-orange-900/40 text-orange-300 border-orange-700/40";
                                        const scoreCls = qr.isCorrect === true
                                          ? "bg-emerald-900/30 text-emerald-300 border-emerald-700/40"
                                          : qr.isCorrect === false
                                          ? "bg-red-900/30 text-red-300 border-red-700/40"
                                          : "bg-blue-900/30 text-blue-300 border-blue-700/40";

                                        return (
                                          <div key={qr.questionId} className="bg-gray-800/30 border border-line rounded-xl overflow-hidden">
                                            {/* Question header */}
                                            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-line/50">
                                              <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                                                <span className="bg-gray-700 text-white px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0">
                                                  #{qIdx + 1}
                                                </span>
                                                <span className="text-xs text-gray-300 font-medium">
                                                  {typeLabel[qr.questionType] ?? qr.questionType}
                                                </span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${getCompetencyColor(qr.competency)}`}>
                                                  {qr.competency}
                                                </span>
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs ${methodCls}`}>
                                                  {methodLabel}
                                                </span>
                                                {qr.isCorrect !== undefined && (
                                                  qr.isCorrect
                                                    ? <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                                                    : <X className="w-4 h-4 text-red-400 shrink-0" />
                                                )}
                                              </div>
                                              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border shrink-0 ${scoreCls}`}>
                                                {qr.score}/{qr.maxScore}
                                              </span>
                                            </div>

                                            {/* Question body */}
                                            <div className="px-4 py-3 space-y-3">
                                              {/* Context */}
                                              {qr.questionData?.context && (
                                                <div className="bg-gray-900/50 border border-line rounded-lg px-3 py-2">
                                                  <p className="text-xs text-gray-400 italic leading-relaxed">{qr.questionData.context}</p>
                                                </div>
                                              )}

                                              {/* Instructions */}
                                              {qr.questionData?.instructions && (
                                                <p className="text-xs text-gray-400">{qr.questionData.instructions}</p>
                                              )}

                                              {/* Question text */}
                                              {qr.questionData?.questionText && (
                                                <p className="text-sm text-gray-100 font-medium leading-snug">{qr.questionData.questionText}</p>
                                              )}

                                              {/* Media */}
                                              {renderMedia(qr.questionData)}

                                              {/* Response */}
                                              <div>
                                                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1.5">Respuesta del candidato</p>
                                                {renderResponse(qr)}
                                              </div>

                                              {/* Progress bar for score */}
                                              <div className="h-1 w-full rounded-full bg-gray-700 overflow-hidden">
                                                <div
                                                  className={`h-full rounded-full transition-all ${qScorePct >= 70 ? "bg-emerald-500" : qScorePct >= 40 ? "bg-orange-500" : "bg-red-500"}`}
                                                  style={{ width: `${Math.min(qScorePct, 100)}%` }}
                                                />
                                              </div>

                                              {/* Feedback */}
                                              {qr.feedback && (
                                                <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg px-3 py-2.5">
                                                  <p className="text-xs text-blue-300 font-medium mb-0.5">Retroalimentación</p>
                                                  <p className="text-xs text-blue-200 leading-relaxed">{qr.feedback}</p>
                                                </div>
                                              )}

                                              {/* AI Analysis */}
                                              {qr.aiAnalysis && (qr.aiAnalysis.feedback || (qr.aiAnalysis.suggestions?.length ?? 0) > 0) && (
                                                <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg px-3 py-2.5 space-y-2">
                                                  <p className="text-xs text-purple-300 font-medium">Análisis IA</p>
                                                  {qr.aiAnalysis.feedback && (
                                                    <p className="text-xs text-purple-200 leading-relaxed">{qr.aiAnalysis.feedback}</p>
                                                  )}
                                                  {qr.aiAnalysis?.criteria && Object.keys(qr.aiAnalysis.criteria).length > 0 && (
                                                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                      {Object.entries(qr.aiAnalysis.criteria).map(([key, val]) => (
                                                        <span key={key} className="text-xs text-purple-300">
                                                          <span className="capitalize text-purple-400">{key}:</span>{" "}
                                                          <span className="font-medium">{typeof val === "number" ? val.toFixed(1) : String(val)}</span>
                                                        </span>
                                                      ))}
                                                    </div>
                                                  )}
                                                  {(qr.aiAnalysis.suggestions?.length ?? 0) > 0 && (
                                                    <ul className="space-y-0.5 text-xs text-purple-200 list-disc list-inside">
                                                      {qr.aiAnalysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                                                    </ul>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ Fila 5: Metadata footer ══════════════════════════════════════════ */}
      <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-gray-500 px-1">
        {session._id && (
          <span className="flex items-center gap-1.5">
            <span className="text-gray-600">ID</span>
            <span className="font-mono text-gray-400 select-all">
              {session._id}
            </span>
          </span>
        )}
        {session.createdBy && (
          <span className="flex items-center gap-1.5">
            <span className="text-gray-600">Creado por</span>
            <span className="text-gray-400">
              {typeof session.createdBy === 'object' && session.createdBy !== null
                ? `${(session.createdBy as any).firstName ?? ''} ${(session.createdBy as any).lastName ?? ''}`.trim()
                : session.createdBy}
            </span>
          </span>
        )}
        {session.createdAt && (
          <span className="flex items-center gap-1.5">
            <span className="text-gray-600">Creacion</span>
            <span className="text-gray-400">{formatDate(session.createdAt)}</span>
          </span>
        )}
        {session.updatedAt && (
          <span className="flex items-center gap-1.5">
            <span className="text-gray-600">Actualizacion</span>
            <span className="text-gray-400">{formatDate(session.updatedAt)}</span>
          </span>
        )}
      </div>

    </div>
  );
};

export default SessionDetailView;
