import {
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Headphones,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { examService } from '@/services/examService';
import type { Competency, Level, Question, QuestionType } from '../types';

interface AIQuestionGeneratorProps {
  formData: Partial<Question>;
  onQuestionGenerated: (question: Partial<Question>, audioFile?: File | null) => void;
  onClose: () => void;
  // isOpen removed — parent controls mounting
}

interface GeneratedQuestionData {
  type: QuestionType;
  competency: Competency;
  level: Level;
  difficulty: number;
  content: {
    question: string;
    instructions?: string;
    context?: string;
    options?: Array<{ id: string; text: string; isCorrect: boolean }>;
    correctAnswer?: string | string[];
    sampleAnswer?: string;
    keywords?: string[];
    template?: string;
    blanks?: Array<{ position: number; correctAnswers: string[]; caseSensitive?: boolean }>;
    items?: Array<{ id: string; content: string; matchingPair?: string; correctPosition?: number }>;
  };
  metadata: {
    topic: string;
    subtopic?: string;
    tags: string[];
    estimatedTime?: number;
    points: number;
  };
  isActive: boolean;
}

interface AIGenerationResponse {
  success: boolean;
  data: { question: GeneratedQuestionData; savedId?: string; model: string };
}

interface BulkResult {
  index: number;
  question: GeneratedQuestionData;
  model: string;
  accepted: boolean;
  savedId?: string;
  retried?: boolean;
}

// ── Jaccard similarity on content words (length > 3) ──────────────────────────
function jaccardSimilarity(a: string, b: string): number {
  const words = (s: string) =>
    new Set(s.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const A = words(a);
  const B = words(b);
  if (A.size === 0 || B.size === 0) return 0;
  const intersection = [...A].filter((x) => B.has(x)).length;
  return intersection / (A.size + B.size - intersection);
}
const SIMILARITY_THRESHOLD = 0.5;

// ── Error sanitizer ───────────────────────────────────────────────────────────
function safeErr(err: any, fallback = 'Ocurrió un error inesperado'): string {
  const raw: string = err?.response?.data?.message || err?.message || fallback;
  if (typeof raw !== 'string') return fallback;
  // JSON dump o stack trace → no mostrar
  if (raw.trimStart().startsWith('{') || raw.trimStart().startsWith('[') || raw.includes('\n    at ')) return fallback;
  const clean = raw.replace(/https?:\/\/\S+/g, '').trim();
  return clean.length > 90 ? clean.slice(0, 87) + '…' : clean || fallback;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function toFormQuestion(q: GeneratedQuestionData, mediaBlobUrl?: string): Partial<Question> {
  return {
    type: q.type,
    competency: q.competency,
    level: q.level,
    difficulty: q.difficulty,
    content: {
      question: q.content.question,
      instructions: q.content.instructions || '',
      context: q.content.context || '',
      options: q.content.options || [],
      correctAnswer: q.content.correctAnswer || '',
      keywords: q.content.keywords || [],
      template: q.content.template,
      blanks: q.content.blanks,
      items: q.content.items || [],
      // For audio_response questions, ensure expectedResponseType is set
      ...((q.type === 'audio_response' || q.type === 'speaking')
        ? { expectedResponseType: (q.content as any).expectedResponseType || 'sentence' }
        : {}),
      // For listening questions, pass the blob URL so the form can preview the audio.
      // This is a session-local URL — the teacher should upload the audio file separately.
      ...(mediaBlobUrl ? { mediaUrl: mediaBlobUrl, mediaType: 'audio' as const } : {}),
    },
    metadata: {
      topic: q.metadata.topic || '',
      subtopic: q.metadata.subtopic || '',
      tags: q.metadata.tags || [],
      estimatedTime: q.metadata.estimatedTime,
      points: q.metadata.points || 1,
    },
    points: q.metadata.points || 1,
    isActive: q.isActive,
  };
}

function getCompetencyLabel(comp: string) {
  const labels: Record<string, string> = {
    reading: 'Comprensión Lectora',
    writing: 'Expresión Escrita',
    listening: 'Comprensión Auditiva',
    speaking: 'Expresión Oral',
  };
  return labels[comp] || comp;
}

function getTypeLabel(type: string) {
  const labels: Record<string, string> = {
    multiple_choice: 'Opción Múltiple',
    true_false: 'Verdadero/Falso',
    open_text: 'Texto Abierto',
    essay: 'Ensayo',
    fill_blanks: 'Completar Espacios',
    drag_drop: 'Arrastrar y Soltar',
    matching: 'Emparejar',
    ordering: 'Ordenar',
    audio_response: 'Respuesta de Audio',
    file_upload: 'Subir Archivo',
  };
  return labels[type] || type;
}

// ── Question preview card (shared between single and bulk) ────────────────────
const QuestionPreviewCard: React.FC<{
  question: GeneratedQuestionData;
  compact?: boolean;
}> = ({ question, compact }) => (
  <div className={`space-y-3 ${compact ? 'text-sm' : ''}`}>
    <div>
      <p className="text-xs text-muted-foreground mb-1">Pregunta</p>
      <p className="text-foreground leading-relaxed">{question.content.question}</p>
    </div>

    {question.content.context && (
      <div>
        <p className="text-xs text-muted-foreground mb-1">
          {question.competency === 'listening' ? 'Transcripción / Contexto' : 'Contexto'}
        </p>
        <p className="text-foreground/80 italic">{question.content.context}</p>
      </div>
    )}

    {question.content.options && question.content.options.length > 0 && (
      <div className="space-y-1">
        {question.content.options.map((opt, i) => (
          <div
            key={opt.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded border ${
              opt.isCorrect
                ? 'border-green-300 dark:border-green-600/40 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                : 'border-border bg-muted/20 text-foreground/80'
            }`}
          >
            <span className="text-muted-foreground text-xs w-4 flex-shrink-0">
              {String.fromCharCode(65 + i)}
            </span>
            <span>{opt.text}</span>
            {opt.isCorrect && <Check className="w-3 h-3 ml-auto text-green-600 dark:text-green-400 flex-shrink-0" />}
          </div>
        ))}
      </div>
    )}

    {question.content.template && (
      <div>
        <p className="text-xs text-muted-foreground mb-1">Plantilla</p>
        <p className="font-mono text-foreground bg-muted px-3 py-2 rounded">
          {question.content.template}
        </p>
      </div>
    )}

    {question.content.items && question.content.items.length > 0 && !compact && (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground mb-1">Elementos</p>
        {question.content.items.map((item) => (
          <div
            key={item.id}
            className="flex justify-between items-center px-3 py-1.5 bg-muted/30 rounded border border-border text-sm"
          >
            <span className="text-foreground">{item.content}</span>
            {item.matchingPair && (
              <span className="text-blue-600 dark:text-blue-300 text-xs">↔ {item.matchingPair}</span>
            )}
            {item.correctPosition !== undefined && (
              <span className="px-1.5 py-0.5 text-xs rounded border border-border text-muted-foreground">
                #{item.correctPosition}
              </span>
            )}
          </div>
        ))}
      </div>
    )}

    {question.content.sampleAnswer && (
      <div>
        <p className="text-xs text-muted-foreground mb-1">Respuesta de referencia</p>
        <p className="text-foreground/80 italic bg-muted/50 px-3 py-2 rounded text-sm">
          "{question.content.sampleAnswer}"
        </p>
      </div>
    )}

    <div className="flex flex-wrap gap-1.5 pt-1">
      <span className="px-1.5 py-0.5 text-xs rounded border border-border text-muted-foreground">
        📚 {question.metadata.topic}
      </span>
      <span className="px-1.5 py-0.5 text-xs rounded border border-border text-muted-foreground">
        ⭐ {question.metadata.points ?? 1}pt
      </span>
      {question.metadata.estimatedTime && (
        <span className="px-1.5 py-0.5 text-xs rounded border border-border text-muted-foreground">
          ⏱ {question.metadata.estimatedTime}min
        </span>
      )}
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────
const AIQuestionGenerator: React.FC<AIQuestionGeneratorProps> = ({
  formData,
  onQuestionGenerated,
  onClose,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Single-question state
  const [generatedQuestion, setGeneratedQuestion] = useState<GeneratedQuestionData | null>(null);
  const [modelUsed, setModelUsed] = useState('');
  const [savedId, setSavedId] = useState<string | undefined>();
  const [step, setStep] = useState<'config' | 'generating' | 'preview' | 'bulk-results' | 'complete'>('config');

  // Shared config
  const [thematicContext, setThematicContext] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Bulk state
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [bulkPartial, setBulkPartial] = useState(false);

  // ── Listening audio state ──────────────────────────────────────────────────
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState('');
  const [audioTranscript, setAudioTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [transcriptMeta, setTranscriptMeta] = useState<{ isDialogue: boolean; speakersDetected: number } | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);
  const transcriptRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand transcript textarea cuando cambia el contenido
  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [audioTranscript, showTranscript]);

  const isListening = formData.competency === 'listening';
  const canGenerate = !!(formData.competency && formData.level && formData.type);
  const gradingUrl = (import.meta as any).env?.VITE_API_GATEWAY_URL || 'http://localhost:80';

  // ── Format transcript via GROQ (dialogue detection + speaker labels) ────────
  const formatTranscript = async (raw: string): Promise<string> => {
    setIsFormatting(true);
    try {
      const res = await fetch(`${gradingUrl}/api/v1/grading/format-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: raw }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) return raw; // silently fallback
      setTranscriptMeta({ isDialogue: data.data.isDialogue, speakersDetected: data.data.speakersDetected });
      return data.data.formatted;
    } catch {
      return raw; // network error → use raw
    } finally {
      setIsFormatting(false);
    }
  };

  // ── Transcribe audio file via GROQ Whisper ─────────────────────────────────
  const handleTranscribe = async (file: File) => {
    setIsTranscribing(true);
    setAudioTranscript('');
    setTranscriptMeta(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const ext = file.name.split('.').pop()?.toLowerCase() || 'webm';
      const res = await fetch(`${gradingUrl}/api/v1/grading/transcribe-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioData: base64, mimeType: file.type || 'audio/webm', ext }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Error al transcribir');

      setIsTranscribing(false);
      const formatted = await formatTranscript(data.data.transcript);
      setAudioTranscript(formatted);
      setShowTranscript(true);
      toast.success('Audio transcrito y formateado');
    } catch (err: any) {
      toast.error(safeErr(err, 'No se pudo transcribir el audio'));
    } finally {
      setIsTranscribing(false);
    }
  };

  // ── Select audio file (auto-transcribes) ──────────────────────────────────
  const handleFileSelect = async (file: File) => {
    if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
    setAudioFile(file);
    setAudioBlobUrl(URL.createObjectURL(file));
    setAudioTranscript('');
    setShowTranscript(false);
    await handleTranscribe(file);
  };

  // ── Shared generate call ───────────────────────────────────────────────────
  const callGenerateEndpoint = async (avoidQuestions: string[]) => {
    const res = await fetch(`${gradingUrl}/api/v1/grading/generate-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competency: formData.competency,
        level: formData.level,
        type: formData.type,
        difficulty: formData.difficulty || 3,
        topic: formData.metadata?.topic || undefined,
        // Listening with transcript → use it as source of truth for the AI
        // Any other competency → use free-text thematic context
        ...(isListening && audioTranscript.trim()
          ? { audioTranscript: audioTranscript.trim() }
          : { thematicContext: thematicContext.trim() || undefined }
        ),
        save: false,
        avoidQuestions: avoidQuestions.slice(0, 20),
      }),
    });
    const data: AIGenerationResponse = await res.json();
    if (res.status === 429) {
      const errMsg = (data as any)?.error?.message || '';
      const retryMatch = errMsg.match(/try again in (.+?)\./i);
      const retryInfo = retryMatch ? ` Intenta en ${retryMatch[1]}.` : ' Intenta mañana o actualiza tu plan.';
      const rateLimitError = new Error(`Límite diario de tokens GROQ alcanzado.${retryInfo}`);
      (rateLimitError as any).isRateLimit = true;
      throw rateLimitError;
    }
    if (!res.ok || !data.success) throw new Error((data as any).error || `Error ${res.status}`);
    return data.data;
  };

  // ── Single generation ──────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!canGenerate) {
      toast.error('Completa competencia, nivel y tipo antes de generar');
      return;
    }
    setIsGenerating(true);
    setStep('generating');
    try {
      const data = await callGenerateEndpoint([]);
      setGeneratedQuestion(data.question);
      setModelUsed(data.model);
      setSavedId(undefined);
      setStep('preview');
      toast.success(`Pregunta generada con ${data.model.split('-').slice(0, 3).join('-')}`);
    } catch (err: any) {
      toast.error(safeErr(err, 'Error al generar pregunta'), { duration: err.isRateLimit ? 10000 : 4000 });
      setStep('config');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Bulk generation ────────────────────────────────────────────────────────
  const handleBulkGenerate = async () => {
    if (!canGenerate) {
      toast.error('Completa competencia, nivel y tipo antes de generar');
      return;
    }
    setIsGenerating(true);
    setStep('generating');
    setBulkProgress(0);
    setBulkResults([]);
    setBulkPartial(false);

    const generatedTexts: string[] = [];
    const results: BulkResult[] = [];
    let rateLimitHit = false;

    for (let i = 0; i < quantity; i++) {
      try {
        let data = await callGenerateEndpoint(generatedTexts);
        let retried = false;

        const newText = data.question.content.question;
        const tooSimilar = generatedTexts.some(
          (t) => jaccardSimilarity(t, newText) > SIMILARITY_THRESHOLD,
        );
        if (tooSimilar) {
          data = await callGenerateEndpoint(generatedTexts);
          retried = true;
        }

        generatedTexts.push(data.question.content.question);
        results.push({ index: i, question: data.question, model: data.model, accepted: true, retried });
      } catch (err: any) {
        if ((err as any).isRateLimit) {
          toast.error(safeErr(err, 'Límite de generación alcanzado'), { duration: 10000 });
          rateLimitHit = true;
          break;
        }
        // Errores individuales: se registran silenciosamente, no toast
      }

      setBulkProgress(i + 1);
      setBulkResults([...results]);

      if (i < quantity - 1) await new Promise((r) => setTimeout(r, 350));
    }

    setIsGenerating(false);
    setBulkPartial(rateLimitHit);
    setStep('bulk-results');
    if (results.length > 0) {
      toast.success(
        rateLimitHit
          ? `${results.length} de ${quantity} preguntas generadas (límite alcanzado)`
          : `${results.length} preguntas generadas`,
      );
    }
  };

  // ── Single: save to DB ─────────────────────────────────────────────────────
  const handleSaveSingle = async () => {
    if (!generatedQuestion) return;
    setIsSaving(true);
    try {
      // Convertir a formato Question (sin blob URL)
      const questionData = toFormQuestion(generatedQuestion);
      if (questionData.content?.mediaUrl?.startsWith('blob:')) {
        delete questionData.content.mediaUrl;
        delete questionData.content.mediaType;
      }

      let savedId: string;
      if (isListening && audioFile) {
        // Subir audio a MinIO vía exam-service
        const res = await examService.createQuestionWithMedia(questionData, audioFile, 'audio');
        savedId = (res.data as any)?._id || (res as any)?.data?._id || '';
      } else {
        const res = await examService.createQuestion(questionData);
        savedId = (res.data as any)?._id || (res as any)?.data?._id || '';
      }

      setSavedId(savedId);
      toast.success(`Guardada (ID: ${savedId?.slice(-6)})`);
    } catch (err: any) {
      toast.error(safeErr(err, 'No se pudo guardar la pregunta'));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Single: apply to form ──────────────────────────────────────────────────
  const handleAcceptSingle = () => {
    if (!generatedQuestion) return;
    onQuestionGenerated(
      toFormQuestion(generatedQuestion, isListening ? audioBlobUrl : undefined),
      isListening ? audioFile : null
    );
    setStep('complete');
    toast.success('Pregunta aplicada al formulario');
    setTimeout(() => { onClose(); resetState(); }, 1500);
  };

  // ── Bulk: toggle accept/reject ─────────────────────────────────────────────
  const toggleAccept = (index: number) => {
    setBulkResults((prev) =>
      prev.map((r) => (r.index === index ? { ...r, accepted: !r.accepted } : r)),
    );
  };

  // ── Bulk: save accepted to DB ──────────────────────────────────────────────
  const handleBulkSave = async () => {
    const toSave = bulkResults.filter((r) => r.accepted && !r.savedId);
    if (toSave.length === 0) {
      toast.info('No hay preguntas aceptadas pendientes de guardar');
      return;
    }
    setIsBulkSaving(true);
    let savedCount = 0;
    const isListeningBulk = toSave.some(r => r.question.competency === 'listening');
    if (isListeningBulk && !audioFile) {
      toast.error('Las preguntas de listening requieren el archivo de audio. Súbelo primero.');
      setIsBulkSaving(false);
      return;
    }

    for (const result of toSave) {
      try {
        const questionData = toFormQuestion(result.question);
        // Strip blob URLs — se reemplazarán con la URL real al subir el archivo
        if (questionData.content?.mediaUrl?.startsWith('blob:')) {
          delete questionData.content.mediaUrl;
          delete questionData.content.mediaType;
        }

        let res: any;
        if (result.question.competency === 'listening' && audioFile) {
          // Subir pregunta + audio en una sola llamada
          res = await examService.createQuestionWithMedia(questionData, audioFile, 'audio');
        } else {
          res = await examService.createQuestion(questionData);
        }
        const savedId = (res.data as any)?._id || (res as any)?.data?._id || '';
        setBulkResults((prev) =>
          prev.map((r) =>
            r.index === result.index ? { ...r, savedId } : r,
          ),
        );
        savedCount++;
      } catch (err: any) {
        toast.error(safeErr(err, `No se pudo guardar pregunta ${result.index + 1}`));
      }
    }
    setIsBulkSaving(false);
    if (savedCount > 0) {
      toast.success(`${savedCount} pregunta(s) guardada(s) — listo para generar más`);
      setTimeout(() => resetState(), 1800);
    }
  };

  const resetState = () => {
    setIsGenerating(false);
    setIsSaving(false);
    setGeneratedQuestion(null);
    setModelUsed('');
    setSavedId(undefined);
    setStep('config');
    setThematicContext('');
    setQuantity(1);
    setBulkProgress(0);
    setBulkResults([]);
    setBulkPartial(false);
    setExpandedIndex(null);
    // Audio cleanup
    if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
    setAudioFile(null);
    setAudioBlobUrl('');
    setAudioTranscript('');
    setIsTranscribing(false);
    setShowTranscript(false);
  };

  const handleClose = () => { resetState(); onClose(); };

  const acceptedCount = bulkResults.filter((r) => r.accepted).length;
  const unsavedAccepted = bulkResults.filter((r) => r.accepted && !r.savedId).length;

  // ── Generate button label ──────────────────────────────────────────────────
  const generateButtonLabel = () => {
    if (quantity > 1) return `Generar ${quantity} preguntas`;
    if (isListening && audioTranscript.trim()) return 'Generar desde Audio';
    if (thematicContext.trim()) return 'Generar con Contexto';
    return 'Generar Pregunta';
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-muted/30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500 dark:text-purple-400" />
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-none">Generar con IA</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Basado en los parámetros actuales</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* ── Config panel (always visible in config/generating) ── */}
        {(step === 'config' || step === 'generating') && (
          <div className="bg-muted/50 border border-border rounded-lg p-3 sm:p-4 space-y-4">
            {/* Parameters badges */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Parámetros</h3>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-1.5 py-0.5 text-xs rounded border border-blue-300 dark:border-blue-500/30 text-blue-600 dark:text-blue-300">
                  {getCompetencyLabel(formData.competency || '')}
                </span>
                <span className="px-1.5 py-0.5 text-xs rounded border border-green-300 dark:border-green-500/30 text-green-700 dark:text-green-300">
                  Nivel {formData.level}
                </span>
                <span className="px-1.5 py-0.5 text-xs rounded border border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-300">
                  {getTypeLabel(formData.type || '')}
                </span>
                <span className="px-1.5 py-0.5 text-xs rounded border border-orange-300 dark:border-orange-500/30 text-orange-600 dark:text-orange-300">
                  Dificultad {formData.difficulty || 3}/5
                </span>
                {formData.metadata?.topic && (
                  <span className="px-1.5 py-0.5 text-xs rounded border border-border text-muted-foreground">
                    {formData.metadata.topic}
                  </span>
                )}
              </div>
            </div>

            {/* Quantity selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground/80">
                  Cantidad
                </label>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-foreground leading-none">{quantity}</span>
                  <span className="text-xs text-muted-foreground">
                    {quantity === 1 ? 'pregunta' : `preguntas (~${quantity * 5}s)`}
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                disabled={isGenerating}
                className="w-full accent-purple-500 disabled:opacity-50"
              />
              <div className="flex justify-between text-xs text-muted-foreground/50 -mt-1">
                <span>1</span><span>5</span><span>10</span>
              </div>
            </div>

            {/* ── Listening: audio upload zone ── */}
            {isListening ? (
              <div>
                <label className="text-sm font-medium text-foreground/80 mb-2 block">
                  Audio de referencia{' '}
                  <span className="text-muted-foreground font-normal">(la IA generará la pregunta desde la transcripción)</span>
                </label>

                {!audioFile ? (
                  /* Drop zone */
                  <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isGenerating ? 'border-border opacity-50 cursor-not-allowed' : 'border-border hover:border-purple-500/60 hover:bg-purple-50 dark:hover:bg-purple-900/10'}`}>
                    <Upload className="w-6 h-6 text-muted-foreground/70 mb-1.5" />
                    <span className="text-sm text-muted-foreground">Sube un archivo de audio</span>
                    <span className="text-xs text-muted-foreground/60 mt-0.5">MP3, WAV, WebM, M4A — hasta ~10MB</span>
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      disabled={isGenerating}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                    />
                  </label>
                ) : (
                  <div className="space-y-2">
                    {/* File info row */}
                    <div className="flex items-center gap-2 bg-muted/50 border border-border rounded-lg px-3 py-2">
                      <Headphones className="w-4 h-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                      <span className="text-sm text-foreground/90 flex-1 truncate min-w-0">{audioFile.name}</span>
                      <label className={`text-xs flex-shrink-0 cursor-pointer underline-offset-2 hover:underline ${isGenerating || isTranscribing ? 'text-muted-foreground pointer-events-none' : 'text-muted-foreground/70 hover:text-foreground'}`}>
                        Cambiar
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          disabled={isGenerating || isTranscribing}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileSelect(file);
                          }}
                        />
                      </label>
                    </div>

                    {/* Native audio preview */}
                    <audio
                      src={audioBlobUrl}
                      controls
                      className="w-full h-9"
                      style={{ colorScheme: 'dark', accentColor: '#a855f7' }}
                    />

                    {/* Transcription status */}
                    {(isTranscribing || isFormatting) && (
                      <div className="flex items-center gap-2 text-sm text-purple-700 dark:text-purple-300 py-1">
                        <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                        {isTranscribing ? 'Transcribiendo con Whisper...' : 'Interpretando formato...'}
                      </div>
                    )}

                    {/* Transcript block */}
                    {audioTranscript && !isTranscribing && !isFormatting && (
                      <div className="bg-popover border border-border rounded-lg overflow-hidden">
                        <button
                          onClick={() => setShowTranscript(!showTranscript)}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                        >
                          <span className="flex items-center gap-1.5">
                            <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                            Transcripción lista
                            {transcriptMeta && (
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                transcriptMeta.isDialogue
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                  : 'bg-muted text-muted-foreground'
                              }`}>
                                {transcriptMeta.isDialogue
                                  ? `Diálogo · ${transcriptMeta.speakersDetected} hablantes`
                                  : 'Narración'}
                              </span>
                            )}
                          </span>
                          {showTranscript
                            ? <ChevronUp className="w-3 h-3" />
                            : <ChevronDown className="w-3 h-3" />
                          }
                        </button>
                        {showTranscript && (
                          <div className="px-3 pb-3 space-y-1.5">
                            <textarea
                              ref={transcriptRef}
                              value={audioTranscript}
                              onChange={(e) => setAudioTranscript(e.target.value)}
                              className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y overflow-y-auto transition-[height] duration-150 font-mono"
                              style={{ minHeight: '72px' }}
                              disabled={isGenerating}
                            />
                            <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
                              <Pencil className="w-3 h-3" />
                              Puedes corregir el transcript antes de generar
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Re-transcribe / Transcribe button */}
                    {!isTranscribing && (
                      <button
                        type="button"
                        onClick={() => handleTranscribe(audioFile)}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg border border-border text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {audioTranscript ? 'Re-transcribir' : 'Transcribir'}
                      </button>
                    )}
                  </div>
                )}

                {audioTranscript && (
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    La pregunta se basará en este audio. Vincula el archivo al guardar la pregunta (campo mediaUrl).
                  </p>
                )}
              </div>
            ) : (
              /* ── Non-listening: thematic context textarea ── */
              <div>
                <label className="text-sm font-medium text-foreground/80 mb-2 block">
                  Contexto Temático <span className="text-muted-foreground font-normal">(Opcional)</span>
                </label>
                <textarea
                  value={thematicContext}
                  onChange={(e) => setThematicContext(e.target.value)}
                  placeholder="Ej: 'Una familia planeando sus vacaciones de verano', 'El cambio climático', 'La vida universitaria'..."
                  className="w-full px-3 py-2 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                  style={{ minHeight: '70px' }}
                  disabled={isGenerating}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Config step: generate button ── */}
        {step === 'config' && (
          <div className="text-center py-4">
            {/* Warn if listening without transcript */}
            {isListening && audioFile && !audioTranscript && !isTranscribing && (
              <p className="text-amber-600 dark:text-amber-400 text-xs mb-3">
                Transcribe el audio primero para obtener mejores resultados.
              </p>
            )}
            <button
              type="button"
              onClick={quantity === 1 ? handleGenerate : handleBulkGenerate}
              disabled={!canGenerate || isTranscribing}
              className="w-full flex items-center justify-center gap-2 h-9 px-4 text-sm rounded-lg bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles className="w-4 h-4" />
              {generateButtonLabel()}
            </button>
            {!canGenerate && (
              <p className="text-amber-600 dark:text-amber-400 text-sm mt-3">
                Completa competencia, nivel y tipo antes de generar
              </p>
            )}
          </div>
        )}

        {/* ── Generating step: spinner / progress ── */}
        {step === 'generating' && (
          <div className="text-center py-8 space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-purple-500 dark:text-purple-400 mx-auto" />
            {quantity === 1 ? (
              <p className="text-muted-foreground">Generando pregunta...</p>
            ) : (
              <>
                <p className="text-muted-foreground font-medium">
                  Generando pregunta {Math.min(bulkProgress + 1, quantity)} de {quantity}...
                </p>
                <div className="max-w-xs mx-auto">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${(bulkProgress / quantity) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    {bulkProgress} / {quantity} completadas
                  </p>
                </div>
                {bulkResults.length > 0 && (
                  <div className="text-left max-w-lg mx-auto space-y-1.5 mt-2">
                    {bulkResults.map((r) => (
                      <div
                        key={r.index}
                        className="flex items-start gap-2 text-xs text-muted-foreground/70 bg-muted/50 rounded px-3 py-2"
                      >
                        <Check className="w-3 h-3 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">{r.question.content.question}</span>
                        {r.retried && (
                          <span className="px-1.5 py-0.5 text-xs rounded border border-yellow-300 dark:border-yellow-600/40 text-yellow-600 dark:text-yellow-400 ml-auto flex-shrink-0">
                            reintento
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Single preview step ── */}
        {step === 'preview' && generatedQuestion && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-foreground flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Vista Previa
              </h3>
              <div className="flex items-center gap-2">
                {savedId && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-green-600 dark:bg-green-700 text-white">✓ Guardada ({savedId.slice(-6)})</span>
                )}
                <span className="px-1.5 py-0.5 text-xs rounded border border-border text-muted-foreground">
                  {modelUsed.split('-').slice(0, 3).join('-')}
                </span>
              </div>
            </div>

            {/* Audio preview in single-question step */}
            {isListening && audioBlobUrl && (
              <div className="flex items-center gap-2 bg-muted/60 border border-purple-300 dark:border-purple-600/30 rounded-lg px-3 py-2">
                <Headphones className="w-4 h-4 text-purple-500 dark:text-purple-400 flex-shrink-0" />
                <audio
                  src={audioBlobUrl}
                  controls
                  className="flex-1 h-8"
                  style={{ colorScheme: 'dark', accentColor: '#a855f7' }}
                />
              </div>
            )}

            <div className="bg-muted/50 border border-border rounded-lg p-4 sm:p-5">
              <QuestionPreviewCard question={generatedQuestion} />
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => { setGeneratedQuestion(null); setStep('config'); }}
                disabled={isGenerating || isSaving}
                className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg border border-border text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                Regenerar
              </button>
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg border border-border text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Cancelar
                </button>
                {!savedId && (
                  <button
                    type="button"
                    onClick={handleSaveSingle}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Guardar en BD
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleAcceptSingle}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Aplicar al Formulario
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Bulk results step ── */}
        {step === 'bulk-results' && (
          <div className="space-y-4">
            {bulkPartial && (
              <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-600/40 rounded-lg px-4 py-3 text-sm">
                <span className="text-amber-600 dark:text-amber-400 text-lg leading-none">⚠</span>
                <div className="text-amber-700 dark:text-amber-200">
                  <p className="font-medium">Límite diario de GROQ alcanzado</p>
                  <p className="text-amber-700 dark:text-amber-300 text-xs mt-0.5">
                    Se generaron {bulkResults.length} de {quantity} preguntas antes de alcanzar el límite.
                    Guarda las que obtuviste y vuelve a generar el resto mañana o actualiza tu plan en{' '}
                    <span className="font-mono">console.groq.com</span>.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-foreground">
                {bulkResults.length} {bulkPartial ? `de ${quantity} ` : ''}preguntas generadas
                <span className="text-muted-foreground/70 font-normal text-sm ml-2">
                  · {acceptedCount} aceptadas
                </span>
              </h3>
              <button
                type="button"
                onClick={() => { setBulkResults([]); setStep('config'); }}
                className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg border border-border text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                Regenerar lote
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {bulkResults.map((result) => (
                <div
                  key={result.index}
                  className={`border rounded-lg transition-colors ${
                    result.accepted
                      ? result.savedId
                        ? 'border-blue-300 dark:border-blue-600/40 bg-blue-50 dark:bg-blue-900/10'
                        : 'border-green-300 dark:border-green-600/40 bg-green-50 dark:bg-green-900/10'
                      : 'border-border/40 bg-muted/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleAccept(result.index)}
                      disabled={!!result.savedId}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        result.accepted
                          ? 'border-green-500 bg-green-500/20 text-green-600 dark:text-green-400'
                          : 'border-border bg-transparent text-muted-foreground'
                      } ${result.savedId ? 'cursor-not-allowed' : 'cursor-pointer hover:border-green-400'}`}
                      title={result.savedId ? 'Ya guardada' : result.accepted ? 'Rechazar' : 'Aceptar'}
                    >
                      {result.accepted && <Check className="w-3 h-3" />}
                    </button>

                    <p className="flex-1 text-sm text-foreground/90 line-clamp-1 min-w-0">
                      <span className="text-muted-foreground/60 mr-1.5">#{result.index + 1}</span>
                      {result.question.content.question}
                    </p>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {result.retried && (
                        <span className="px-1.5 py-0.5 text-xs rounded border border-yellow-300 dark:border-yellow-600/40 text-yellow-600 dark:text-yellow-400">
                          variado
                        </span>
                      )}
                      {result.savedId && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-blue-600 dark:bg-blue-700 text-white">
                          ✓ {result.savedId.slice(-5)}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedIndex(expandedIndex === result.index ? null : result.index)
                      }
                      className="text-muted-foreground/70 hover:text-foreground transition-colors ml-1 flex-shrink-0"
                    >
                      {expandedIndex === result.index ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {expandedIndex === result.index && (
                    <div className="px-4 pb-4 border-t border-border/50 pt-3">
                      <QuestionPreviewCard question={result.question} compact />
                      {!result.savedId && (
                        <div className="mt-3 flex justify-end">
                          <button
                            type="button"
                            className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg border border-purple-300 dark:border-purple-600/50 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors"
                            onClick={() => {
                              onQuestionGenerated(
                                toFormQuestion(result.question, isListening ? audioBlobUrl : undefined),
                                isListening ? audioFile : null
                              );
                              toast.success(`Pregunta #${result.index + 1} aplicada al formulario`);
                              handleClose();
                            }}
                          >
                            Aplicar al formulario
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-border">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setBulkResults((prev) => prev.map((r) => ({ ...r, accepted: !r.savedId ? true : r.accepted })))
                  }
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Seleccionar todas
                </button>
                <span className="text-muted-foreground">·</span>
                <button
                  type="button"
                  onClick={() =>
                    setBulkResults((prev) => prev.map((r) => ({ ...r, accepted: !!r.savedId })))
                  }
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                >
                  Deseleccionar
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleBulkSave}
                  disabled={isBulkSaving || unsavedAccepted === 0}
                  className="w-full flex items-center justify-center gap-1.5 h-8 px-3 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                >
                  {isBulkSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Guardar {unsavedAccepted > 0 ? `${unsavedAccepted} seleccionadas` : 'seleccionadas'}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full flex items-center justify-center gap-1.5 h-8 px-3 text-xs rounded-lg border border-border text-foreground hover:bg-muted/60 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Complete step ── */}
        {step === 'complete' && (
          <div className="text-center py-8 space-y-3">
            <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
              <Check className="w-7 h-7 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-base font-medium text-foreground">¡Pregunta Aplicada!</h3>
            <p className="text-muted-foreground/70 text-sm">La pregunta generada se ha cargado en tu formulario</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default AIQuestionGenerator;
