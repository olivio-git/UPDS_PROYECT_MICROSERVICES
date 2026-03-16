import { AudioPlayer } from '@/components/audio';
import QuestionRenderer from '@/modules/student/components/QuestionRenderer';
import { examService } from '@/services/examService';
import { ArrowLeft, BookOpen, Brain, CheckCircle, Clock, Edit, Eye, Hash, Image as ImageIcon, Lightbulb, Loader2, Mic, RefreshCw, Target, Users, Volume2, XCircle } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Question } from '../types';

interface QuestionDetailViewProps {
  question: Question;
  onBack: () => void;
  onEdit: () => void;
}

// Fisher-Yates shuffle (no mutation)
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const QuestionDetailView: React.FC<QuestionDetailViewProps> = ({
  question,
  onBack,
  onEdit
}) => {
  const [activeTab, setActiveTab] = useState<'teacher' | 'student'>('teacher');
  const [studentAnswer, setStudentAnswer] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [aiResult, setAiResult] = useState<{
    score: number;
    maxScore: number;
    feedback: string;
    criteria?: Record<string, number>;
    suggestions?: string[];
  } | null>(null);
  const [shuffleSeed, setShuffleSeed] = useState(0);

  const studentQuestion = useMemo(() => {
    const q = { ...question, content: { ...question.content } };
    if (q.content.options) q.content.options = shuffleArray(q.content.options);
    if (q.content.items) q.content.items = shuffleArray(q.content.items);
    const c = { ...q.content } as any;
    delete c.correctAnswer;
    q.content = c;
    return q;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, shuffleSeed]);

  const getQuestionTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      multiple_choice: 'Opción Múltiple',
      true_false: 'Verdadero/Falso',
      open_text: 'Texto Abierto',
      essay: 'Ensayo',
      audio_response: 'Respuesta de Audio',
      file_upload: 'Subida de Archivo',
      listening: 'Comprensión Auditiva',
      speaking: 'Expresión Oral',
      reading: 'Comprensión Lectora',
      writing: 'Expresión Escrita',
      matching: 'Emparejar',
      drag_drop: 'Arrastrar y Soltar',
      ordering: 'Ordenar',
      fill_blanks: 'Completar Espacios'
    };
    return labels[type] || type;
  };

  const ItemMediaPreview: React.FC<{ url?: string; explicitType?: 'audio' | 'image' | 'video' | null }> = ({ url, explicitType }) => {
    const [imgFailed, setImgFailed] = React.useState(false);

    if (!url) return null;

    const type = explicitType ?? detectMediaType(url);

    if (url.startsWith('blob:')) {
      return (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-2">
          ⚠️ Error: Archivo multimedia no guardado correctamente
        </div>
      );
    }

    if (type === 'audio') {
      return (
        <AudioPlayer
          src={url}
          variant="compact"
          title="Audio de la pregunta"
          showControls={{ time: true }}
          className="max-w-md"
        />
      );
    }

    if (type === 'image') {
      return (
        <img
          src={url}
          alt="media"
          className="w-24 h-16 object-cover rounded cursor-pointer"
          onClick={() => window.open(url, '_blank')}
          onError={() => setImgFailed(true)}
        />
      );
    }

    if (type === 'video') {
      return (
        <video controls className="w-full h-16 rounded">
          <source src={url} />
          Tu navegador no soporta video.
        </video>
      );
    }

    if (!imgFailed) {
      return (
        <img
          src={url}
          alt="media"
          className="w-24 h-16 object-cover rounded cursor-pointer"
          onClick={() => window.open(url, '_blank')}
          onError={() => setImgFailed(true)}
        />
      );
    }

    return (
      <audio controls className="w-full">
        <source src={url} />
        Tu navegador no soporta audio.
      </audio>
    );
  };

  const getDifficultyLabel = (difficulty: number) => {
    const labels = ['', 'Muy Fácil', 'Fácil', 'Medio', 'Difícil', 'Muy Difícil'];
    return labels[difficulty] || '';
  };

  const getDifficultyColor = (difficulty: number) => {
    if (difficulty <= 2) return 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/20 border-green-300 dark:border-green-800/30';
    if (difficulty <= 3) return 'text-yellow-700 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-800/30';
    if (difficulty <= 4) return 'text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/20 border-orange-300 dark:border-orange-800/30';
    return 'text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/20 border-red-300 dark:border-red-800/30';
  };

  const detectMediaType = (url?: string): 'audio' | 'image' | null => {
    if (!url) return null;
    const u = url.toLowerCase();
    if (u.startsWith('data:')) {
      if (u.includes('audio/')) return 'audio';
      if (u.includes('image/')) return 'image';
    }
    if (u.startsWith('blob:') || !u.includes('.')) {
      if (u.includes('audio')) return 'audio';
      if (u.includes('image') || u.includes('img')) return 'image';
    }
    if (u.match(/\.(mp3|wav|ogg|m4a|aac)$/)) return 'audio';
    if (u.match(/\.(jpe?g|png|gif|webp|svg)$/)) return 'image';
    return null;
  };

  const checkAnswer = (): { correct: boolean; explanation: string } => {
    const type = question.type;

    if (!studentAnswer) return { correct: false, explanation: 'No respondiste la pregunta.' };

    if (type === 'multiple_choice') {
      const selected = studentAnswer.selectedOptions?.[0];
      const selectedOption = question.content.options?.find(o => {
        const oId = (o as any)._id ?? o.id;
        return String(oId) === String(selected);
      });
      const isCorrect = selectedOption?.isCorrect === true;
      const correctOption = question.content.options?.find(o => o.isCorrect);
      return {
        correct: isCorrect,
        explanation: isCorrect
          ? `Correcto. La respuesta es: "${correctOption?.text}"`
          : `Incorrecto. La respuesta correcta era: "${correctOption?.text}"`,
      };
    }

    if (type === 'true_false') {
      const correctOption = question.content.options?.find(o => o.isCorrect);
      const correctOptionId = correctOption?.id ?? '';
      const correctOptionText = (correctOption?.text ?? '').toLowerCase();
      const correctIsTrue =
        correctOptionId === 'true' ||
        correctOptionText === 'true' ||
        correctOptionText === 'verdadero';
      const isCorrect = Boolean(studentAnswer.answer) === correctIsTrue;
      return {
        correct: isCorrect,
        explanation: isCorrect
          ? `Correcto. La respuesta es: "${correctOption?.text}"`
          : `Incorrecto. La respuesta correcta era: "${correctOption?.text}"`,
      };
    }

    if (type === 'fill_blanks') {
      const blanks = question.content.blanks || [];
      const userBlanks: string[] = studentAnswer.blanks || [];
      const wrong = blanks.filter((b: any, i: number) => {
        const correct = b.correctAnswers || [];
        const user = (userBlanks[i] || '').trim().toLowerCase();
        return !correct.some((c: string) => c.toLowerCase() === user);
      });
      const isCorrect = wrong.length === 0;
      return {
        correct: isCorrect,
        explanation: isCorrect
          ? 'Todos los espacios son correctos.'
          : `${wrong.length} espacio(s) incorrecto(s). Revisa la clave de respuestas.`,
      };
    }

    if (type === 'matching') {
      const items = question.content.items || [];
      const pairs = studentAnswer.pairs || {};
      const wrong = items.filter((item: any) => pairs[item.id] !== item.matchingPair);
      const isCorrect = wrong.length === 0;
      return {
        correct: isCorrect,
        explanation: isCorrect
          ? 'Todas las parejas son correctas.'
          : `${wrong.length} pareja(s) incorrecta(s). Revisa la clave.`,
      };
    }

    if (type === 'ordering') {
      const items = question.content.items || [];
      const sortedByCorrect = [...items].sort((a: any, b: any) => a.correctPosition - b.correctPosition);
      const userOrder: string[] = studentAnswer.order || [];
      const isCorrect = userOrder.every((id, i) => id === sortedByCorrect[i]?.id);
      return {
        correct: isCorrect,
        explanation: isCorrect
          ? 'El orden es correcto.'
          : 'El orden no es correcto. Revisa la secuencia.',
      };
    }

    if (type === 'drag_drop') {
      const items = question.content.items || [];
      const positions: Record<string, number> = studentAnswer.positions || {};
      const wrong = items.filter((item: any) => positions[item.id] !== item.correctPosition);
      const isCorrect = wrong.length === 0;
      return {
        correct: isCorrect,
        explanation: isCorrect
          ? 'Todas las posiciones son correctas.'
          : `${wrong.length} elemento(s) en posición incorrecta. La clave de respuestas está en la Vista Docente.`,
      };
    }

    if (type === 'open_text' || type === 'essay') {
      return {
        correct: true,
        explanation: 'Respuesta abierta. Será evaluada por el docente o IA.',
      };
    }

    return { correct: true, explanation: 'Respuesta registrada.' };
  };

  const isAiType = question.type === 'open_text' || question.type === 'essay';
  const isAudioType = question.type === 'audio_response';

  const handleVerify = async () => {
    const gradingUrl = (import.meta as any).env?.VITE_API_GATEWAY_URL || 'http://localhost:80';

    if (isAudioType) {
      const audioBlob: Blob | undefined = studentAnswer?.audioBlob;
      if (!(audioBlob instanceof Blob)) return;

      setIsEvaluating(true);
      setAiResult(null);
      try {
        toast.info('Subiendo audio al servidor...');
        const audioUrl = await examService.uploadResponseAudio('simulator', String(question._id), audioBlob);

        toast.info('Transcribiendo y evaluando con IA...');
        const res = await fetch(`${gradingUrl}/api/v1/grading/question`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionData: question,
            response: { audioUrl },
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || `Error ${res.status}`);
        setAiResult({
          score: data.data.score,
          maxScore: data.data.maxScore,
          feedback: data.data.feedback,
          criteria: data.data.criteria,
          suggestions: data.data.suggestions,
        });
        setShowResult(true);
      } catch (err: any) {
        toast.error(`Error evaluando audio: ${err.message}`);
      } finally {
        setIsEvaluating(false);
      }
    } else if (isAiType) {
      const answerText = studentAnswer?.text?.trim();
      if (!answerText) return;

      setIsEvaluating(true);
      setAiResult(null);
      try {
        const res = await fetch(`${gradingUrl}/api/v1/grading/question`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionData: question,
            response: { answer: answerText },
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || `Error ${res.status}`);
        setAiResult({
          score: data.data.score,
          maxScore: data.data.maxScore,
          feedback: data.data.feedback,
          criteria: data.data.criteria,
          suggestions: data.data.suggestions,
        });
        setShowResult(true);
      } catch (err: any) {
        toast.error(`Error evaluando con IA: ${err.message}`);
      } finally {
        setIsEvaluating(false);
      }
    } else {
      setShowResult(true);
    }
  };

  const handleReShuffle = () => {
    setShuffleSeed(s => s + 1);
    setStudentAnswer(null);
    setShowResult(false);
    setAiResult(null);
  };

  const result = showResult && !isAiType && !isAudioType ? checkAnswer() : null;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver
          </button>
          <h2 className="text-base font-semibold text-foreground">Detalles de la Pregunta</h2>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          <Edit className="w-3.5 h-3.5" />
          Editar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted/60 border border-border rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('teacher')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'teacher'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Vista Docente
        </button>
        <button
          onClick={() => { setActiveTab('student'); setShowResult(false); setStudentAnswer(null); setAiResult(null); }}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'student'
              ? 'bg-purple-600 text-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Eye className="w-4 h-4" />
          Vista Estudiante
        </button>
      </div>

      {/* ─── TEACHER VIEW ─── */}
      {activeTab === 'teacher' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna 1: Información básica */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/30 border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                  <span className="text-xs text-muted-foreground">Tipo</span>
                </div>
                <div className="text-sm text-foreground font-medium">{getQuestionTypeLabel(question.type)}</div>
              </div>

              <div className="bg-muted/30 border border-border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-xs text-muted-foreground">Competencia</span>
                </div>
                <div className="text-sm text-foreground font-medium capitalize">{question.competency}</div>
              </div>

              <div className="bg-muted/30 border border-border rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Nivel</div>
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800/30 rounded">
                  {question.level}
                </span>
              </div>

              <div className="bg-muted/30 border border-border rounded-lg p-3">
                <div className="text-xs text-muted-foreground mb-1">Dificultad</div>
                <span className={`px-2 py-1 text-xs font-medium border rounded ${getDifficultyColor(question.difficulty)}`}>
                  {getDifficultyLabel(question.difficulty)}
                </span>
              </div>
            </div>

            {(question.metadata?.topic || question.metadata?.estimatedTime || question.points) && (
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Información Adicional</h3>
                <div className="space-y-2">
                  {question.metadata?.topic && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Tema:</span>
                      <span className="text-sm text-foreground">{question.metadata.topic}</span>
                    </div>
                  )}
                  {question.metadata?.subtopic && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Subtema:</span>
                      <span className="text-sm text-foreground">{question.metadata.subtopic}</span>
                    </div>
                  )}
                  {question.metadata?.estimatedTime && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Tiempo:</span>
                      <div className="flex items-center gap-1 text-sm text-foreground">
                        <Clock className="w-3 h-3" />
                        {question.metadata.estimatedTime} min
                      </div>
                    </div>
                  )}
                  {question.points && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Puntos:</span>
                      <span className="text-sm text-foreground">{question.points}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {question.metadata?.tags && question.metadata.tags.length > 0 && (
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Etiquetas</h3>
                <div className="flex flex-wrap gap-2">
                  {question.metadata.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs flex items-center gap-1"
                    >
                      <Hash className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Estado</h3>
              <span className={`px-3 py-1 text-xs font-medium border rounded-lg ${
                question.isActive
                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-800/30'
                  : 'bg-muted text-muted-foreground border-border'
              }`}>
                {question.isActive ? 'Activa' : 'Inactiva'}
              </span>
            </div>
          </div>

          {/* Columna 2: Contenido */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-muted/30 border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Pregunta</h3>
              <div className="text-foreground/80 text-sm leading-relaxed">
                {question.content.question}
              </div>
            </div>

            {question.content.instructions && (
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Instrucciones</h3>
                <div className="text-foreground/80 text-sm leading-relaxed">
                  {question.content.instructions}
                </div>
              </div>
            )}

            {question.content.mediaUrl && question.content.mediaType === 'audio' && (
              <div className="bg-muted/30 border border-green-300 dark:border-green-700/30 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  {question.competency === 'listening' ? 'Audio de Comprensión Auditiva' : 'Audio Principal'}
                </h3>
                {question.content.mediaUrl.startsWith('blob:') ? (
                  <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded p-3">
                    ⚠️ Archivo temporal — guarda la pregunta con el audio para verlo aquí
                  </div>
                ) : (
                  <AudioPlayer
                    src={question.content.mediaUrl}
                    variant="compact"
                    title="Audio de la pregunta"
                    showControls={{ volume: true, speed: true, seek: true, time: true }}
                    className="max-w-md"
                  />
                )}
              </div>
            )}

            {question.content.context && (
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  {question.competency === 'listening' ? 'Transcripción del audio' : 'Contexto'}
                </h3>
                <div className="text-foreground/80 text-sm leading-relaxed">
                  {question.content.context}
                </div>
              </div>
            )}

            {question.content.mediaUrl && question.content.mediaType !== 'audio' && (
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  {question.content.mediaType === 'image' && <ImageIcon className="w-4 h-4" />}
                  Multimedia Principal
                </h3>

                {question.content.mediaType === 'image' && (
                  <div className="space-y-3">
                    {question.content.mediaUrl.startsWith('blob:') ? (
                      <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-3">
                        ⚠️ Error: Imagen no guardada correctamente en el servidor
                      </div>
                    ) : (
                      <img
                        src={question.content.mediaUrl}
                        alt="Imagen de la pregunta"
                        className="max-w-full h-auto rounded-lg border border-border cursor-pointer"
                        onClick={() => window.open(question.content.mediaUrl, '_blank')}
                      />
                    )}
                    <div className="text-xs text-muted-foreground">
                      {question.content.mediaUrl.split('/').pop()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Opciones (con clave de respuesta) */}
            {question.content.options && question.content.options.length > 0 && (
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Opciones de Respuesta{' '}
                  <span className="text-xs text-green-600 dark:text-green-400 font-normal">(clave visible)</span>
                </h3>
                <div className="space-y-2">
                  {question.content.options.map((option, index) => (
                    <div
                      key={option.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        option.isCorrect
                          ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-800/30 text-green-800 dark:text-green-300'
                          : 'bg-muted/50 border-border text-foreground/80'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                        option.isCorrect
                          ? 'border-green-500 dark:border-green-400 bg-green-100 dark:bg-green-400/20 text-green-700 dark:text-green-400'
                          : 'border-muted-foreground text-muted-foreground'
                      }`}>
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className="flex-1 text-sm">{option.text}</span>
                      {option.isCorrect && (
                        <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">
                          Correcta
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items: matching, ordering, drag_drop */}
            {question.content.items && question.content.items.length > 0 && (
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  {question.type === 'matching' && 'Pares a Emparejar'}
                  {question.type === 'ordering' && 'Elementos en Orden Correcto'}
                  {question.type === 'drag_drop' && 'Elementos con Posición Correcta'}
                  {!['matching', 'ordering', 'drag_drop'].includes(question.type) && 'Elementos'}
                  <span className="text-xs text-green-600 dark:text-green-400 font-normal">(clave visible)</span>
                </h3>

                {question.type === 'matching' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="text-xs text-muted-foreground font-medium px-1">Concepto</div>
                      <div className="text-xs text-muted-foreground font-medium px-1">Pareja correcta</div>
                    </div>
                    {question.content.items.map((item, idx) => (
                      <div key={item.id ?? String(idx)} className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 rounded-lg">
                          {item.mediaUrl && (
                            <ItemMediaPreview url={item.mediaUrl} explicitType={detectMediaType(item.mediaUrl)} />
                          )}
                          <span className="text-sm text-blue-800 dark:text-blue-200 font-medium">{item.content}</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700/40 rounded-lg">
                          <span className="text-sm text-emerald-800 dark:text-emerald-200 font-medium">
                            {item.matchingPair || <span className="text-muted-foreground italic">Sin pareja</span>}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(question.type === 'ordering' || question.type === 'drag_drop') && (
                  <div className="space-y-2">
                    {[...question.content.items]
                      .sort((a: any, b: any) => (a.correctPosition ?? 0) - (b.correctPosition ?? 0))
                      .map((item: any, idx) => (
                        <div key={item.id ?? String(idx)} className="flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-lg">
                          <div className="w-7 h-7 rounded-full bg-blue-600/80 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {item.correctPosition ?? idx + 1}
                          </div>
                          {item.mediaUrl && (
                            <ItemMediaPreview url={item.mediaUrl} explicitType={detectMediaType(item.mediaUrl)} />
                          )}
                          <span className="text-sm text-foreground/80">{item.content}</span>
                        </div>
                      ))}
                  </div>
                )}

                {!['matching', 'ordering', 'drag_drop'].includes(question.type) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {question.content.items.map((item, idx) => (
                      <div key={item.id ?? String(idx)} className="flex items-start gap-3 p-3 bg-muted/50 border border-border rounded-lg">
                        <div className="flex-1">
                          <div className="text-sm text-foreground/80 font-medium">{item.content}</div>
                        </div>
                        {item.mediaUrl && (
                          <div className="w-20 h-12 flex-shrink-0">
                            <ItemMediaPreview url={item.mediaUrl} explicitType={detectMediaType(item.mediaUrl)} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* fill_blanks answer key */}
            {question.content.blanks && question.content.blanks.length > 0 && (
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  Clave de Espacios{' '}
                  <span className="text-xs text-green-600 dark:text-green-400 font-normal">(clave visible)</span>
                </h3>
                <div className="font-mono text-sm text-foreground/80 mb-3 bg-muted/50 p-3 rounded-lg">
                  {question.content.template}
                </div>
                <div className="space-y-2">
                  {question.content.blanks.map((blank: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 text-sm">
                      <span className="text-muted-foreground">Espacio {blank.position}:</span>
                      <div className="flex flex-wrap gap-1">
                        {blank.correctAnswers?.map((ans: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700/40 rounded text-xs">
                            {ans}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* essay/open_text sample answer */}
            {question.content.sampleAnswer && (
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Respuesta de Referencia</h3>
                <div className="text-foreground/80 text-sm leading-relaxed bg-muted/50 p-3 rounded-lg">
                  {question.content.sampleAnswer}
                </div>
                {question.content.keywords && question.content.keywords.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-2">Palabras clave esperadas:</div>
                    <div className="flex flex-wrap gap-1">
                      {question.content.keywords.map((kw: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-300 dark:border-yellow-700/40 rounded text-xs">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Estadísticas */}
            {question.statistics && (
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Estadísticas de Uso
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{question.statistics.timesUsed || 0}</div>
                    <div className="text-xs text-muted-foreground">Usos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">{question.statistics.averageScore || 0}%</div>
                    <div className="text-xs text-muted-foreground">Promedio</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{question.statistics.averageTime || 0}s</div>
                    <div className="text-xs text-muted-foreground">Tiempo</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── STUDENT SIMULATOR ─── */}
      {activeTab === 'student' && (
        <div className="max-w-3xl mx-auto space-y-4">
          {/* The actual question rendered as students see it */}
          <div className="bg-muted/30 border border-border rounded-xl p-4">
            <QuestionRenderer
              key={shuffleSeed}
              question={studentQuestion}
              answer={studentAnswer}
              onChange={(_qid, value) => {
                setStudentAnswer(value);
                setShowResult(false);
              }}
              showQuestionNumber={false}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handleVerify}
              disabled={
                isEvaluating ||
                !studentAnswer ||
                (isAudioType && !(studentAnswer?.audioBlob instanceof Blob))
              }
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                !isEvaluating && studentAnswer && !(isAudioType && !(studentAnswer?.audioBlob instanceof Blob))
                  ? isAudioType
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : isAiType
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              {isEvaluating
                ? <><Loader2 className="w-4 h-4 animate-spin" />{isAudioType ? 'Procesando audio...' : 'Evaluando con IA...'}</>
                : isAudioType
                  ? <><Mic className="w-4 h-4" />Transcribir y Evaluar</>
                  : isAiType
                    ? <><Brain className="w-4 h-4" />Evaluar con IA</>
                    : <><CheckCircle className="w-4 h-4" />Verificar Respuesta</>
              }
            </button>
            <button
              onClick={() => { setStudentAnswer(null); setShowResult(false); setAiResult(null); }}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground border border-border hover:border-foreground/50 transition-colors flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Limpiar
            </button>
            <button
              onClick={handleReShuffle}
              className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Mezclar opciones
            </button>
          </div>

          {/* Result feedback — auto-graded types */}
          {showResult && result && (
            <div className={`p-4 rounded-lg border flex items-start gap-3 ${
              result.correct
                ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700/50'
                : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700/50'
            }`}>
              {result.correct
                ? <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                : <XCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              }
              <div>
                <div className={`font-medium text-sm ${result.correct ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                  {result.correct ? 'Respuesta Correcta' : 'Respuesta Incorrecta'}
                </div>
                <div className="text-sm text-foreground/80 mt-1">{result.explanation}</div>
              </div>
            </div>
          )}

          {/* Result feedback — AI evaluation */}
          {showResult && aiResult && (
            <div className="space-y-3">
              <div className="p-4 rounded-lg border bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    <span className="font-medium text-sm text-purple-700 dark:text-purple-300">Evaluación IA</span>
                  </div>
                  <span className="text-lg font-bold text-foreground">
                    {aiResult.score} / {aiResult.maxScore}
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({Math.round((aiResult.score / aiResult.maxScore) * 100)}%)
                    </span>
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 mb-3">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      aiResult.score / aiResult.maxScore >= 0.7
                        ? 'bg-green-500'
                        : aiResult.score / aiResult.maxScore >= 0.4
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.round((aiResult.score / aiResult.maxScore) * 100)}%` }}
                  />
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">{aiResult.feedback}</p>
              </div>

              {aiResult.criteria && Object.keys(aiResult.criteria).length > 0 && (
                <div className="p-3 rounded-lg border bg-muted/50 border-border">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Criterios de evaluación</div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(aiResult.criteria).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-foreground/80 capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-foreground font-medium">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aiResult.suggestions && aiResult.suggestions.length > 0 && (
                <div className="p-3 rounded-lg border bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-700/40">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                    <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">Sugerencias</span>
                  </div>
                  <ul className="space-y-1">
                    {aiResult.suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-foreground/80 flex gap-2">
                        <span className="text-yellow-600 dark:text-yellow-500 flex-shrink-0">•</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QuestionDetailView;
