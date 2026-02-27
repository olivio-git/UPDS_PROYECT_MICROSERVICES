import { Button } from '@/components/atoms/button';
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
  const [shuffleSeed, setShuffleSeed] = useState(0); // increment to re-shuffle

  // Question with shuffled options/items for student view (re-computed on shuffleSeed change)
  const studentQuestion = useMemo(() => {
    const q = { ...question, content: { ...question.content } };
    if (q.content.options) q.content.options = shuffleArray(q.content.options);
    if (q.content.items) q.content.items = shuffleArray(q.content.items);
    // Remove correctAnswer so student doesn't see it
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

  // Small helper component to preview an item's media with fallback behavior
  const ItemMediaPreview: React.FC<{ url?: string; explicitType?: 'audio' | 'image' | 'video' | null }> = ({ url, explicitType }) => {
    const [imgFailed, setImgFailed] = React.useState(false);

    if (!url) return null;

    const type = explicitType ?? detectMediaType(url);

    if (url.startsWith('blob:')) {
      return (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700 rounded p-2">
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
    if (difficulty <= 2) return 'text-green-400 bg-green-900/20 border-green-800/30';
    if (difficulty <= 3) return 'text-yellow-400 bg-yellow-900/20 border-yellow-800/30';
    if (difficulty <= 4) return 'text-orange-400 bg-orange-900/20 border-orange-800/30';
    return 'text-red-400 bg-red-900/20 border-red-800/30';
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

  // Check if student answer is correct (simplified)
  const checkAnswer = (): { correct: boolean; explanation: string } => {
    const type = question.type;
    const correctAnswer = question.content.correctAnswer;

    if (!studentAnswer) return { correct: false, explanation: 'No respondiste la pregunta.' };

    if (type === 'multiple_choice') {
      // QuestionRenderer uses opt._id || opt.id as the key it stores in selectedOptions
      // Find the option that the student selected by matching either _id or id
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
      // QuestionRenderer sends { answer: true } or { answer: false } (boolean)
      // Determine which option is "true" by id or text — do NOT rely on MongoDB _id
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
        // Reutiliza el endpoint de upload con sessionId "simulator" (la persistencia en MongoDB
        // falla silenciosamente, pero el archivo queda en MinIO y se retorna la URL)
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
    <div className="bg-box border border-line rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={onBack}
            className="px-3 py-2 bg-dark-light border border-line rounded-lg text-gray-300 hover:bg-dark-light/80 flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Button>
          <div>
            <h2 className="text-xl font-semibold text-white">Detalles de la Pregunta</h2>
            <p className="text-sm text-gray-400">ID: {question._id}</p>
          </div>
        </div>
        <Button
          onClick={onEdit}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Edit className="w-4 h-4" />
          Editar
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-dark-light border border-line rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('teacher')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'teacher'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Vista Docente
        </button>
        <button
          onClick={() => { setActiveTab('student'); setShowResult(false); setStudentAnswer(null); setAiResult(null); }}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'student'
              ? 'bg-purple-600 text-white'
              : 'text-gray-400 hover:text-white'
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
              <div className="bg-dark-light border border-line rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-gray-400">Tipo</span>
                </div>
                <div className="text-sm text-white font-medium">{getQuestionTypeLabel(question.type)}</div>
              </div>

              <div className="bg-dark-light border border-line rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-gray-400">Competencia</span>
                </div>
                <div className="text-sm text-white font-medium capitalize">{question.competency}</div>
              </div>

              <div className="bg-dark-light border border-line rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Nivel</div>
                <span className="px-2 py-1 text-xs font-medium bg-blue-900/20 text-blue-400 border border-blue-800/30 rounded">
                  {question.level}
                </span>
              </div>

              <div className="bg-dark-light border border-line rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Dificultad</div>
                <span className={`px-2 py-1 text-xs font-medium border rounded ${getDifficultyColor(question.difficulty)}`}>
                  {getDifficultyLabel(question.difficulty)}
                </span>
              </div>
            </div>

            {(question.metadata?.topic || question.metadata?.estimatedTime || question.points) && (
              <div className="bg-dark-light border border-line rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Información Adicional</h3>
                <div className="space-y-2">
                  {question.metadata?.topic && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Tema:</span>
                      <span className="text-sm text-white">{question.metadata.topic}</span>
                    </div>
                  )}
                  {question.metadata?.subtopic && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Subtema:</span>
                      <span className="text-sm text-white">{question.metadata.subtopic}</span>
                    </div>
                  )}
                  {question.metadata?.estimatedTime && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Tiempo:</span>
                      <div className="flex items-center gap-1 text-sm text-white">
                        <Clock className="w-3 h-3" />
                        {question.metadata.estimatedTime} min
                      </div>
                    </div>
                  )}
                  {question.points && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Puntos:</span>
                      <span className="text-sm text-white">{question.points}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {question.metadata?.tags && question.metadata.tags.length > 0 && (
              <div className="bg-dark-light border border-line rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Etiquetas</h3>
                <div className="flex flex-wrap gap-2">
                  {question.metadata.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-gray-700 text-gray-300 rounded text-xs flex items-center gap-1"
                    >
                      <Hash className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-dark-light border border-line rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Estado</h3>
              <span className={`px-3 py-1 text-xs font-medium border rounded-lg ${
                question.isActive
                  ? 'bg-green-900/20 text-green-400 border-green-800/30'
                  : 'bg-gray-900/20 text-gray-400 border-gray-800/30'
              }`}>
                {question.isActive ? 'Activa' : 'Inactiva'}
              </span>
            </div>
          </div>

          {/* Columna 2: Contenido (clave de respuestas visible) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-dark-light border border-line rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Pregunta</h3>
              <div className="text-gray-200 text-sm leading-relaxed">
                {question.content.question}
              </div>
            </div>

            {question.content.instructions && (
              <div className="bg-dark-light border border-line rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Instrucciones</h3>
                <div className="text-gray-200 text-sm leading-relaxed">
                  {question.content.instructions}
                </div>
              </div>
            )}

            {question.content.mediaUrl && question.content.mediaType === 'audio' && (
              <div className="bg-dark-light border border-green-700/30 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-green-400" />
                  {question.competency === 'listening' ? 'Audio de Comprensión Auditiva' : 'Audio Principal'}
                </h3>
                {question.content.mediaUrl.startsWith('blob:') ? (
                  <div className="text-sm text-amber-400 bg-amber-900/20 border border-amber-700 rounded p-3">
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
              <div className="bg-dark-light border border-line rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3">
                  {question.competency === 'listening' ? 'Transcripción del audio' : 'Contexto'}
                </h3>
                <div className="text-gray-200 text-sm leading-relaxed">
                  {question.content.context}
                </div>
              </div>
            )}

            {question.content.mediaUrl && question.content.mediaType !== 'audio' && (
              <div className="bg-dark-light border border-line rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  {question.content.mediaType === 'image' && <ImageIcon className="w-4 h-4" />}
                  Multimedia Principal
                </h3>

                {question.content.mediaType === 'image' && (
                  <div className="space-y-3">
                    {question.content.mediaUrl.startsWith('blob:') ? (
                      <div className="text-sm text-red-400 bg-red-900/20 border border-red-700 rounded p-3">
                        ⚠️ Error: Imagen no guardada correctamente en el servidor
                      </div>
                    ) : (
                      <img
                        src={question.content.mediaUrl}
                        alt="Imagen de la pregunta"
                        className="max-w-full h-auto rounded-lg border border-gray-600 cursor-pointer"
                        onClick={() => window.open(question.content.mediaUrl, '_blank')}
                      />
                    )}
                    <div className="text-xs text-gray-400">
                      {question.content.mediaUrl.split('/').pop()}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Opciones (con clave de respuesta) */}
            {question.content.options && question.content.options.length > 0 && (
              <div className="bg-dark-light border border-line rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Opciones de Respuesta <span className="text-xs text-green-400 font-normal">(clave visible)</span></h3>
                <div className="space-y-2">
                  {question.content.options.map((option, index) => (
                    <div
                      key={option.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        option.isCorrect
                          ? 'bg-green-900/20 border-green-800/30 text-green-300'
                          : 'bg-gray-800/50 border-gray-600 text-gray-200'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                        option.isCorrect
                          ? 'border-green-400 bg-green-400/20 text-green-400'
                          : 'border-gray-500 text-gray-500'
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

            {/* Items: matching (two-column), ordering, drag_drop */}
            {question.content.items && question.content.items.length > 0 && (
              <div className="bg-dark-light border border-line rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  {question.type === 'matching' && 'Pares a Emparejar'}
                  {question.type === 'ordering' && 'Elementos en Orden Correcto'}
                  {question.type === 'drag_drop' && 'Elementos con Posición Correcta'}
                  {!['matching', 'ordering', 'drag_drop'].includes(question.type) && 'Elementos'}
                  <span className="text-xs text-green-400 font-normal">(clave visible)</span>
                </h3>

                {/* Matching: two-column card layout */}
                {question.type === 'matching' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="text-xs text-gray-400 font-medium px-1">Concepto</div>
                      <div className="text-xs text-gray-400 font-medium px-1">Pareja correcta</div>
                    </div>
                    {question.content.items.map((item, idx) => (
                      <div key={item.id ?? String(idx)} className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 p-3 bg-blue-900/20 border border-blue-700/40 rounded-lg">
                          {item.mediaUrl && (
                            <ItemMediaPreview url={item.mediaUrl} explicitType={detectMediaType(item.mediaUrl)} />
                          )}
                          <span className="text-sm text-blue-200 font-medium">{item.content}</span>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-emerald-900/20 border border-emerald-700/40 rounded-lg">
                          <span className="text-sm text-emerald-200 font-medium">{item.matchingPair || <span className="text-gray-500 italic">Sin pareja</span>}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Ordering / drag_drop: numbered list in correct order */}
                {(question.type === 'ordering' || question.type === 'drag_drop') && (
                  <div className="space-y-2">
                    {[...question.content.items]
                      .sort((a: any, b: any) => (a.correctPosition ?? 0) - (b.correctPosition ?? 0))
                      .map((item: any, idx) => (
                        <div key={item.id ?? String(idx)} className="flex items-center gap-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                          <div className="w-7 h-7 rounded-full bg-blue-600/80 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {item.correctPosition ?? idx + 1}
                          </div>
                          {item.mediaUrl && (
                            <ItemMediaPreview url={item.mediaUrl} explicitType={detectMediaType(item.mediaUrl)} />
                          )}
                          <span className="text-sm text-gray-200">{item.content}</span>
                        </div>
                      ))}
                  </div>
                )}

                {/* Other item types */}
                {!['matching', 'ordering', 'drag_drop'].includes(question.type) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {question.content.items.map((item, idx) => (
                      <div key={item.id ?? String(idx)} className="flex items-start gap-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg">
                        <div className="flex-1">
                          <div className="text-sm text-gray-200 font-medium">{item.content}</div>
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
              <div className="bg-dark-light border border-line rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Clave de Espacios <span className="text-xs text-green-400 font-normal">(clave visible)</span></h3>
                <div className="font-mono text-sm text-gray-200 mb-3 bg-gray-900/40 p-3 rounded-lg">
                  {question.content.template}
                </div>
                <div className="space-y-2">
                  {question.content.blanks.map((blank: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-400">Espacio {blank.position}:</span>
                      <div className="flex flex-wrap gap-1">
                        {blank.correctAnswers?.map((ans: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-green-900/30 text-green-300 border border-green-700/40 rounded text-xs">
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
              <div className="bg-dark-light border border-line rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Respuesta de Referencia</h3>
                <div className="text-gray-200 text-sm leading-relaxed bg-gray-900/40 p-3 rounded-lg">
                  {question.content.sampleAnswer}
                </div>
                {question.content.keywords && question.content.keywords.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-gray-400 mb-2">Palabras clave esperadas:</div>
                    <div className="flex flex-wrap gap-1">
                      {question.content.keywords.map((kw: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-yellow-900/30 text-yellow-300 border border-yellow-700/40 rounded text-xs">{kw}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Estadísticas */}
            {question.statistics && (
              <div className="bg-dark-light border border-line rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Estadísticas de Uso
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-400">{question.statistics.timesUsed || 0}</div>
                    <div className="text-xs text-gray-400">Usos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-400">{question.statistics.averageScore || 0}%</div>
                    <div className="text-xs text-gray-400">Promedio</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-yellow-400">{question.statistics.averageTime || 0}s</div>
                    <div className="text-xs text-gray-400">Tiempo</div>
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
          {/* Simulator banner */}
          <div className="flex items-center justify-between p-3 bg-purple-900/20 border border-purple-700/40 rounded-lg">
            <div className="flex items-center gap-2 text-purple-300 text-sm">
              <Eye className="w-4 h-4" />
              Simulador de Vista Estudiante — las opciones/elementos están mezclados aleatoriamente
            </div>
            <button
              onClick={handleReShuffle}
              className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-200 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Volver a mezclar
            </button>
          </div>

          {/* The actual question rendered as students see it */}
          <div className="bg-dark-light border border-line rounded-xl p-4">
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
          <div className="flex items-center gap-3">
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
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
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
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white border border-gray-600 hover:border-gray-400 transition-colors flex items-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Limpiar
            </button>
          </div>

          {/* Result feedback — auto-graded types */}
          {showResult && result && (
            <div className={`p-4 rounded-lg border flex items-start gap-3 ${
              result.correct
                ? 'bg-green-900/20 border-green-700/50'
                : 'bg-red-900/20 border-red-700/50'
            }`}>
              {result.correct
                ? <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                : <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              }
              <div>
                <div className={`font-medium text-sm ${result.correct ? 'text-green-300' : 'text-red-300'}`}>
                  {result.correct ? 'Respuesta Correcta' : 'Respuesta Incorrecta'}
                </div>
                <div className="text-sm text-gray-300 mt-1">{result.explanation}</div>
              </div>
            </div>
          )}

          {/* Result feedback — AI evaluation (open_text / essay) */}
          {showResult && aiResult && (
            <div className="space-y-3">
              {/* Score bar */}
              <div className="p-4 rounded-lg border bg-purple-900/20 border-purple-700/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Brain className="w-5 h-5 text-purple-400" />
                    <span className="font-medium text-sm text-purple-300">Evaluación IA</span>
                  </div>
                  <span className="text-lg font-bold text-white">
                    {aiResult.score} / {aiResult.maxScore}
                    <span className="text-sm font-normal text-gray-400 ml-1">
                      ({Math.round((aiResult.score / aiResult.maxScore) * 100)}%)
                    </span>
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-gray-700 rounded-full h-2 mb-3">
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
                <p className="text-sm text-gray-200 leading-relaxed">{aiResult.feedback}</p>
              </div>

              {/* Criteria breakdown */}
              {aiResult.criteria && Object.keys(aiResult.criteria).length > 0 && (
                <div className="p-3 rounded-lg border bg-gray-800/50 border-gray-700">
                  <div className="text-xs font-medium text-gray-400 mb-2">Criterios de evaluación</div>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(aiResult.criteria).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-gray-300 capitalize">{key.replace(/_/g, ' ')}</span>
                        <span className="text-white font-medium">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {aiResult.suggestions && aiResult.suggestions.length > 0 && (
                <div className="p-3 rounded-lg border bg-yellow-900/10 border-yellow-700/40">
                  <div className="flex items-center gap-2 mb-2">
                    <Lightbulb className="w-4 h-4 text-yellow-400" />
                    <span className="text-xs font-medium text-yellow-300">Sugerencias</span>
                  </div>
                  <ul className="space-y-1">
                    {aiResult.suggestions.map((s, i) => (
                      <li key={i} className="text-xs text-gray-300 flex gap-2">
                        <span className="text-yellow-500 flex-shrink-0">•</span>
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
