import React, { useCallback, useEffect, useRef, useState } from "react";
import { authSDK } from "@/services/sdk-simple-auth";
import {
  ArrowLeft,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle,
  Clock,
  DoorOpen,
  Edit,
  Eye,
  Loader2,
  Lock,
  Plus,
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
import { toast } from "sonner";

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
  reading: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40",
  writing: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700/40",
  listening: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700/40",
  speaking: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/40",
};

const competencyBarColor: Record<string, string> = {
  reading: "bg-blue-500",
  writing: "bg-purple-500",
  listening: "bg-orange-500",
  speaking: "bg-green-500",
};

function getCompetencyColor(competency: string): string {
  const key = competency.toLowerCase();
  return competencyColor[key] ?? "bg-muted text-muted-foreground border-border";
}

function getCompetencyBarColor(competency: string): string {
  const key = competency.toLowerCase();
  return competencyBarColor[key] ?? "bg-muted-foreground";
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
      <div className="bg-muted/40 border border-border rounded-lg p-2">
        <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
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
      <div className="bg-muted/40 border border-border rounded-lg p-2">
        <p className="text-xs text-muted-foreground mb-1.5">🎬 Video</p>
        <video controls className="w-full rounded max-h-48">
          <source src={url} />
        </video>
      </div>
    );
  }
  return (
    <div className="bg-muted/40 border border-border rounded-lg p-2">
      <img src={url} alt="Imagen de la pregunta" className="max-h-40 rounded object-contain" />
    </div>
  );
}

function renderResponse(qr: QuestionResult): React.ReactNode {
  const { questionType, response, questionData } = qr;
  const options = questionData?.options ?? [];

  if (!response) {
    return <p className="text-xs text-muted-foreground italic">Sin respuesta registrada</p>;
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
              let cls = "border border-border bg-muted/40 text-muted-foreground";
              if (isSelected && isCorrect) cls = "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-300";
              else if (isSelected && !isCorrect) cls = "border border-red-200 bg-red-50 text-red-700 dark:border-red-600/50 dark:bg-red-900/20 dark:text-red-300";
              else if (!isSelected && isCorrect) cls = "border border-emerald-200/70 bg-emerald-50/60 text-emerald-600/70 dark:border-emerald-600/30 dark:bg-emerald-900/10 dark:text-emerald-600/60 dark:text-emerald-400/60";
              return (
                <div key={opt.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${cls}`}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${isSelected ? "bg-current/20" : "bg-muted"}`}>
                    {isSelected ? "●" : "○"}
                  </span>
                  <span>{opt.text}</span>
                  {isCorrect && <span className="ml-auto text-emerald-600/70 dark:text-emerald-400/70 text-xs">✓ correcta</span>}
                </div>
              );
            })}
          </div>
        );
      }
      const selected2: string[] = response?.selectedOptions ?? [];
      return <p className="text-xs text-foreground/80 bg-muted/40 px-3 py-2 rounded-lg">Opción(es): {selected2.join(", ") || "—"}</p>;
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
            let cls = "border border-border bg-muted/40 text-muted-foreground";
            if (isSelected && isCorrect) cls = "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-300 font-semibold";
            else if (isSelected && !isCorrect) cls = "border border-red-200 bg-red-50 text-red-700 dark:border-red-600/50 dark:bg-red-900/20 dark:text-red-300 font-semibold";
            else if (!isSelected && isCorrect) cls = "border border-emerald-200/70 bg-emerald-50/60 text-emerald-600/70 dark:border-emerald-600/30 dark:bg-emerald-900/10 dark:text-emerald-400/60";
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
      if (blanks.length === 0) return <p className="text-xs text-muted-foreground italic">Sin respuesta</p>;
      const correctBlanks = questionData?.blanks ?? [];
      return (
        <div className="flex flex-wrap gap-2">
          {blanks.map((b, i) => {
            const correctAnswers = correctBlanks[i]?.correctAnswers ?? [];
            const isOk = correctAnswers.length > 0
              ? correctAnswers.some(c => c.trim().toLowerCase() === b.trim().toLowerCase())
              : null;
            const cls = isOk === true
              ? "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-600/40 dark:text-emerald-300"
              : isOk === false
              ? "bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-600/40 dark:text-red-300"
              : "bg-muted/40 border-border text-foreground/80";
            return (
              <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs ${cls}`}>
                <span className="text-muted-foreground">[{i+1}]</span>
                <span className="font-medium">{b || "—"}</span>
                {isOk === false && correctAnswers.length > 0 && (
                  <span className="text-emerald-600/70 dark:text-emerald-400/70 ml-1">✓ {correctAnswers[0]}</span>
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
      if (Object.keys(pairs).length === 0) return <p className="text-xs text-muted-foreground italic">Sin respuesta</p>;
      return (
        <div className="space-y-1">
          {Object.entries(pairs).map(([k, v]) => {
            const item = items.find(i => i.id === k);
            const isOk = item?.matchingPair === v;
            return (
              <div key={k} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${isOk ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-600/40 dark:bg-emerald-900/10 dark:text-emerald-300" : "border-red-200 bg-red-50 text-red-700 dark:border-red-600/40 dark:bg-red-900/10 dark:text-red-300"}`}>
                <span className="font-medium">{item?.content ?? k}</span>
                <span className="text-muted-foreground">→</span>
                <span>{v}</span>
                {!isOk && item?.matchingPair && <span className="ml-auto text-emerald-600/60 dark:text-emerald-400/60">✓ {item.matchingPair}</span>}
              </div>
            );
          })}
        </div>
      );
    }

    case "ordering": {
      const order: string[] = response?.order ?? [];
      const items = questionData?.items ?? [];
      if (order.length === 0) return <p className="text-xs text-muted-foreground italic">Sin respuesta</p>;
      return (
        <div className="space-y-1">
          {order.map((id, idx) => {
            const item = items.find(i => i.id === id);
            const correctPos = item?.correctPosition;
            const isOk = correctPos !== undefined ? correctPos === idx : null;
            return (
              <div key={id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${isOk === true ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-600/40 dark:bg-emerald-900/10 dark:text-emerald-300" : isOk === false ? "border-red-200 bg-red-50 text-red-700 dark:border-red-600/40 dark:bg-red-900/10 dark:text-red-300" : "border-border bg-muted/40 text-foreground/80"}`}>
                <span className="text-muted-foreground font-mono">#{idx+1}</span>
                <span>{item?.content ?? id}</span>
                {isOk === false && correctPos !== undefined && <span className="ml-auto text-emerald-600/60 dark:text-emerald-400/60 text-xs">✓ pos {correctPos+1}</span>}
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
        return <p className="text-xs text-muted-foreground italic">Sin respuesta</p>;

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
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-600/40 dark:bg-emerald-900/10 dark:text-emerald-300"
                : isOk === false
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-600/40 dark:bg-red-900/10 dark:text-red-300"
                : "border-border bg-muted/40 text-foreground/80";
            return (
              <div
                key={itemId}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border ${cls}`}
              >
                <span className="text-muted-foreground font-mono shrink-0">
                  Zona {zoneIdx + 1}
                </span>
                <span className="flex-1">{item?.content ?? `Item ${itemId}`}</span>
                {isOk === false && item?.correctPosition !== undefined && (
                  <span className="ml-auto text-emerald-600/60 dark:text-emerald-400/60 shrink-0">
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
        return <p className="text-xs text-muted-foreground italic">Sin audio registrado</p>;
      return (
        <div className="space-y-2">
          {audioUrl && (
            <div className="bg-muted/40 border border-border rounded-lg p-2.5">
              <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
                🔊 Audio del candidato
              </p>
              <audio controls className="w-full" style={{ colorScheme: "dark" }}>
                <source src={audioUrl} type="audio/webm" />
                <source src={audioUrl} />
              </audio>
            </div>
          )}
          {transcription && (
            <div className="bg-muted/40 border border-border rounded-lg px-3 py-2">
              <p className="text-xs text-muted-foreground mb-1">Transcripción</p>
              <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{transcription}</p>
            </div>
          )}
        </div>
      );
    }

    case "file_upload": {
      const fileUrl: string | undefined = response?.fileUrl ?? response?.url;
      if (!fileUrl)
        return <p className="text-xs text-muted-foreground italic">Sin archivo</p>;
      return (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700/40 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40 transition-colors"
        >
          📎 Ver archivo adjunto
        </a>
      );
    }

    case "essay":
    case "open_text": {
      const text = typeof response === "string" ? response : response?.text ?? response?.answer ?? response?.essay ?? "";
      return (
        <div className="bg-muted/40 border border-border rounded-lg px-3 py-2.5">
          <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{String(text) || "Sin texto"}</p>
        </div>
      );
    }

    default: {
      const str = typeof response === "string" ? response : JSON.stringify(response);
      return (
        <div className="bg-muted/40 border border-border rounded-lg px-3 py-2">
          <p className="text-xs text-muted-foreground font-mono">{str.length > 200 ? str.slice(0, 200) + "…" : str}</p>
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
  const [extendingSession, setExtendingSession] = useState(false);
  const [showExtendMenu, setShowExtendMenu] = useState(false);
  const extendMenuRef = useRef<HTMLDivElement>(null);

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
        color: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/30",
        dot: "bg-blue-500 dark:bg-blue-400",
        icon: Clock,
        text: "Programada",
      },
      in_progress: {
        color: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/30",
        dot: "bg-green-500 dark:bg-green-400",
        icon: Clock,
        text: "En Progreso",
      },
      completed: {
        color: "bg-muted/20 text-muted-foreground border-border",
        dot: "bg-muted-foreground",
        icon: CheckCircle,
        text: "Completada",
      },
      cancelled: {
        color: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800/30",
        dot: "bg-red-500 dark:bg-red-400",
        icon: X,
        text: "Cancelada",
      },
      expired: {
        color: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800/30",
        dot: "bg-orange-500 dark:bg-orange-400",
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
      ? { bar: "bg-red-500", text: "text-red-600 dark:text-red-400" }
      : occupancyPct >= 70
      ? { bar: "bg-orange-500", text: "text-orange-600 dark:text-orange-400" }
      : { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };

  const isReadOnly =
    session.status === "completed" || session.status === "cancelled";

  // ── Badges de tipo y nivel ────────────────────────────────────────────────
  const examTypeBadge: Record<string, string> = {
    placement: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700/40",
    progress: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40",
    final: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700/40",
    practice: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700/40",
  };

  const levelBadge: Record<string, string> = {
    A1: "bg-muted text-muted-foreground border-border",
    A2: "bg-muted text-muted-foreground border-border",
    B1: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40",
    B2: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40",
    C1: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700/40",
    C2: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700/40",
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

  // ── Extender tiempo ──────────────────────────────────────────────────────
  const handleExtendSession = useCallback(async (minutes: number) => {
    if (extendingSession) return;
    setShowExtendMenu(false);
    setExtendingSession(true);
    try {
      await examService.extendSession(session._id as string, minutes);
      toast.success(`Tiempo extendido por ${minutes} minutos`);
    } catch {
      toast.error('Error al extender el tiempo de la sesión');
    } finally {
      setExtendingSession(false);
    }
  }, [session._id, extendingSession]);

  useEffect(() => {
    if (!showExtendMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (extendMenuRef.current && !extendMenuRef.current.contains(e.target as Node)) {
        setShowExtendMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showExtendMenu]);

  // ── Handler para abrir modal de detalle ──────────────────────────────────
  const closeModal = () => {
    setSelectedResultId(null);
    setDetailData(null);
    setDetailError(null);
  };

  const handleSelectResult = async (result: SessionResult) => {
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
      ? "text-emerald-600 dark:text-emerald-400"
      : pct >= 50
      ? "text-orange-600 dark:text-orange-400"
      : "text-red-600 dark:text-red-400";

  const getScoreBarColor = (pct: number) =>
    pct >= 70 ? "bg-emerald-500" : pct >= 50 ? "bg-orange-500" : "bg-red-500";

  const resultStatusPill: Record<
    SessionResult["status"],
    { label: string; cls: string }
  > = {
    completed: {
      label: "Completado",
      cls: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40",
    },
    partial: {
      label: "Parcial",
      cls: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700/40",
    },
    pending_ai_review: {
      label: "Revisión IA",
      cls: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700/40",
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
            className="mt-0.5 shrink-0 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Volver atrás"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground leading-tight">
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
              <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1">
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                {session.exam.name}
              </p>
            )}
          </div>
        </div>

        {!isReadOnly && (
          <div className="flex gap-2 shrink-0 pl-10 sm:pl-0 flex-wrap">
            {(session.status === 'in_progress' || session.status === 'scheduled') && (
              <div className="relative" ref={extendMenuRef}>
                <Button
                  onClick={() => setShowExtendMenu(v => !v)}
                  disabled={extendingSession}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {extendingSession
                    ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    : <Plus className="w-4 h-4 mr-1.5" />
                  }
                  {extendingSession ? 'Extendiendo...' : 'Extender'}
                </Button>
                {showExtendMenu && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-xl py-1 min-w-[140px]">
                    {[15, 30, 45, 60].map((min) => (
                      <button
                        key={min}
                        onClick={() => handleExtendSession(min)}
                        className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                      >
                        +{min} minutos
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Button
              onClick={onManageCandidates}
              size="sm"
              className="bg-brand-blue hover:bg-brand-blue/90 text-white"
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
        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
            <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-foreground leading-none">
              {maxCandidates}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Capacidad</p>
          </div>
        </div>

        {/* Registrados */}
        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 shrink-0">
            <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-foreground leading-none">
              {registeredCount}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Registrados</p>
          </div>
        </div>

        {/* Duración de sesión */}
        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 shrink-0">
            <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-foreground leading-none">
              {calculateDuration()}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Duración sesión</p>
          </div>
        </div>

        {/* Promedio */}
        <div className="bg-card border border-border rounded-xl p-3 flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 shrink-0">
            <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-foreground leading-none">
              {session.stats?.averageScore != null
                ? `${session.stats.averageScore.toFixed(1)}%`
                : "—"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">Promedio</p>
          </div>
        </div>
      </div>

      {/* ══ Fila 3: Grid 2 columnas ══════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Columna izquierda (col-span-2): Programación + Configuración en una sola card */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:divide-x sm:divide-border">

            {/* Programación */}
            <div className="space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
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
                    <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0 mt-0.5">
                      {label}
                    </span>
                    <span className="text-xs text-foreground/80 text-right font-medium">
                      {value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Barra de ocupación */}
              <div className="pt-2 border-t border-border space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Ocupación</span>
                  <span className={`font-semibold ${occupancyColor.text}`}>
                    {registeredCount}/{maxCandidates} ({occupancyPct}%)
                  </span>
                </div>
                <div
                  className="h-1.5 rounded-full bg-muted overflow-hidden"
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
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Capacidad casi agotada
                  </p>
                )}
              </div>
            </div>

            {/* Configuración */}
            <div className="sm:pl-4 space-y-3">
              <h2 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-muted-foreground" />
                Configuración
              </h2>

              <div className="space-y-1.5">
                {/* Proctor */}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <Shield className={`w-3.5 h-3.5 shrink-0 ${session.settings.requireProctor ? "text-blue-500" : "text-muted-foreground/40"}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground leading-none">Proctor</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Supervisor presente</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                    session.settings.requireProctor
                      ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800/30"
                      : "bg-muted text-muted-foreground border-border"
                  }`}>
                    {session.settings.requireProctor ? "Sí" : "No"}
                  </span>
                </div>

                {/* Auto-inicio */}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <Zap className={`w-3.5 h-3.5 shrink-0 ${session.settings.autoStart ? "text-green-500" : "text-muted-foreground/40"}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground leading-none">Inicio automático</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Inicia solo a la hora programada</p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                    session.settings.autoStart
                      ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800/30"
                      : "bg-muted text-muted-foreground border-border"
                  }`}>
                    {session.settings.autoStart ? "Sí" : "No"}
                  </span>
                </div>

                {/* Entrada tardía */}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <DoorOpen className={`w-3.5 h-3.5 shrink-0 ${session.settings.allowLateEntry ? "text-orange-500" : "text-muted-foreground/40"}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground leading-none">Entrada tardía</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {session.settings.allowLateEntry
                          ? `Tolerancia de ${session.settings.lateEntryMinutes ?? 0} min`
                          : "No permitida"}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                    session.settings.allowLateEntry
                      ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800/30"
                      : "bg-muted text-muted-foreground border-border"
                  }`}>
                    {session.settings.allowLateEntry ? `+${session.settings.lateEntryMinutes ?? 0}min` : "No"}
                  </span>
                </div>

                {/* Bloqueo de navegador — no disponible en web */}
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border opacity-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <Lock className="w-3.5 h-3.5 shrink-0 text-muted-foreground/40" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground leading-none">Bloqueo de navegador</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">No disponible en navegadores web</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 bg-muted text-muted-foreground border-border">
                    N/D
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Columna derecha (col-span-1): Examen vinculado + Stats */}
        <div className="lg:col-span-1 bg-card border border-border rounded-xl p-4 space-y-4">

          {/* Examen vinculado */}
          <div className="space-y-2.5">
            <h2 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              Examen vinculado
            </h2>

            {session.exam ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {session.exam.name}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {session.exam.type && (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                        examTypeBadge[session.exam.type] ??
                        "bg-muted text-muted-foreground border-border"
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
                        "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      Nivel {session.exam.targetLevel}
                    </span>
                  )}
                </div>

                {session.exam.structure && (
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border">
                    <div className="text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Duración
                      </span>
                      <span className="text-foreground/80 font-medium">
                        {session.exam.structure.totalDuration} min
                      </span>
                    </div>
                    <div className="text-xs">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" />
                        Preguntas
                      </span>
                      <span className="text-foreground/80 font-medium">
                        {session.exam.structure.totalQuestions}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Información no disponible</p>
            )}
          </div>

          {/* Stats — solo si existen */}
          {session.stats && (
            <div className="space-y-2 pt-3 border-t border-border">
              <h2 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Estadísticas
              </h2>

              <div className="grid grid-cols-2 gap-2">
                {/* Registrados */}
                <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/15 dark:border-blue-800/30 rounded-lg p-2">
                  <p className="text-base font-bold text-blue-700 dark:text-blue-300 leading-none">
                    {session.stats.totalRegistered ?? 0}
                  </p>
                  <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5">Registrados</p>
                  <div className="mt-1.5 h-px rounded-full bg-blue-200 dark:bg-blue-900/40 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: "100%" }} />
                  </div>
                </div>

                {/* Completados */}
                <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-900/15 dark:border-emerald-800/30 rounded-lg p-2">
                  <p className="text-base font-bold text-emerald-700 dark:text-emerald-300 leading-none">
                    {session.stats.totalCompleted ?? 0}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Completados</p>
                  <div className="mt-1.5 h-px rounded-full bg-emerald-200 dark:bg-emerald-900/40 overflow-hidden">
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
                <div className="bg-red-50 border border-red-200 dark:bg-red-900/15 dark:border-red-800/30 rounded-lg p-2">
                  <p className="text-base font-bold text-red-700 dark:text-red-300 leading-none">
                    {session.stats.totalAbandoned ?? 0}
                  </p>
                  <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">Abandonados</p>
                  <div className="mt-1.5 h-px rounded-full bg-red-200 dark:bg-red-900/40 overflow-hidden">
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
                <div className="bg-purple-50 border border-purple-200 dark:bg-purple-900/15 dark:border-purple-800/30 rounded-lg p-2">
                  <p className="text-base font-bold text-purple-700 dark:text-purple-300 leading-none">
                    {session.stats.averageScore != null
                      ? `${session.stats.averageScore.toFixed(1)}%`
                      : "—"}
                  </p>
                  <p className="text-xs text-purple-500 dark:text-purple-400 mt-0.5">Promedio</p>
                  {session.stats.averageScore != null && (
                    <div className="mt-1.5 h-px rounded-full bg-purple-200 dark:bg-purple-900/40 overflow-hidden">
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
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-muted-foreground">
              Resultados de candidatos
            </h2>
            {session.status === "completed" && !resultsLoading && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
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
              <span className="text-border">|</span>
              <button
                onClick={fetchResults}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
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
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Disponible cuando la sesión esté completada
            </p>
          </div>
        ) : resultsLoading ? (
          /* Estado: cargando */
          <div className="flex items-center justify-center py-12 gap-2">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="text-sm text-muted-foreground">Cargando resultados...</span>
          </div>
        ) : resultsError ? (
          /* Estado: error */
          <div className="flex flex-col items-center justify-center py-10 px-4 gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <p className="text-sm text-red-400 text-center">{resultsError}</p>
            <button
              onClick={fetchResults}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground/80 border border-border transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reintentar
            </button>
          </div>
        ) : results.length === 0 ? (
          /* Estado: sin resultados */
          <div className="flex flex-col items-center justify-center py-12 px-4 gap-3">
            <User2 className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No hay resultados registrados aun
            </p>
          </div>
        ) : (
          /* Tabla de resultados */
          <div className="overflow-x-auto">
            <table className="w-full text-xs" role="table" aria-label="Resultados de candidatos">
              <thead>
                <tr className="border-b border-border">
                  {/* Chevron column */}
                  <th className="px-2 py-2.5 w-6" aria-label="Ver detalle" />
                  <th className="px-3 py-2.5 text-left text-muted-foreground font-medium w-8">#</th>
                  <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">
                    Candidato
                  </th>
                  <th className="px-3 py-2.5 text-left text-muted-foreground font-medium w-24">
                    %
                  </th>
                  <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">
                    Puntaje
                  </th>
                  <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">
                    Estado
                  </th>
                  <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">
                    Competencias
                  </th>
                  <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">
                    Tiempo
                  </th>
                  <th className="px-3 py-2.5 text-left text-muted-foreground font-medium">
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
                  return (
                    <React.Fragment key={result.id}>
                      <tr
                        onClick={() => handleSelectResult(result)}
                        className="border-b border-border/60 hover:bg-muted/30 transition-colors cursor-pointer"
                      >
                        {/* Ícono ver detalle */}
                        <td className="px-2 py-2.5 text-muted-foreground">
                          <Eye className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                        </td>

                        {/* # */}
                        <td className="px-3 py-2.5 text-muted-foreground">{idx + 1}</td>

                        {/* Candidato */}
                        <td className="px-3 py-2.5">
                          {candidateNames[result.candidateId] ? (
                            <span className="text-foreground/80 font-medium">
                              {candidateNames[result.candidateId]}
                            </span>
                          ) : (
                            <span className="font-mono text-muted-foreground text-xs">
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
                            <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
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
                        <td className="px-3 py-2.5 text-foreground/80">
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
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground border border-border"
                              >
                                {c.competency} {c.percentage.toFixed(0)}%
                              </span>
                            ))}
                            {remaining > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground border border-border">
                                +{remaining}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Tiempo */}
                        <td className="px-3 py-2.5">
                          <span
                            className={`font-medium ${timeOverUsed ? "text-orange-600 dark:text-orange-400" : "text-foreground/80"}`}
                          >
                            {durationMin}min
                          </span>
                        </td>

                        {/* Nivel recomendado */}
                        <td className="px-3 py-2.5">
                          {result.recommendedLevel ? (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                              {result.recommendedLevel}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                      </tr>

                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ Modal de detalle de resultado ════════════════════════════════════ */}
      {selectedResultId && (() => {
        const modalResult = results.find(r => r.id === selectedResultId);
        const statusPill = modalResult ? (resultStatusPill[modalResult.status] ?? resultStatusPill.completed) : null;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          >
            <div
              className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-card border border-border rounded-xl shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header sticky */}
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                  <span className="text-sm font-semibold text-foreground">Detalle del resultado</span>
                  {modalResult && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-sm text-foreground/70 font-medium truncate max-w-[180px]">
                        {candidateNames[modalResult.candidateId] ?? `...${modalResult.candidateId.slice(-8)}`}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${getScoreColor(modalResult.percentage)}`}>
                        {modalResult.percentage.toFixed(1)}%
                      </span>
                      {statusPill && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusPill.cls}`}>
                          {statusPill.label}
                        </span>
                      )}
                    </>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={closeModal} className="shrink-0 h-7 w-7 p-0">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Body scrollable */}
              <div className="overflow-y-auto p-4 space-y-4">

                {/* Estado: cargando detalle */}
                {detailLoading && (
                  <div className="flex items-center gap-2 py-6">
                    <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      Cargando detalle del examen...
                    </span>
                  </div>
                )}

                              {/* Estado: error al cargar detalle */}
                              {!detailLoading && detailError && (
                                <div className="flex items-center gap-2 py-4">
                                  <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  <span className="text-sm text-red-600 dark:text-red-400">{detailError}</span>
                                </div>
                              )}

                              {/* Contenido del detalle */}
                              {!detailLoading && !detailError && detailData && (
                                <>
                                  {/* Sección 1: Barras de competencias */}
                                  {detailData.competencyScores.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                        Competencias
                                      </p>
                                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                        {detailData.competencyScores.map((cs) => (
                                          <div
                                            key={cs.competency}
                                            className="bg-muted/50 border border-border rounded-lg px-3 py-2 space-y-1"
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <span className="text-xs text-foreground/80 capitalize truncate">
                                                {cs.competency}
                                              </span>
                                              <span
                                                className={`text-xs font-semibold shrink-0 ${getScoreColor(cs.percentage)}`}
                                              >
                                                {cs.percentage.toFixed(0)}%
                                              </span>
                                            </div>
                                            <div
                                              className="h-1 w-full rounded-full bg-muted overflow-hidden"
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
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                              <span>{cs.totalScore}/{cs.maxScore} pts</span>
                                              {cs.pendingEvaluationCount > 0 && (
                                                <span className="text-yellow-600 dark:text-yellow-500">
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
                                    <div className="bg-muted/40 border border-border rounded-lg px-3 py-2.5">
                                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                        Retroalimentación general
                                      </p>
                                      <p className="text-xs text-foreground/80 italic leading-relaxed">
                                        {detailData.overallFeedback}
                                      </p>
                                    </div>
                                  )}

                                  {/* Sección 3: Lista de preguntas */}
                                  {detailData.questionResults.length > 0 && (
                                    <div className="space-y-3">
                                      <div className="flex items-center gap-2">
                                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                          Preguntas
                                        </p>
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                                          {detailData.questionResults.length}
                                        </span>
                                      </div>

                                      {detailData.questionResults.map((qr, qIdx) => {
                                        const qScorePct = qr.maxScore > 0 ? (qr.score / qr.maxScore) * 100 : 0;
                                        const methodLabel = qr.evaluationMethod === "automatic" ? "Automática" : qr.evaluationMethod === "ai_grading" ? "IA" : "Manual";
                                        const methodCls = qr.evaluationMethod === "automatic"
                                          ? "bg-muted/60 text-muted-foreground border-border/40"
                                          : qr.evaluationMethod === "ai_grading"
                                          ? "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700/40"
                                          : "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700/40";
                                        const scoreCls = qr.isCorrect === true
                                          ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40"
                                          : qr.isCorrect === false
                                          ? "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/40"
                                          : "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40";

                                        return (
                                          <div key={qr.questionId} className="bg-muted/30 border border-border rounded-xl overflow-hidden">
                                            {/* Question header */}
                                            <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-border/50">
                                              <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                                                <span className="bg-muted text-foreground px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0">
                                                  #{qIdx + 1}
                                                </span>
                                                <span className="text-xs text-foreground/80 font-medium">
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
                                                    ? <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                    : <X className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
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
                                                <div className="bg-card border border-border rounded-lg px-3 py-2">
                                                  <p className="text-xs text-muted-foreground italic leading-relaxed">{qr.questionData.context}</p>
                                                </div>
                                              )}

                                              {/* Instructions */}
                                              {qr.questionData?.instructions && (
                                                <p className="text-xs text-muted-foreground">{qr.questionData.instructions}</p>
                                              )}

                                              {/* Question text */}
                                              {qr.questionData?.questionText && (
                                                <p className="text-sm text-foreground font-medium leading-snug">{qr.questionData.questionText}</p>
                                              )}

                                              {/* Media */}
                                              {renderMedia(qr.questionData)}

                                              {/* Response */}
                                              <div>
                                                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5">Respuesta del candidato</p>
                                                {renderResponse(qr)}
                                              </div>

                                              {/* Progress bar for score */}
                                              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                                                <div
                                                  className={`h-full rounded-full transition-all ${qScorePct >= 70 ? "bg-emerald-500" : qScorePct >= 40 ? "bg-orange-500" : "bg-red-500"}`}
                                                  style={{ width: `${Math.min(qScorePct, 100)}%` }}
                                                />
                                              </div>

                                              {/* Feedback */}
                                              {qr.feedback && (
                                                <div className="bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-700/30 rounded-lg px-3 py-2.5">
                                                  <p className="text-xs text-blue-700 dark:text-blue-300 font-medium mb-0.5">Retroalimentación</p>
                                                  <p className="text-xs text-blue-600 dark:text-blue-200 leading-relaxed">{qr.feedback}</p>
                                                </div>
                                              )}

                                              {/* AI Analysis */}
                                              {qr.aiAnalysis && (qr.aiAnalysis.feedback || (qr.aiAnalysis.suggestions?.length ?? 0) > 0) && (
                                                <div className="bg-purple-50 border border-purple-200 dark:bg-purple-900/20 dark:border-purple-700/30 rounded-lg px-3 py-2.5 space-y-2">
                                                  <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">Análisis IA</p>
                                                  {qr.aiAnalysis.feedback && (
                                                    <p className="text-xs text-purple-600 dark:text-purple-200 leading-relaxed">{qr.aiAnalysis.feedback}</p>
                                                  )}
                                                  {qr.aiAnalysis?.criteria && Object.keys(qr.aiAnalysis.criteria).length > 0 && (
                                                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                      {Object.entries(qr.aiAnalysis.criteria).map(([key, val]) => (
                                                        <span key={key} className="text-xs text-purple-700 dark:text-purple-300">
                                                          <span className="capitalize text-purple-500 dark:text-purple-400">{key}:</span>{" "}
                                                          <span className="font-medium">{typeof val === "number" ? val.toFixed(1) : String(val)}</span>
                                                        </span>
                                                      ))}
                                                    </div>
                                                  )}
                                                  {(qr.aiAnalysis.suggestions?.length ?? 0) > 0 && (
                                                    <ul className="space-y-0.5 text-xs text-purple-600 dark:text-purple-200 list-disc list-inside">
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
                          </div>
                        </div>
                      );
                    })()}

      {/* ══ Fila 5: Metadata footer ══════════════════════════════════════════ */}
      <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-muted-foreground px-1">
        {session._id && (
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground/60">ID</span>
            <span className="font-mono text-muted-foreground select-all">
              {session._id}
            </span>
          </span>
        )}
        {session.createdBy && (
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground/60">Creado por</span>
            <span className="text-muted-foreground">
              {typeof session.createdBy === 'object' && session.createdBy !== null
                ? `${(session.createdBy as any).firstName ?? ''} ${(session.createdBy as any).lastName ?? ''}`.trim()
                : session.createdBy}
            </span>
          </span>
        )}
        {session.createdAt && (
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground/60">Creacion</span>
            <span className="text-muted-foreground">{formatDate(session.createdAt)}</span>
          </span>
        )}
        {session.updatedAt && (
          <span className="flex items-center gap-1.5">
            <span className="text-muted-foreground/60">Actualizacion</span>
            <span className="text-muted-foreground">{formatDate(session.updatedAt)}</span>
          </span>
        )}
      </div>

    </div>
  );
};

export default SessionDetailView;
