import { Button } from '@/components/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Input } from '@/components/atoms/input';
import GradientWrapper from '@/components/background/GrandWrapperSection';
import { MainLayout } from '@/components/layout';
import {
  reportsService,
  type StudentHistoryData,
  type ExportOptions
} from '@/services/reportsService';
import ExportOptionsModal from '@/components/modals/ExportOptionsModal';
import {
  Award,
  Book,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  Search,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  Target,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  Minus,
  Download
} from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';
import { useParams } from 'react-router-dom';

const StudentHistoryScreen: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const [historyData, setHistoryData] = useState<StudentHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchStudentId, setSearchStudentId] = useState(studentId || '');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const loadStudentHistory = async (id: string) => {
    if (!id.trim()) {
      toast.error('Por favor ingrese un ID de estudiante');
      return;
    }

    try {
      setLoading(true);
      const history = await reportsService.getStudentHistory(id);
      setHistoryData(history);
    } catch (error) {
      console.error('Error loading student history:', error);
      toast.error('Error cargando el historial del estudiante');
      setHistoryData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadStudentHistory(searchStudentId);
  };

  const handleOpenExportModal = () => {
    if (!historyData) {
      toast.error('No hay datos del estudiante para exportar');
      return;
    }
    setExportModalOpen(true);
  };

  const handleExportHistory = async (format: 'csv' | 'pdf', exportOptions?: ExportOptions) => {
    if (!historyData) {
      toast.error('No hay datos del estudiante para exportar');
      return;
    }

    try {
      setExportLoading(true);
      await reportsService.exportReport('student-history', {}, format, historyData.studentId, exportOptions);
      const formatText = format === 'pdf' ? 'PDF' : 'CSV';
      const aiText = exportOptions?.includeInterpretation ? ' con análisis IA' : '';
      toast.success(`Historial del estudiante exportado como ${formatText}${aiText} exitosamente`);
      setExportModalOpen(false);
    } catch (error) {
      toast.error('Error exportando el historial del estudiante');
    } finally {
      setExportLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
    if (score >= 75) return 'text-blue-400 bg-blue-500/10 border border-blue-500/20';
    if (score >= 60) return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
    return 'text-red-400 bg-red-500/10 border border-red-500/20';
  };

  const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-4 w-4 text-emerald-400" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-400" />;
      default: return <Minus className="h-4 w-4 text-slate-400" />;
    }
  };

  const getTrendColor = (trend: 'improving' | 'stable' | 'declining') => {
    switch (trend) {
      case 'improving': return 'text-emerald-400';
      case 'declining': return 'text-red-400';
      default: return 'text-slate-400';
    }
  };

  // Auto-search if studentId is provided from URL
  React.useEffect(() => {
    if (studentId) {
      loadStudentHistory(studentId);
    }
  }, [studentId]);

  return (
    <MainLayout>
      <div className="space-y-4 p-4 min-h-screen">
        {/* Header */}
        <GradientWrapper
          intensity="medium"
          size="md"
          position="center"
          animate={false}
          variant="cosmic"
        >
          <div className="flex items-center justify-between p-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Historial de Estudiante
              </h1>
              <p className="text-slate-400 text-sm">
                Análisis detallado del progreso académico individual
              </p>
            </div>

            {historyData && (
              <Button
                onClick={handleOpenExportModal}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-0"
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Exportar
              </Button>
            )}
          </div>
        </GradientWrapper>

        {/* Search Section */}
        <Card className="bg-box border-line">
          <CardContent className="p-4">
            <div className="flex space-x-2">
              <div className="flex-1">
                <Input
                  placeholder="Ingrese ID del estudiante..."
                  value={searchStudentId}
                  onChange={(e) => setSearchStudentId(e.target.value)}
                  className="bg-slate-800 border-line text-white"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Buscar
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
              <p className="text-slate-400 text-sm">Cargando historial del estudiante...</p>
            </div>
          </div>
        )}

        {/* Student Info and Summary */}
        {historyData && (
          <>
            {/* Student Info */}
            <Card className="bg-box border-line">
              <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-full bg-blue-500/10 border border-blue-500/20">
                    <User className="h-8 w-8 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-white">
                      {historyData.studentInfo.name}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {historyData.studentInfo.email}
                    </p>
                    <p className="text-xs text-slate-500">
                      Registrado: {formatDate(historyData.studentInfo.registrationDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">ID del Estudiante</p>
                    <p className="text-sm font-mono text-slate-300">{historyData.studentId}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <Card className="bg-box border-line">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-400">
                        Total Exámenes
                      </p>
                      <p className="text-2xl font-bold text-white">
                        {historyData.summary.totalExams}
                      </p>
                      <p className="text-xs text-blue-400">
                        Completados
                      </p>
                    </div>
                    <BookOpen className="h-8 w-8 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-box border-line">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-400">
                        Promedio General
                      </p>
                      <p className="text-2xl font-bold text-white">
                        {historyData.summary.averageScore.toFixed(1)}%
                      </p>
                      <p className="text-xs text-emerald-400">
                        Puntuación
                      </p>
                    </div>
                    <Award className="h-8 w-8 text-emerald-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-box border-line">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-400">
                        Mejor Puntuación
                      </p>
                      <p className="text-2xl font-bold text-white">
                        {historyData.summary.bestScore.toFixed(1)}%
                      </p>
                      <p className="text-xs text-amber-400">
                        Máximo alcanzado
                      </p>
                    </div>
                    <Target className="h-8 w-8 text-amber-500" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-box border-line">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-400">
                        Tiempo Total
                      </p>
                      <p className="text-2xl font-bold text-white">
                        {formatDuration(historyData.summary.totalTimeSpent)}
                      </p>
                      <p className="text-xs text-purple-400">
                        En exámenes
                      </p>
                    </div>
                    <Clock className="h-8 w-8 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Competency Progress */}
            <Card className="bg-box border-line">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-white text-base">
                  <Target className="h-4 w-4 text-slate-400" />
                  <span>Progreso por Competencia</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(historyData.competencyProgress).map(([competency, data]) => (
                    <div key={competency} className="p-3 rounded-lg border border-line bg-slate-800/30">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-white text-sm capitalize">
                          {competency.replace('_', ' ')}
                        </h4>
                        <div className="flex items-center space-x-1">
                          {getTrendIcon(data.trend)}
                          <span className={`text-xs font-medium ${getTrendColor(data.trend)}`}>
                            {data.trend === 'improving' ? 'Mejorando' :
                             data.trend === 'declining' ? 'Declinando' : 'Estable'}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-400">Nivel Actual:</span>
                          <span className="text-xs font-medium text-slate-300">
                            {data.currentLevel}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-400">Promedio:</span>
                          <span className={`text-xs font-medium ${getPerformanceColor(data.averageScore)}`}>
                            {data.averageScore.toFixed(1)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-xs text-slate-400">Exámenes:</span>
                          <span className="text-xs font-medium text-slate-300">
                            {data.examsCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Exam History */}
            <Card className="bg-box border-line">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-white text-base">
                  <Book className="h-4 w-4 text-slate-400" />
                  <span>Historial de Exámenes ({historyData.examHistory.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {historyData.examHistory.map((exam, index) => (
                    <div key={exam.examId + index} className="p-4 rounded-lg border border-line bg-slate-800/30">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-white text-sm mb-1">
                            {exam.examTitle}
                          </h3>
                          <p className="text-xs text-slate-400 mb-2">
                            Sesión: {exam.sessionName}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-slate-300">
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(exam.completedAt)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatDuration(exam.timeSpent)}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Target className="h-3 w-3" />
                              <span>{exam.level}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`px-3 py-1 rounded text-sm font-medium ${getPerformanceColor(exam.percentage)}`}>
                            {exam.percentage.toFixed(1)}%
                          </div>
                          <p className="text-xs text-slate-400 mt-1">
                            {exam.finalScore}/{exam.maxScore} puntos
                          </p>
                        </div>
                      </div>

                      {/* Competency Scores */}
                      {exam.competencyScores.length > 0 && (
                        <div className="border-t border-line pt-3">
                          <h4 className="text-xs font-medium text-slate-300 mb-2">Puntuaciones por Competencia:</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {exam.competencyScores.map((comp, compIndex) => (
                              <div key={compIndex} className="text-center p-2 rounded bg-slate-700/50 border border-slate-600">
                                <p className="text-xs text-slate-400 capitalize">
                                  {comp.competency.replace('_', ' ')}
                                </p>
                                <p className="text-sm font-medium text-white">
                                  {comp.percentage.toFixed(0)}%
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Feedback */}
                      {exam.feedback && (
                        <div className="border-t border-line pt-3 mt-3">
                          <h4 className="text-xs font-medium text-slate-300 mb-1">Retroalimentación:</h4>
                          <p className="text-xs text-slate-400 italic">
                            {exam.feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}

                  {historyData.examHistory.length === 0 && (
                    <div className="text-center py-8">
                      <BookOpen className="h-12 w-12 text-slate-500 mx-auto mb-3" />
                      <p className="text-slate-400 text-sm">No hay exámenes registrados para este estudiante</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            {historyData.recommendations.length > 0 && (
              <Card className="bg-box border-line">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center space-x-2 text-white text-base">
                    <CheckCircle className="h-4 w-4 text-slate-400" />
                    <span>Recomendaciones</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {historyData.recommendations.map((recommendation, index) => (
                      <div key={index} className="flex items-start space-x-2 p-3 rounded bg-blue-500/10 border border-blue-500/20">
                        <CheckCircle className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-white">{recommendation}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* No data state */}
        {!loading && !historyData && searchStudentId && (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">
              No se encontró información para el estudiante ID: {searchStudentId}
            </p>
          </div>
        )}

        {/* Modal de Exportación */}
        <ExportOptionsModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          onExport={handleExportHistory}
          reportType="student-history"
          isLoading={exportLoading}
        />
      </div>
    </MainLayout>
  );
};

export default StudentHistoryScreen;