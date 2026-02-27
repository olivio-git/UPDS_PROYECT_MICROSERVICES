import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/card';
import { Progress } from '@/components/atoms/progress';
import { ContentGradientSection } from '@/components/background';
import { MainLayout } from '@/components/layout';
import {
  examResultService,
  type StudentExamResult,
} from '@/services/examResultService';
import { api } from '@/services/api.service';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Download,
  FileText,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

interface QuestionResult {
  questionId: string;
  questionType: string;
  competency: string;
  response: any;
  isCorrect?: boolean;
  score: number;
  maxScore: number;
  feedback?: string;
  evaluationMethod: 'automatic' | 'ai_grading' | 'manual';
  evaluatedAt?: string;
  aiAnalysis?: {
    criteria: Record<string, number>;
    feedback: string;
    suggestions: string[];
  };
}

interface LevelScore {
  level: string;
  totalScore: number;
  maxScore: number;
  percentage: number;
  questionCount: number;
}

interface DetailedExamResult {
  _id: string;
  examName: string;
  examLevel: string;
  percentage: number;
  evaluatedAt: string;
  examDuration: number;
  questionResults: QuestionResult[];
  competencyScores: Array<{
    competency: string;
    totalScore: number;
    maxScore: number;
    percentage: number;
    questionCount: number;
  }>;
  status: string;
  recommendedLevel?: string;
  placementMode?: 'static' | 'adaptive';
  levelScores?: LevelScore[];
}

const ExamReview = () => {
  const navigate = useNavigate();
  const { resultId } = useParams();
  const [examResult, setExamResult] = useState<DetailedExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (resultId) {
      loadExamDetails();
    }
  }, [resultId]);

  const handleDownloadPDF = async () => {
    if (!examResult || !resultId) return;
    try {
      toast.loading('Generando PDF...', { id: 'pdf-exam-review' });
      await examResultService.downloadResultPDF(resultId, {
        includeQuestions: true, includeAI: true, language: 'spanish', examName: examResult.examName,
      });
      toast.success('PDF descargado exitosamente', { id: 'pdf-exam-review' });
    } catch {
      toast.error('Error al generar el PDF', { id: 'pdf-exam-review' });
    }
  };

  const loadExamDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Llamada directa para obtener los detalles completos con questionResults
      const rawResponse = await api.get(`/api/v1/exam-results/${resultId}`);

      if (rawResponse.data.success) {
        setExamResult(rawResponse.data.data);
      } else {
        throw new Error('Failed to fetch exam details');
      }
    } catch (err: any) {
      console.error('Error loading exam details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getCompetencyName = (key: string) => {
    const names = {
      listening: 'Comprensión Auditiva',
      reading: 'Comprensión Lectora',
      writing: 'Expresión Escrita',
      speaking: 'Expresión Oral',
    };
    return names[key as keyof typeof names] || key;
  };

  const getQuestionTypeName = (type: string) => {
    const types: Record<string, string> = {
      multiple_choice: 'Selección Múltiple',
      single_choice: 'Selección Única',
      true_false: 'Verdadero/Falso',
      fill_blank: 'Completar',
      fill_blanks: 'Completar Espacios',
      essay: 'Ensayo',
      open_text: 'Texto Abierto',
      speaking: 'Expresión Oral',
      audio_response: 'Respuesta de Audio',
      listening: 'Comprensión Auditiva',
      matching: 'Emparejar',
      ordering: 'Ordenar',
      drag_drop: 'Arrastrar y Soltar',
    };
    return types[type] || type;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderQuestionResponse = (question: QuestionResult) => {
    switch (question.questionType) {
      case 'multiple_choice':
      case 'single_choice':
        if (question.response?.selectedOptions) {
          return (
            <div className="space-y-2">
              <p className="text-sm text-gray-400">Tu respuesta:</p>
              <div className="flex flex-wrap gap-2">
                {question.response.selectedOptions.map((optionId: string, index: number) => (
                  <Badge
                    key={index}
                    className={`${
                      question.isCorrect
                        ? 'bg-green-500/20 text-green-300 border-green-500/30'
                        : 'bg-red-500/20 text-red-300 border-red-500/30'
                    }`}
                  >
                    Opción {index + 1}
                  </Badge>
                ))}
              </div>
            </div>
          );
        }
        break;

      case 'true_false':
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Tu respuesta:</p>
            <Badge
              className={`${
                question.isCorrect
                  ? 'bg-green-500/20 text-green-300 border-green-500/30'
                  : 'bg-red-500/20 text-red-300 border-red-500/30'
              }`}
            >
              {question.response?.answer ? 'Verdadero' : 'Falso'}
            </Badge>
          </div>
        );

      case 'fill_blank':
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Tu respuesta:</p>
            <div className="bg-gray-800 p-3 rounded-lg">
              <p className="text-white">"{question.response?.text || 'Sin respuesta'}"</p>
            </div>
          </div>
        );

      case 'audio_response':
      case 'speaking': {
        // Rewrite internal Docker MinIO URLs to public URL accessible by browser
        const rawAudioUrl: string = question.response?.audioUrl || '';
        const audioUrl = rawAudioUrl.replace(/^https?:\/\/minio(:\d+)?/, 'http://localhost:9000');
        return (
          <div className="space-y-3">
            <p className="text-sm text-gray-400">Tu respuesta:</p>
            {audioUrl ? (
              <div className="space-y-2">
                <audio
                  controls
                  className="w-full rounded-lg"
                  src={audioUrl}
                >
                  Tu navegador no soporta reproducción de audio.
                </audio>
                {question.response.transcription && (
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Transcripción:</p>
                    <p className="text-gray-300 text-sm italic">"{question.response.transcription}"</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-800 p-4 rounded-lg">
                <p className="text-white whitespace-pre-wrap">
                  {question.response?.text || question.response?.transcription || 'Sin respuesta'}
                </p>
              </div>
            )}
          </div>
        );
      }

      case 'essay':
      case 'open_text':
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Tu respuesta:</p>
            <div className="bg-gray-800 p-4 rounded-lg">
              <p className="text-white whitespace-pre-wrap">
                {question.response?.text || question.response?.answer || 'Sin respuesta'}
              </p>
            </div>
          </div>
        );

      default:
        return (
          <div className="space-y-2">
            <p className="text-sm text-gray-400">Respuesta registrada</p>
            <div className="bg-gray-800 p-3 rounded-lg">
              <p className="text-white">
                {JSON.stringify(question.response) || 'Sin respuesta'}
              </p>
            </div>
          </div>
        );
    }

    return null;
  };

  if (loading) {
    return (
      <MainLayout gradientVariant="primary">
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-96">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
            <p className="text-gray-300">Cargando revisión del examen...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout gradientVariant="primary">
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-96">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-4" />
            <p className="text-red-300 mb-4">Error: {error}</p>
            <Button onClick={() => navigate(`/student/results/${resultId}`)} variant="outline">
              Volver a Resultados
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!examResult) {
    return (
      <MainLayout gradientVariant="primary">
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-96">
          <div className="text-center">
            <FileText className="h-8 w-8 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-300 mb-4">Examen no encontrado</p>
            <Button onClick={() => navigate('/student/results')} variant="outline">
              Volver a Resultados
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout gradientVariant="primary">
      <div className="max-w-6xl mx-auto space-y-8">
        <ContentGradientSection
          variant="secondary"
          position="top-right"
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">
                Revisión del Examen
              </h1>
              <p className="text-gray-300 mt-2">
                {examResult.examName} - {formatDate(examResult.evaluatedAt)}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDownloadPDF} className="bg-blue-700 hover:bg-blue-600 text-white border-line">
                <Download className="h-4 w-4 mr-2" />
                Descargar PDF
              </Button>
              <Button variant="outline" onClick={() => navigate(`/student/results/${resultId}`)}
                className="text-gray-300 hover:bg-gray-800 bg-box border-line">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Volver a Resultado
              </Button>
            </div>
          </div>
        </ContentGradientSection>

        {/* Placement: Nivel Recomendado Banner */}
        {examResult.recommendedLevel && (
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-6 text-center space-y-2">
            <p className="text-gray-400 text-sm uppercase tracking-widest">Resultado del Examen de Nivelación</p>
            <p className="text-4xl font-bold text-white">
              NIVEL RECOMENDADO →{' '}
              <span className="text-blue-400">{examResult.recommendedLevel}</span>
            </p>
            {examResult.placementMode && (
              <p className="text-gray-400 text-sm">
                Modo: {examResult.placementMode === 'adaptive' ? 'Adaptativo (CAT)' : 'Estático'}
              </p>
            )}
          </div>
        )}

        {/* Placement: Desempeño por Nivel MCER */}
        {examResult.levelScores && examResult.levelScores.length > 0 && (
          <Card className="bg-[#0B1422] backdrop-blur-sm border border-line">
            <CardHeader>
              <CardTitle className="text-white">Desempeño por Nivel MCER</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(level => {
                const ls = examResult.levelScores!.find(s => s.level === level);
                const isRecommended = level === examResult.recommendedLevel;
                return (
                  <div key={level} className={`space-y-1 p-3 rounded-lg ${isRecommended ? 'bg-blue-500/10 border border-blue-500/30' : 'bg-gray-800/20'}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-medium ${isRecommended ? 'text-blue-400' : 'text-gray-300'}`}>
                        {level} {isRecommended && '★ Recomendado'}
                      </span>
                      {ls ? (
                        <span className="text-gray-400">{ls.totalScore}/{ls.maxScore} — {ls.percentage}%</span>
                      ) : (
                        <span className="text-gray-600">Sin datos</span>
                      )}
                    </div>
                    <Progress
                      value={ls ? ls.percentage : 0}
                      className="h-2"
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Resumen del examen */}
        <Card className="bg-[#0B1422] backdrop-blur-sm border border-line">
          <CardHeader>
            <CardTitle className="text-white">Resumen General</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400 mb-2">
                  {examResult.percentage}%
                </div>
                <p className="text-gray-300 text-sm">Puntuación Total</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400 mb-2">
                  {examResult.questionResults.length}
                </div>
                <p className="text-gray-300 text-sm">Total Preguntas</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400 mb-2">
                  {examResult.questionResults.filter(q => q.isCorrect).length}
                </div>
                <p className="text-gray-300 text-sm">Correctas</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400 mb-2">
                  {Math.round(examResult.examDuration / 60)}
                </div>
                <p className="text-gray-300 text-sm">Minutos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de preguntas */}
        <div className="space-y-6">
          {examResult.questionResults.map((question, index) => (
            <Card key={question.questionId} className="bg-[#0B1422] backdrop-blur-sm border border-line">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-white text-lg flex items-center gap-3">
                      <span className="bg-gray-700 text-white px-3 py-1 rounded-full text-sm">
                        {index + 1}
                      </span>
                      {getQuestionTypeName(question.questionType)}
                      {question.isCorrect !== undefined && (
                        question.isCorrect ? (
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400" />
                        )
                      )}
                    </CardTitle>
                    <CardDescription className="text-gray-400 mt-2">
                      {getCompetencyName(question.competency)} •
                      Puntuación: {question.score}/{question.maxScore} puntos •
                      Evaluación: {question.evaluationMethod === 'automatic' ? 'Automática' :
                                  question.evaluationMethod === 'ai_grading' ? 'IA' : 'Manual'}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <Badge className={
                      question.isCorrect === true
                        ? 'bg-green-500/20 text-green-300 border-green-500/30'
                        : question.isCorrect === false
                        ? 'bg-red-500/20 text-red-300 border-red-500/30'
                        : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                    }>
                      {question.score}/{question.maxScore}
                    </Badge>
                    <Progress
                      value={(question.score / question.maxScore) * 100}
                      className="w-20"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Respuesta del estudiante */}
                {renderQuestionResponse(question)}

                {/* Feedback */}
                {question.feedback && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Retroalimentación:</p>
                    <div className="bg-blue-900/20 border border-blue-700/30 p-3 rounded-lg">
                      <p className="text-blue-200">{question.feedback}</p>
                    </div>
                  </div>
                )}

                {/* AI Analysis */}
                {question.aiAnalysis && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Análisis de IA:</p>
                    <div className="bg-purple-900/20 border border-purple-700/30 p-3 rounded-lg space-y-2">
                      {question.aiAnalysis.feedback && (
                        <p className="text-purple-200">{question.aiAnalysis.feedback}</p>
                      )}
                      {question.aiAnalysis.suggestions && question.aiAnalysis.suggestions.length > 0 && (
                        <div>
                          <p className="text-sm text-purple-300 font-medium">Sugerencias:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm text-purple-200">
                            {question.aiAnalysis.suggestions.map((suggestion, idx) => (
                              <li key={idx}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Tiempo de evaluación */}
                {question.evaluatedAt && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    Evaluado el {formatDate(question.evaluatedAt)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Botón para volver */}
        <div className="flex justify-center pt-8">
          <Button
            onClick={() => navigate(`/student/results/${resultId}`)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a Resultado Completo
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};

export default ExamReview;