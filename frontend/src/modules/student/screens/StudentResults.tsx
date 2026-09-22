import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { Calendar } from '@/components/atoms/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/atoms/card';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/atoms/popover';
import { Progress } from '@/components/atoms/progress';
import GradientWrapper from '@/components/background/GrandWrapperSection';
import { MainLayout } from '@/components/layout';
import CustomizableTable from '@/components/common/CustomizableTable';
import { api } from '@/services/api.service';
import {
  examResultService,
  type StudentExamResult,
  type StudentResultsListResponse,
} from '@/services/examResultService';
import {
  createColumnHelper,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CalendarIcon,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileText,
  Loader2,
  Target,
  TrendingDown,
  TrendingUp,
  X,
  XCircle
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

const columnHelper = createColumnHelper<StudentExamResult>();

const StudentResults = () => {
  const navigate = useNavigate();
  const { resultId } = useParams();
  const [selectedLevel, setSelectedLevel] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  // States for list view
  const [resultsData, setResultsData] =
    useState<StudentResultsListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States for detail view
  const [currentResult, setCurrentResult] = useState<StudentExamResult | null>(
    null
  );
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // States for detailed exam data (with questions)
  const [examDetailData, setExamDetailData] = useState<any>(null);

  // Load results list on mount or when filters change
  useEffect(() => {
    if (!resultId) {
      setPagination(p => ({ ...p, pageIndex: 0 }));
      loadStudentResults();
    }
  }, [selectedLevel, resultId]);

  // Load specific result if resultId is provided
  useEffect(() => {
    if (resultId) {
      loadResultDetail(resultId);
    }
  }, [resultId]);

  const loadStudentResults = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters = {
        level: selectedLevel !== 'all' ? selectedLevel : undefined,
        limit: 200,
      };

      const data = await examResultService.getStudentResults(filters);
      setResultsData(data);
    } catch (err: any) {
      console.error('Error loading student results:', err);
      setError(err.message);
      setResultsData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadResultDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      setDetailError(null);

      // Cargar resumen del resultado para el UI
      const result = await examResultService.getStudentResultDetail(id);
      setCurrentResult(result);
      // Cargar datos detallados del examen (con preguntas)
      const detailResponse = await api.get(`/api/v1/exam-results/${id}/detailed`) as any;
      console.log(detailResponse,'detailResponse in loadResultDetail');
      if (detailResponse.success) {
        setExamDetailData(detailResponse.data);
      }
    } catch (err: any) {
      console.error('Error loading result detail:', err);
      setDetailError(err.message);
      setCurrentResult(null);
      setExamDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };


  const getScoreBadgeColor = (score: number) => {
    if (score >= 80)
      return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30';
    if (score >= 60)
      return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30';
    return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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
    const types = {
      multiple_choice: 'Selección Múltiple',
      single_choice: 'Selección Única',
      true_false: 'Verdadero/Falso',
      fill_blank: 'Completar',
      fill_blanks: 'Completar Espacios',
      essay: 'Ensayo',
      open_text: 'Texto Abierto',
      speaking: 'Expresión Oral',
      listening: 'Comprensión Auditiva',
      audio_response: 'Respuesta de Audio',
      matching: 'Emparejamiento',
      ordering: 'Ordenamiento',
      drag_drop: 'Arrastrar y Soltar',
      file_upload: 'Subida de Archivo',
    };
    return types[type as keyof typeof types] || type;
  };

  const renderQuestionResponse = (question: any) => {
    const questionData = question.questionData;

    // Mostrar el texto de la pregunta
    const questionContent = (
      <div className="space-y-3">
        {questionData && (
          <div className="bg-card/60 p-3 rounded-lg border border-border">
            <h4 className="font-medium text-foreground mb-2">Pregunta:</h4>
            <p className="text-foreground/80 text-sm">{questionData.questionText}</p>
            {questionData.instructions && (
              <p className="text-muted-foreground text-xs mt-2 italic">{questionData.instructions}</p>
            )}
            {questionData.context && (
              <div className="mt-2 p-2 bg-muted/50 rounded">
                <p className="text-foreground/80 text-xs">{questionData.context}</p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Tu respuesta:</p>
          {renderAnswerContent()}
        </div>
      </div>
    );

    function renderAnswerContent() {
      switch (question.questionType) {
        case 'multiple_choice':
          if (question.response?.selectedOptions && questionData?.options) {
            return (
              <div className="space-y-2">
                {questionData.options.map((option: any) => {
                  const isSelected = question.response.selectedOptions.includes(option.id);
                  const isCorrect = option.isCorrect;
                  return (
                    <div
                      key={option.id}
                      className={`p-2 rounded text-sm border ${
                        isSelected && isCorrect
                          ? 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300'
                          : isSelected && !isCorrect
                          ? 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300'
                          : isCorrect
                          ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                          : 'bg-muted/30 border-border text-muted-foreground'
                      }`}
                    >
                      <span className="font-medium mr-2">
                        {isSelected ? '✓' : isCorrect ? '→' : '○'}
                      </span>
                      {option.text}
                      {isCorrect && !isSelected && (
                        <span className="ml-2 text-xs">(Respuesta correcta)</span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          }
          break;

        case 'true_false':
          const userAnswer = question.response?.answer;
          const correctAnswer = questionData?.correctAnswer;
          return (
            <div className="space-y-2">
              <Badge
                className={`text-xs ${
                  question.isCorrect
                    ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30'
                    : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30'
                }`}
              >
                {userAnswer ? 'Verdadero' : 'Falso'}
              </Badge>
              {!question.isCorrect && (
                <p className="text-xs text-blue-600 dark:text-blue-300">
                  Respuesta correcta: {correctAnswer ? 'Verdadero' : 'Falso'}
                </p>
              )}
            </div>
          );

        case 'fill_blank':
        case 'open_text':
          return (
            <div className="space-y-2">
              <div className="bg-muted p-2 rounded text-sm">
                <p className="text-foreground">"{question.response?.text || 'Sin respuesta'}"</p>
              </div>
              {questionData?.correctAnswer && (
                <p className="text-xs text-blue-600 dark:text-blue-300">
                  Respuesta esperada: {questionData.correctAnswer}
                </p>
              )}
            </div>
          );

        case 'audio_response':
        case 'speaking': {
          const rawUrl: string = question.response?.audioUrl || '';
          const audioUrl = rawUrl.replace(/^https?:\/\/minio(:\d+)?/, 'http://localhost:9000');
          return (
            <div className="space-y-2">
              {audioUrl ? (
                <div className="space-y-1">
                  <audio controls className="w-full rounded" src={audioUrl}>
                    Tu navegador no soporta audio.
                  </audio>
                  {question.response?.transcription && (
                    <p className="text-xs text-muted-foreground italic">"{question.response.transcription}"</p>
                  )}
                </div>
              ) : (
                <div className="bg-muted p-3 rounded text-sm">
                  <p className="text-muted-foreground italic">Sin respuesta de audio</p>
                </div>
              )}
            </div>
          );
        }

        case 'essay':
          return (
            <div className="space-y-2">
              <div className="bg-muted p-3 rounded text-sm max-h-32 overflow-y-auto">
                <p className="text-foreground whitespace-pre-wrap">
                  {question.response?.text || question.response?.answer || 'Sin respuesta'}
                </p>
              </div>
              {questionData?.sampleAnswer && (
                <details className="text-xs">
                  <summary className="text-blue-600 dark:text-blue-300 cursor-pointer">Ver respuesta de ejemplo</summary>
                  <p className="text-muted-foreground mt-1 p-2 bg-muted/50 rounded">
                    {questionData.sampleAnswer}
                  </p>
                </details>
              )}
            </div>
          );

        case 'fill_blanks': {
          const userBlanks: string[] = question.response?.blanks || [];
          const template: string = questionData?.template || '';
          const blanksDefs: Array<{ correctAnswers?: string[] }> = questionData?.blanks || [];
          const parts = template ? template.split('___') : [];

          if (parts.length > 1) {
            return (
              <div className="space-y-2">
                <div className="bg-muted p-3 rounded text-sm leading-relaxed">
                  {parts.map((part, i) => (
                    <span key={i}>
                      {part}
                      {i < parts.length - 1 && (
                        <span className={`inline-block mx-1 px-2 py-0.5 rounded font-medium border ${
                          blanksDefs[i]?.correctAnswers?.some(c =>
                            (userBlanks[i] || '').trim().toLowerCase() === c.trim().toLowerCase()
                          )
                            ? 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300'
                            : 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300'
                        }`}>
                          {userBlanks[i] || <em className="opacity-60">sin respuesta</em>}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
                {blanksDefs.length > 0 && !question.isCorrect && (
                  <div className="text-xs space-y-1">
                    {blanksDefs.map((blank, i) => {
                      const correct = blank.correctAnswers?.join(' / ');
                      const user = userBlanks[i] || '';
                      const isMatch = blank.correctAnswers?.some(c =>
                        user.trim().toLowerCase() === c.trim().toLowerCase()
                      );
                      return !isMatch && correct ? (
                        <p key={i} className="text-blue-600 dark:text-blue-300">
                          Espacio {i + 1}: esperado <strong>{correct}</strong>
                        </p>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            );
          }

          // fallback: no template
          return (
            <div className="bg-muted p-2 rounded text-sm">
              {userBlanks.length > 0
                ? userBlanks.map((b, i) => <p key={i} className="text-foreground">Espacio {i + 1}: "{b}"</p>)
                : <p className="text-muted-foreground italic">Sin respuesta</p>
              }
            </div>
          );
        }

        case 'matching': {
          const userPairs: Record<string, string> = question.response?.pairs || {};
          const items: Array<{ id: string; text: string; matchingPair?: string }> = questionData?.items || [];
          if (items.length === 0) {
            return <div className="bg-muted p-2 rounded text-sm"><p className="text-muted-foreground italic">Sin datos de emparejamiento</p></div>;
          }
          return (
            <div className="space-y-1">
              {items.filter(item => item.matchingPair).map(item => {
                const userMatch = userPairs[item.id];
                const isCorrect = userMatch === item.matchingPair;
                return (
                  <div key={item.id} className={`p-2 rounded text-sm border flex justify-between items-center gap-2 ${
                    isCorrect
                      ? 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300'
                      : 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300'
                  }`}>
                    <span className="font-medium">{item.text}</span>
                    <span className="text-xs">→ {userMatch || <em>sin respuesta</em>}</span>
                    {!isCorrect && item.matchingPair && (
                      <span className="text-xs text-blue-600 dark:text-blue-300 ml-auto">(correcto: {item.matchingPair})</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }

        case 'ordering': {
          const userOrder: string[] = question.response?.order || [];
          const items: Array<{ id: string; text: string; correctPosition?: number }> = questionData?.items || [];
          const correctOrder = [...items]
            .filter(i => i.correctPosition !== undefined)
            .sort((a, b) => (a.correctPosition ?? 0) - (b.correctPosition ?? 0));

          if (items.length === 0) {
            return <div className="bg-muted p-2 rounded text-sm"><p className="text-muted-foreground italic">Sin datos de ordenamiento</p></div>;
          }
          return (
            <div className="space-y-1">
              {userOrder.map((itemId, idx) => {
                const item = items.find(i => i.id === itemId);
                const isCorrect = correctOrder[idx]?.id === itemId;
                return (
                  <div key={itemId} className={`p-2 rounded text-sm border ${
                    isCorrect
                      ? 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300'
                      : 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300'
                  }`}>
                    <span className="font-medium mr-2">{idx + 1}.</span>
                    {item?.text || itemId}
                  </div>
                );
              })}
            </div>
          );
        }

        case 'drag_drop': {
          const userPositions: Record<string, number> = question.response?.positions || {};
          const items: Array<{ id: string; text: string; correctPosition?: number }> = questionData?.items || [];
          if (items.length === 0) {
            return <div className="bg-muted p-2 rounded text-sm"><p className="text-muted-foreground italic">Sin datos de arrastre</p></div>;
          }
          return (
            <div className="space-y-1">
              {items.map(item => {
                const userPos = userPositions[item.id];
                const isCorrect = userPos !== undefined && userPos === item.correctPosition;
                return (
                  <div key={item.id} className={`p-2 rounded text-sm border flex justify-between items-center ${
                    isCorrect
                      ? 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300'
                      : 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300'
                  }`}>
                    <span>{item.text}</span>
                    <span className="text-xs">Zona: {userPos ?? <em>sin respuesta</em>}</span>
                    {!isCorrect && item.correctPosition !== undefined && (
                      <span className="text-xs text-blue-600 dark:text-blue-300">(correcta: {item.correctPosition})</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }

        default:
          return (
            <div className="space-y-2">
              <div className="bg-muted p-2 rounded text-sm">
                <p className="text-foreground/80">Respuesta registrada</p>
              </div>
            </div>
          );
      }
    }

    return questionContent;
  };

  const handleDownloadPDF = async (resultId: string) => {
    if (!resultId) {
      toast.error('ID de resultado requerido para generar PDF');
      return;
    }

    try {
      toast.loading('Generando PDF profesional...', { id: 'pdf-generation' });

      // Call backend endpoint for professional PDF generation with LLM
      const resp = await api.get(`/api/v1/exam-results/${resultId}/export-pdf`, {
        params: {
          includeQuestions: true,
          includeAI: true,
          includeLLM: true, // Enable LLM interpretation
          language: 'spanish',
          llmDepth: 'detailed',
          llmFocus: 'academic'
        },
        responseType: 'blob' // Important for downloading binary data
      }) as Blob | { data: Blob };

      // Create blob and download
      const blob = resp instanceof Blob ? resp : resp.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // Generate filename with current date
      const fileName = `Resultado_Examen_${resultId}_${new Date().toISOString().split('T')[0]}.pdf`;
      link.download = fileName;

      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up
      window.URL.revokeObjectURL(url);

      toast.success('PDF descargado exitosamente', { id: 'pdf-generation' });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Error al generar el PDF profesional', { id: 'pdf-generation' });
    }
  };

  // const handleDownloadPDFFromHTML = async () => {
  //   try {
  //     toast.loading('Capturando página y generando PDF...', { id: 'pdf-html-generation' });

  //     const fileName = `Resultado_${currentResult?.examName?.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
  //     await PDFService.generateFromHTML('exam-result-content', fileName);

  //     toast.success('PDF descargado exitosamente', { id: 'pdf-html-generation' });
  //   } catch (error) {
  //     console.error('Error generating PDF from HTML:', error);
  //     toast.error('Error al generar el PDF', { id: 'pdf-html-generation' });
  //   }
  // };

  const handleViewDetails = (result: StudentExamResult) => {
    navigate(`/student/results/${result.id}`);
  };

  const handleBackToResults = () => {
    navigate('/student/results');
  };

  // Filtrado client-side: nivel + rango de fechas
  const filteredResults = useMemo(() => {
    if (!resultsData?.results) return [];
    return resultsData.results.filter(r => {
      if (selectedLevel !== 'all' && r.level !== selectedLevel) return false;
      const date = new Date(r.date);
      if (dateRange?.from && date < dateRange.from) return false;
      if (dateRange?.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        if (date > endOfDay) return false;
      }
      return true;
    });
  }, [resultsData, selectedLevel, dateRange]);

  // Columnas de la tabla — una sola línea por celda, sin datos apilados
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const columns = useMemo(() => [
    columnHelper.accessor('examName', {
      id: 'examName',
      header: 'Examen',
      cell: ({ getValue }) => (
        <span className="font-medium text-foreground text-sm truncate max-w-[200px] block">
          {getValue()}
        </span>
      ),
      enableSorting: true,
    }),
    columnHelper.accessor('date', {
      id: 'date',
      header: 'Fecha',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {new Date(getValue()).toLocaleDateString('es-ES', {
            day: '2-digit', month: 'short', year: 'numeric',
          })}
        </span>
      ),
      enableSorting: true,
    }),
    columnHelper.display({
      id: 'level',
      header: 'Nivel',
      cell: ({ row }) => (
        <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30">
          {row.original.level}
        </span>
      ),
      enableSorting: false,
    }),
    columnHelper.accessor('overallScore', {
      id: 'overallScore',
      header: 'Puntaje',
      cell: ({ getValue }) => (
        <span className={`text-sm font-semibold tabular-nums ${getScoreColor(getValue())}`}>
          {getValue()}%
        </span>
      ),
      enableSorting: true,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => handleViewDetails(row.original)}
        >
          <Eye className="h-3.5 w-3.5 mr-1" />
          Ver
        </Button>
      ),
      enableSorting: false,
    }),
  ], []);

  const resultsTable = useReactTable({
    data: filteredResults,
    columns,
    state: { sorting, pagination },
    onSortingChange: (updater) => {
      setSorting(typeof updater === 'function' ? updater(sorting) : updater);
      setPagination(p => ({ ...p, pageIndex: 0 }));
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Show detail view if resultId exists
  if (resultId) {
    if (detailLoading) {
      return (
        <MainLayout gradientVariant="primary">
          <div className="max-w-6xl mx-auto flex items-center justify-center min-h-96">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Cargando resultado...</p>
            </div>
          </div>
        </MainLayout>
      );
    }

    if (detailError) {
      return (
        <MainLayout gradientVariant="primary">
          <div className="max-w-6xl mx-auto flex items-center justify-center min-h-96">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400 mx-auto mb-4" />
              <p className="text-red-600 dark:text-red-300 mb-4">Error: {detailError}</p>
              <Button onClick={handleBackToResults} variant="outline">
                Volver a Resultados
              </Button>
            </div>
          </div>
        </MainLayout>
      );
    }

    if (!currentResult) {
      return (
        <MainLayout gradientVariant="primary">
          <div className="max-w-6xl mx-auto flex items-center justify-center min-h-96">
            <div className="text-center">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">Resultado no encontrado</p>
              <Button onClick={handleBackToResults} variant="outline">
                Volver a Resultados
              </Button>
            </div>
          </div>
        </MainLayout>
      );
    }

    // Vista detallada de un resultado específico
    return (
      <MainLayout gradientVariant="primary">
        <div id="exam-result-content" className="max-w-3xl mx-auto space-y-4 mt-6 px-4 pb-10">
          <Card className="bg-card backdrop-blur-sm border border-line">
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-foreground leading-snug truncate">
                    {currentResult.examName}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatDate(currentResult.date)} · {currentResult.duration} min
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <Badge className={`text-sm font-bold px-3 py-1 ${getScoreBadgeColor(currentResult.overallScore)}`}>
                    {currentResult.overallScore}%
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2.5 text-xs border-line text-muted-foreground hover:bg-muted bg-transparent"
                      onClick={handleBackToResults}
                    >
                      <ArrowLeft className="h-3 w-3 mr-1" />
                      Volver
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleDownloadPDF(currentResult.id)}
                      className="h-7 px-2.5 text-xs text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${getScoreBadgeColor(currentResult.overallScore)}`}>
                  {currentResult.passed ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {currentResult.passed ? 'Aprobado' : 'No aprobado'}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-blue-200 text-blue-700 bg-blue-100 dark:border-blue-500/30 dark:text-blue-300 dark:bg-blue-500/10">
                  Nivel {currentResult.level}
                </span>
                {currentResult.nextLevel && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground bg-transparent">
                    Siguiente: {currentResult.nextLevel}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {currentResult.duration} min
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
              <Card className="bg-card backdrop-blur-sm border border-line">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground flex items-center gap-2 text-sm">
                    <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    Desglose por Competencias
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  {Object.entries(currentResult.competencies ?? {}).map(
                    ([skill, data]) => {
                      const comp =
                        (data as { score?: number; feedback?: string }) || {};
                      const score = comp.score ?? 0;
                      const feedback = comp.feedback ?? '';
                      return (
                        <div key={skill} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-foreground">
                              {getCompetencyName(skill)}
                            </h4>
                            <span className={`text-sm font-semibold ${getScoreColor(score)}`}>
                              {score}%
                            </span>
                          </div>
                          <Progress value={score} className="h-1.5 w-full" />
                          {feedback && <p className="text-xs text-muted-foreground">{feedback}</p>}
                        </div>
                      );
                    }
                  )}
                </CardContent>
              </Card>

              <Card className="bg-card backdrop-blur-sm border border-line">
                <CardHeader className="pb-3">
                  <CardTitle className="text-foreground flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
                    Retroalimentación General
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-foreground/80 mb-3 leading-relaxed">{currentResult.feedback}</p>
                  {currentResult.recommendations?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Recomendaciones:</p>
                      <ul className="space-y-1.5">
                        {currentResult.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start gap-2 text-xs text-muted-foreground">
                            <Target className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Detalle de preguntas del examen */}
              {examDetailData?.questionResults && (
                <Card className="bg-card backdrop-blur-sm border border-line">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-foreground flex items-center gap-2 text-sm">
                      <Eye className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                      Preguntas del Examen
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {examDetailData.questionResults.map((question: any, index: number) => {
                      // Defensive deduplication: aiAnalysis.feedback is sometimes the same
                      // string as question.feedback (bug in older grading results).
                      // Only show aiAnalysis.feedback if it's non-empty AND differs from feedback.
                      const aiFeedback = question.aiAnalysis?.feedback?.trim() || '';
                      const mainFeedback = question.feedback?.trim() || '';
                      const showAiFeedback = aiFeedback && aiFeedback !== mainFeedback;
                      const hasSuggestions = question.aiAnalysis?.suggestions?.length > 0;
                      const hasAiSection = showAiFeedback || hasSuggestions;

                      const scoreColor =
                        question.isCorrect === true
                          ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30'
                          : question.isCorrect === false
                          ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30'
                          : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30';

                      return (
                        <div key={question.questionId}>
                          {/* Separador entre preguntas */}
                          {index > 0 && (
                            <div className="flex items-center gap-3 px-6">
                              <div className="flex-1 h-px bg-border/60" />
                              <span className="text-xs text-muted-foreground/60 font-medium">#{index + 1}</span>
                              <div className="flex-1 h-px bg-border/60" />
                            </div>
                          )}

                          <div className="px-5 py-3 space-y-3">
                            {/* Header */}
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-foreground flex-shrink-0">
                                  {index + 1}
                                </span>
                                <span className="text-sm text-foreground/80">{getQuestionTypeName(question.questionType)}</span>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="text-xs text-muted-foreground">{getCompetencyName(question.competency)}</span>
                                {question.isCorrect !== undefined && (
                                  question.isCorrect
                                    ? <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                                    : <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
                                )}
                              </div>
                              <Badge className={scoreColor}>
                                {question.score}/{question.maxScore}
                              </Badge>
                            </div>

                            {/* Respuesta del estudiante */}
                            <div className="pl-9">
                              {renderQuestionResponse(question)}
                            </div>

                            {/* Retroalimentación principal */}
                            {mainFeedback && (
                              <div className="ml-9 border border-blue-200 dark:border-blue-700/40 rounded-lg overflow-hidden">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-700/40">
                                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">Retroalimentación</span>
                                </div>
                                <div className="px-4 py-3 bg-card">
                                  <p className="text-foreground/80 text-xs leading-relaxed">{mainFeedback}</p>
                                </div>
                              </div>
                            )}

                            {/* Análisis de IA — solo si tiene contenido distinto */}
                            {hasAiSection && (
                              <div className="ml-9 border border-purple-200 dark:border-purple-700/40 rounded-lg overflow-hidden">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/30 border-b border-purple-200 dark:border-purple-700/40">
                                  <div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />
                                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">Análisis</span>
                                </div>
                                <div className="px-4 py-3 bg-card space-y-2">
                                  {showAiFeedback && (
                                    <p className="text-foreground/80 text-xs leading-relaxed">{aiFeedback}</p>
                                  )}
                                  {hasSuggestions && (
                                    <div>
                                      <p className="text-xs font-medium text-muted-foreground mb-1.5">Sugerencias:</p>
                                      <ul className="space-y-1">
                                        {question.aiAnalysis.suggestions.map((s: string, idx: number) => (
                                          <li key={idx} className="flex items-start gap-2 text-foreground/70 text-xs">
                                            <span className="text-purple-500 dark:text-purple-400 mt-0.5 flex-shrink-0 font-bold">›</span>
                                            {s}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
          </div>
        </div>
      </MainLayout>
    );
  }

  // Vista principal de todos los resultados
  const totalRows = filteredResults.length;

  return (
    <MainLayout gradientVariant="primary">
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-12 space-y-6">

        {/* Encabezado */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mis Resultados</h1>
          <p className="text-sm text-muted-foreground mt-1">Historial completo de tus evaluaciones</p>
        </div>

        {/* Estado: cargando */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground mr-3" />
            <span className="text-muted-foreground">Cargando resultados...</span>
          </div>
        )}

        {/* Estado: error */}
        {error && !loading && (
          <Card className="bg-card border border-red-700/50">
            <CardContent className="p-8 text-center">
              <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-foreground mb-1">Error al cargar resultados</h3>
              <p className="text-red-600 dark:text-red-300 text-sm mb-4">{error}</p>
              <Button onClick={loadStudentResults} variant="outline" size="sm">Reintentar</Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && resultsData && (
          <>
            <GradientWrapper position="top-right" variant="cosmic" intensity="low" size="lg" animate={false}>
              <Card className="bg-card border border-line shadow-none">

                {/* Stats row */}
                <div className="grid grid-cols-2 lg:grid-cols-4 border-b border-line">
                  <div className="p-4 border-r border-line">
                    <p className="text-xs text-muted-foreground">Promedio</p>
                    <p className={`text-xl font-semibold ${getScoreColor(resultsData.averageScore)}`}>
                      {resultsData.averageScore}%
                    </p>
                  </div>
                  <div className="p-4 lg:border-r border-line">
                    <p className="text-xs text-muted-foreground">Progreso</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <p className={`text-xl font-semibold ${resultsData.progressTrend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {resultsData.progressTrend >= 0 ? '+' : ''}{Math.round(resultsData.progressTrend * 10) / 10}
                      </p>
                      {resultsData.progressTrend >= 0
                        ? <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        : <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />}
                    </div>
                  </div>
                  <div className="p-4 border-r border-t lg:border-t-0 border-line">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-xl font-semibold text-foreground">{resultsData.totalResults}</p>
                  </div>
                  <div className="p-4 border-t lg:border-t-0 border-line">
                    <p className="text-xs text-muted-foreground">Completados</p>
                    <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                      {resultsData.results.filter(r => r.status === 'completed').length}
                    </p>
                  </div>
                </div>

                {/* Header con filtros inline */}
                <CardHeader className="border-b border-line pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-foreground text-base">Historial de Evaluaciones</CardTitle>
                      <CardDescription className="text-muted-foreground text-xs mt-0.5">
                        {filteredResults.length > 0
                          ? `${filteredResults.length} resultado${filteredResults.length !== 1 ? 's' : ''}`
                          : 'Sin resultados'}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Filtro: Nivel */}
                      <select
                        value={selectedLevel}
                        onChange={e => { setSelectedLevel(e.target.value); setPagination(p => ({ ...p, pageIndex: 0 })); }}
                        className="h-7 text-xs bg-muted/60 border border-border rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="all">Todos los niveles</option>
                        <option value="A1">A1</option>
                        <option value="A2">A2</option>
                        <option value="B1">B1</option>
                        <option value="B2">B2</option>
                        <option value="C1">C1</option>
                        <option value="C2">C2</option>
                      </select>

                      {/* Filtro: Rango de fechas */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="h-7 flex items-center gap-1.5 px-2 text-xs rounded border border-border bg-muted/60 text-foreground hover:bg-muted transition-colors whitespace-nowrap">
                            <CalendarIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
                            {dateRange?.from ? (
                              dateRange.to ? (
                                <>{dateRange.from.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} — {dateRange.to.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                              ) : (
                                <>{dateRange.from.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</>
                              )
                            ) : (
                              <span className="text-muted-foreground">Rango de fechas</span>
                            )}
                            {dateRange?.from && (
                              <span
                                role="button"
                                onClick={e => { e.stopPropagation(); setDateRange(undefined); setPagination(p => ({ ...p, pageIndex: 0 })); }}
                                className="ml-1 text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-3 w-3" />
                              </span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="range"
                            selected={dateRange}
                            onSelect={range => { setDateRange(range); setPagination(p => ({ ...p, pageIndex: 0 })); }}
                            numberOfMonths={2}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </CardHeader>

                {/* Tabla */}
                <CardContent className="p-0">
                  <CustomizableTable
                    table={resultsTable}
                    isLoading={loading}
                    isFetching={false}
                    isError={!!error}
                    errorMessage={error ?? undefined}
                    noDataMessage={
                      selectedLevel !== 'all' || dateRange?.from
                        ? 'No hay resultados con los filtros seleccionados.'
                        : 'Aún no has completado ninguna evaluación.'
                    }
                    rows={pagination.pageSize}
                  />
                </CardContent>

                {/* Paginación */}
                {resultsTable.getPageCount() > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-line">
                    <p className="text-xs text-muted-foreground">
                      {resultsTable.getState().pagination.pageIndex * resultsTable.getState().pagination.pageSize + 1}–{Math.min((resultsTable.getState().pagination.pageIndex + 1) * resultsTable.getState().pagination.pageSize, totalRows)} de {totalRows}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-line bg-transparent text-muted-foreground hover:bg-muted disabled:opacity-30" onClick={() => resultsTable.previousPage()} disabled={!resultsTable.getCanPreviousPage()}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {Array.from({ length: resultsTable.getPageCount() }, (_, i) => i).map(i => (
                        <Button key={i} variant="outline" size="sm" className={`h-7 w-7 p-0 text-xs border-line ${i === resultsTable.getState().pagination.pageIndex ? 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-600/30 dark:text-blue-300 dark:border-blue-500/50' : 'bg-transparent text-muted-foreground hover:bg-muted'}`} onClick={() => resultsTable.setPageIndex(i)}>
                          {i + 1}
                        </Button>
                      ))}
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0 border-line bg-transparent text-muted-foreground hover:bg-muted disabled:opacity-30" onClick={() => resultsTable.nextPage()} disabled={!resultsTable.getCanNextPage()}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </GradientWrapper>
          </>
        )}
      </div>
    </MainLayout>
  );
};

export default StudentResults;
