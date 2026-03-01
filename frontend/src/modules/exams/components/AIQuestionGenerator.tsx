import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/atoms/dialog';
import { Textarea } from '@/components/atoms/textarea';
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
import React, { useState } from 'react';
import { toast } from 'sonner';
import { examService } from '@/services/examService';
import type { Competency, Level, Question, QuestionType } from '../types';

interface AIQuestionGeneratorProps {
  formData: Partial<Question>;
  onQuestionGenerated: (question: Partial<Question>, audioFile?: File | null) => void;
  isOpen: boolean;
  onClose: () => void;
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
    grammar: 'Gramática',
    vocabulary: 'Vocabulario',
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
                ? 'border-green-600/40 bg-green-900/20 text-green-300'
                : 'border-border bg-muted/20 text-foreground/80'
            }`}
          >
            <span className="text-muted-foreground text-xs w-4 flex-shrink-0">
              {String.fromCharCode(65 + i)}
            </span>
            <span>{opt.text}</span>
            {opt.isCorrect && <Check className="w-3 h-3 ml-auto text-green-400 flex-shrink-0" />}
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
              <span className="text-blue-300 text-xs">↔ {item.matchingPair}</span>
            )}
            {item.correctPosition !== undefined && (
              <Badge variant="outline" className="text-xs">
                #{item.correctPosition}
              </Badge>
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
      <Badge variant="outline" className="text-xs">
        📚 {question.metadata.topic}
      </Badge>
      <Badge variant="outline" className="text-xs">
        ⭐ {question.metadata.points ?? 1}pt
      </Badge>
      {question.metadata.estimatedTime && (
        <Badge variant="outline" className="text-xs">
          ⏱ {question.metadata.estimatedTime}min
        </Badge>
      )}
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────────
const AIQuestionGenerator: React.FC<AIQuestionGeneratorProps> = ({
  formData,
  onQuestionGenerated,
  isOpen,
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
  const [showTranscript, setShowTranscript] = useState(false);

  const isListening = formData.competency === 'listening';
  const canGenerate = !!(formData.competency && formData.level && formData.type);
  const gradingUrl = (import.meta as any).env?.VITE_API_GATEWAY_URL || 'http://localhost:80';

  // ── Transcribe audio file via GROQ Whisper ─────────────────────────────────
  const handleTranscribe = async (file: File) => {
    setIsTranscribing(true);
    setAudioTranscript('');
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

      setAudioTranscript(data.data.transcript);
      setShowTranscript(true);
      toast.success('Audio transcrito correctamente');
    } catch (err: any) {
      toast.error(`Error al transcribir: ${err.message}`);
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
      toast.error(err.message, { duration: err.isRateLimit ? 10000 : 4000 });
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
          toast.error(err.message, { duration: 10000 });
          rateLimitHit = true;
          break;
        }
        toast.error(`Error en pregunta ${i + 1}: ${err.message}`);
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
      toast.error(`Error al guardar: ${err?.response?.data?.message || err.message}`);
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
    for (const result of toSave) {
      try {
        const questionData = toFormQuestion(result.question);
        // Strip blob URLs (bulk no tiene audio por pregunta)
        if (questionData.content?.mediaUrl?.startsWith('blob:')) {
          delete questionData.content.mediaUrl;
          delete questionData.content.mediaType;
        }
        const res = await examService.createQuestion(questionData);
        const savedId = (res.data as any)?._id || (res as any)?.data?._id || '';
        setBulkResults((prev) =>
          prev.map((r) =>
            r.index === result.index ? { ...r, savedId } : r,
          ),
        );
        savedCount++;
      } catch (err: any) {
        toast.error(`Error guardando pregunta ${result.index + 1}: ${err?.response?.data?.message || err.message}`);
      }
    }
    setIsBulkSaving(false);
    if (savedCount > 0) toast.success(`${savedCount} pregunta(s) guardada(s) en la BD`);
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto bg-popover border border-line text-foreground">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            Generador de Preguntas con IA
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Genera una o varias preguntas únicas basadas en tus parámetros
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">

          {/* ── Config panel (always visible in config/generating) ── */}
          {(step === 'config' || step === 'generating') && (
            <div className="bg-muted/50 border border-border rounded-lg p-3 sm:p-4 space-y-4">
              {/* Parameters badges */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-3">Parámetros</h3>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="border-blue-500/30 text-blue-300 text-xs">
                    {getCompetencyLabel(formData.competency || '')}
                  </Badge>
                  <Badge variant="outline" className="border-green-500/30 text-green-300 text-xs">
                    Nivel {formData.level}
                  </Badge>
                  <Badge variant="outline" className="border-purple-500/30 text-purple-300 text-xs">
                    {getTypeLabel(formData.type || '')}
                  </Badge>
                  <Badge variant="outline" className="border-orange-500/30 text-orange-300 text-xs">
                    Dificultad {formData.difficulty || 3}/5
                  </Badge>
                  {formData.metadata?.topic && (
                    <Badge variant="outline" className="border-border text-muted-foreground text-xs">
                      {formData.metadata.topic}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Quantity selector */}
              <div>
                <label className="text-sm font-medium text-foreground/80 mb-2 block">
                  Cantidad de preguntas
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    disabled={isGenerating}
                    className="w-40 accent-purple-500"
                  />
                  <span className="text-foreground font-bold text-lg w-6 text-center">{quantity}</span>
                  <span className="text-muted-foreground/70 text-xs">
                    {quantity === 1 ? 'pregunta' : `preguntas (~${quantity * 5}s)`}
                  </span>
                </div>
                {quantity > 1 && (
                  <p className="text-xs text-purple-400 mt-1.5">
                    Cada pregunta se genera con contexto de las anteriores para evitar repetición.
                    Se revisa similitud automáticamente (Jaccard).
                  </p>
                )}
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
                    <label className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isGenerating ? 'border-border opacity-50 cursor-not-allowed' : 'border-border hover:border-purple-500/60 hover:bg-purple-900/10'}`}>
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
                        <Headphones className="w-4 h-4 text-purple-400 flex-shrink-0" />
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
                      {isTranscribing && (
                        <div className="flex items-center gap-2 text-sm text-purple-300 py-1">
                          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                          Transcribiendo con Whisper...
                        </div>
                      )}

                      {/* Transcript block */}
                      {audioTranscript && !isTranscribing && (
                        <div className="bg-popover border border-border rounded-lg overflow-hidden">
                          <button
                            onClick={() => setShowTranscript(!showTranscript)}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                          >
                            <span className="flex items-center gap-1.5">
                              <Check className="w-3 h-3 text-green-400" />
                              Transcripción lista
                            </span>
                            {showTranscript
                              ? <ChevronUp className="w-3 h-3" />
                              : <ChevronDown className="w-3 h-3" />
                            }
                          </button>
                          {showTranscript && (
                            <div className="px-3 pb-3 space-y-1.5">
                              <Textarea
                                value={audioTranscript}
                                onChange={(e) => setAudioTranscript(e.target.value)}
                                className="bg-muted/50 border border-border text-foreground/90 text-xs min-h-[80px] focus:ring-0 focus-visible:ring-0 focus:border-purple-400/50"
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
                        <Button
                          onClick={() => handleTranscribe(audioFile)}
                          size="sm"
                          variant="outline"
                          disabled={isGenerating}
                          className="gap-1.5 text-xs border-border text-muted-foreground/70 hover:bg-muted/30 hover:text-foreground"
                        >
                          <RefreshCw className="w-3 h-3" />
                          {audioTranscript ? 'Re-transcribir' : 'Transcribir'}
                        </Button>
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
                  <Textarea
                    value={thematicContext}
                    onChange={(e) => setThematicContext(e.target.value)}
                    placeholder="Ej: 'Una familia planeando sus vacaciones de verano', 'El cambio climático', 'La vida universitaria'..."
                    className="bg-muted/50 border border-border text-foreground/90 placeholder:text-muted-foreground min-h-[70px] text-sm focus:ring-0 focus-visible:ring-0 focus:border-purple-400/50"
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
                <p className="text-amber-400 text-xs mb-3">
                  Transcribe el audio primero para obtener mejores resultados.
                </p>
              )}
              <Button
                onClick={quantity === 1 ? handleGenerate : handleBulkGenerate}
                disabled={!canGenerate || isTranscribing}
                className="gap-2 bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 text-white px-8"
              >
                <Sparkles className="w-4 h-4" />
                {generateButtonLabel()}
              </Button>
              {!canGenerate && (
                <p className="text-amber-400 text-sm mt-3">
                  Completa competencia, nivel y tipo antes de generar
                </p>
              )}
            </div>
          )}

          {/* ── Generating step: spinner / progress ── */}
          {step === 'generating' && (
            <div className="text-center py-8 space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-purple-400 mx-auto" />
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
                          <Check className="w-3 h-3 text-green-400 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{r.question.content.question}</span>
                          {r.retried && (
                            <Badge variant="outline" className="text-xs border-yellow-600/40 text-yellow-400 ml-auto flex-shrink-0">
                              reintento
                            </Badge>
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
                    <Badge className="bg-green-700 text-xs">✓ Guardada ({savedId.slice(-6)})</Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {modelUsed.split('-').slice(0, 3).join('-')}
                  </Badge>
                </div>
              </div>

              {/* Audio preview in single-question step */}
              {isListening && audioBlobUrl && (
                <div className="flex items-center gap-2 bg-muted/60 border border-purple-600/30 rounded-lg px-3 py-2">
                  <Headphones className="w-4 h-4 text-purple-400 flex-shrink-0" />
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
                <Button
                  onClick={() => { setGeneratedQuestion(null); setStep('config'); }}
                  variant="outline"
                  size="sm"
                  className="gap-2 border-line bg-box text-foreground hover:bg-muted"
                  disabled={isGenerating || isSaving}
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerar
                </Button>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={handleClose}
                    variant="outline"
                    size="sm"
                    className="gap-2 text-foreground border-line bg-box hover:bg-muted"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </Button>
                  {!savedId && (
                    <Button
                      onClick={handleSaveSingle}
                      size="sm"
                      disabled={isSaving}
                      className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Guardar en BD
                    </Button>
                  )}
                  <Button
                    onClick={handleAcceptSingle}
                    size="sm"
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="w-4 h-4" />
                    Aplicar al Formulario
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Bulk results step ── */}
          {step === 'bulk-results' && (
            <div className="space-y-4">
              {bulkPartial && (
                <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-600/40 rounded-lg px-4 py-3 text-sm">
                  <span className="text-amber-400 text-lg leading-none">⚠</span>
                  <div className="text-amber-200">
                    <p className="font-medium">Límite diario de GROQ alcanzado</p>
                    <p className="text-amber-300/80 text-xs mt-0.5">
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
                <Button
                  onClick={() => { setBulkResults([]); setStep('config'); }}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-line bg-box text-foreground hover:bg-muted text-xs"
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerar lote
                </Button>
              </div>

              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {bulkResults.map((result) => (
                  <div
                    key={result.index}
                    className={`border rounded-lg transition-colors ${
                      result.accepted
                        ? result.savedId
                          ? 'border-blue-600/40 bg-blue-900/10'
                          : 'border-green-600/40 bg-green-900/10'
                        : 'border-border/40 bg-muted/30 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => toggleAccept(result.index)}
                        disabled={!!result.savedId}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          result.accepted
                            ? 'border-green-500 bg-green-500/20 text-green-400'
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
                          <Badge variant="outline" className="text-xs border-yellow-600/40 text-yellow-400">
                            variado
                          </Badge>
                        )}
                        {result.savedId && (
                          <Badge className="text-xs bg-blue-700">
                            ✓ {result.savedId.slice(-5)}
                          </Badge>
                        )}
                      </div>

                      <button
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
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs border-purple-600/50 text-purple-300 hover:bg-purple-900/30"
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
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setBulkResults((prev) => prev.map((r) => ({ ...r, accepted: !r.savedId ? true : r.accepted })))
                    }
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  >
                    Seleccionar todas
                  </button>
                  <span className="text-muted-foreground">·</span>
                  <button
                    onClick={() =>
                      setBulkResults((prev) => prev.map((r) => ({ ...r, accepted: !!r.savedId })))
                    }
                    className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  >
                    Deseleccionar
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleClose}
                    variant="outline"
                    size="sm"
                    className="gap-2 text-foreground border-line bg-box hover:bg-muted"
                  >
                    <X className="w-4 h-4" />
                    Cerrar
                  </Button>
                  <Button
                    onClick={handleBulkSave}
                    size="sm"
                    disabled={isBulkSaving || unsavedAccepted === 0}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 text-white min-w-[180px]"
                  >
                    {isBulkSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Guardar {unsavedAccepted > 0 ? `${unsavedAccepted} seleccionadas` : 'seleccionadas'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Complete step ── */}
          {step === 'complete' && (
            <div className="text-center py-8 space-y-3">
              <div className="w-14 h-14 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-green-400" />
              </div>
              <h3 className="text-base font-medium text-foreground">¡Pregunta Aplicada!</h3>
              <p className="text-muted-foreground/70 text-sm">La pregunta generada se ha cargado en tu formulario</p>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIQuestionGenerator;
