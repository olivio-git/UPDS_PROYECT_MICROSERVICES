import { Button } from '@/components/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Input } from '@/components/atoms/input';
import GradientWrapper from '@/components/background/GrandWrapperSection';
import { MainLayout } from '@/components/layout';
import ExportOptionsModal from '@/components/modals/ExportOptionsModal';
import {
  reportsService,
  type CompetencyAnalysis,
  type DashboardSummary,
  type ExportOptions,
  type ReportFilters,
  type StudentStats,
  type TrendsData
} from '@/services/reportsService';
import {
  Award,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Target,
  TrendingUp,
  Users
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

const ReportsScreen: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [competencyData, setCompetencyData] = useState<CompetencyAnalysis | null>(null);
  const [studentData, setStudentData] = useState<StudentStats | null>(null);
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportReportType, setExportReportType] = useState<'competency' | 'students'>('competency');
  const [exportLoading, setExportLoading] = useState(false);

  // Filters state
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: '',
    endDate: '',
    levels: [],
    competencies: [],
    examTypes: [],
  });

  // Load reports data
  useEffect(() => {
    loadReportsData();
  }, []);

  const loadReportsData = async (customFilters?: ReportFilters) => {
    try {
      setLoading(true);
      const activeFilters = customFilters || filters;

      // Load all reports data in parallel
      const [dashboard, competency, student, trends] = await Promise.all([
        reportsService.getDashboardSummary(activeFilters),
        reportsService.getCompetencyAnalysis(activeFilters),
        reportsService.getStudentStats(activeFilters),
        reportsService.getTrends('month', undefined, activeFilters)
      ]);

      setDashboardData(dashboard);
      setCompetencyData(competency);
      setStudentData(student);
      setTrendsData(trends);

    } catch (error) {
      console.error('Error loading reports data:', error);
      toast.error('Error cargando los reportes');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof ReportFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleApplyFilters = () => {
    loadReportsData(filters);
  };

  const handleClearFilters = () => {
    const emptyFilters: ReportFilters = {};
    setFilters(emptyFilters);
    loadReportsData(emptyFilters);
  };

  const handleOpenExportModal = (type: 'competency' | 'students') => {
    setExportReportType(type);
    setExportModalOpen(true);
  };

  const handleExportReport = async (format: 'csv' | 'pdf', exportOptions?: ExportOptions) => {
    try {
      setExportLoading(true);
      await reportsService.exportReport(exportReportType, filters, format, undefined, exportOptions);
      const formatText = format === 'pdf' ? 'PDF' : 'CSV';
      const aiText = exportOptions?.includeInterpretation ? ' con análisis IA' : '';
      toast.success(`Reporte ${exportReportType === 'competency' ? 'de competencias' : 'de estudiantes'} exportado como ${formatText}${aiText} exitosamente`);
      setExportModalOpen(false);
    } catch (error) {
      toast.error('Error exportando el reporte');
    } finally {
      setExportLoading(false);
    }
  };

  const getPerformanceColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
    if (score >= 75) return 'text-blue-400 bg-blue-500/10 border border-blue-500/20';
    if (score >= 60) return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
    return 'text-red-400 bg-red-500/10 border border-red-500/20';
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
      case 'medium': return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
      case 'hard': return 'text-red-400 bg-red-500/10 border border-red-500/20';
      default: return 'text-slate-400 bg-slate-500/10 border border-slate-500/20';
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500" />
            <p className="text-slate-400 text-sm">Cargando reportes...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

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
        <div className="flex items-center justify-between    p-4  ">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Reportes y Análisis
            </h1>
            <p className="text-slate-400 text-sm">
              Análisis detallado del rendimiento académico y competencias
            </p>
          </div>

          <Button
            onClick={() => loadReportsData()}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white border-0"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Actualizar
          </Button>
        </div>
</GradientWrapper>
        {/* Filters Section */}
        <Card className="bg-box border-line">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center space-x-2 text-white text-base">
                <Filter className="h-4 w-4 text-slate-400" />
                <span>Filtros</span>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiltersExpanded(!filtersExpanded)}
                className="text-slate-400 hover:text-white hover:bg-slate-800"
              >
                {filtersExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </CardHeader>

          {filtersExpanded && (
            <CardContent className="space-y-3 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1 block">
                    Fecha Inicio
                  </label>
                  <Input
                    type="date"
                    value={filters.startDate || ''}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    className="bg-slate-800 border-line text-white text-sm h-8"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1 block">
                    Fecha Fin
                  </label>
                  <Input
                    type="date"
                    value={filters.endDate || ''}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    className="bg-slate-800 border-line text-white text-sm h-8"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1 block">
                    Puntaje Mínimo
                  </label>
                  <Input
                    type="number"
                    placeholder="0-100"
                    value={filters.minScore || ''}
                    onChange={(e) => handleFilterChange('minScore', Number(e.target.value))}
                    className="bg-slate-800 border-line text-white text-sm h-8"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 mb-1 block">
                    Puntaje Máximo
                  </label>
                  <Input
                    type="number"
                    placeholder="0-100"
                    value={filters.maxScore || ''}
                    onChange={(e) => handleFilterChange('maxScore', Number(e.target.value))}
                    className="bg-slate-800 border-line text-white text-sm h-8"
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button onClick={handleApplyFilters} size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700  text-white">
                  Aplicar Filtros
                </Button>
                <Button onClick={handleClearFilters} variant="outline" size="sm" className="h-7 text-xs border-line text-slate-300 bg-gray-800 hover:bg-gray-700  text-white">
                  Limpiar
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Dashboard Overview */}
        {dashboardData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <Card className="bg-box border-line">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-400">
                      Total Estudiantes
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {dashboardData.overview.totalStudents}
                    </p>
                    <p className="text-xs text-blue-400">
                      {dashboardData.overview.evaluatedStudents} evaluados
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-blue-500" />
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
                      {dashboardData.overview.averageScore.toFixed(1)}
                    </p>
                    <p className="text-xs text-emerald-400">
                      Puntos sobre 100
                    </p>
                  </div>
                  <Award className="h-8 w-8 text-amber-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-box border-line">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-400">
                      Total Exámenes
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {dashboardData.overview.totalExams}
                    </p>
                    <p className="text-xs text-blue-400">
                      Realizados
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-box border-line">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-400">
                      Tasa Completación
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {dashboardData.overview.completionRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-emerald-400">
                      Exámenes terminados
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-box border-line">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-400">
                      Eficiencia Tiempo
                    </p>
                    <p className="text-2xl font-bold text-white">
                      {dashboardData.trends.timeEfficiency.toFixed(1)}%
                    </p>
                    <p className="text-xs text-blue-400">
                      Uso optimal
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-indigo-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Performance Distribution and Top Performers */}
        {dashboardData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-box border-line">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-white text-base">
                  <BarChart3 className="h-4 w-4 text-slate-400" />
                  <span>Distribución de Rendimiento</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-300">Excelente (90-100)</span>
                    <span className="text-xs text-emerald-400 font-semibold">
                      {dashboardData.performanceDistribution.excellent}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${dashboardData.performanceDistribution.excellent}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-300">Bueno (75-89)</span>
                    <span className="text-xs text-blue-400 font-semibold">
                      {dashboardData.performanceDistribution.good}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${dashboardData.performanceDistribution.good}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-300">Satisfactorio (60-74)</span>
                    <span className="text-xs text-amber-400 font-semibold">
                      {dashboardData.performanceDistribution.satisfactory}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full"
                      style={{ width: `${dashboardData.performanceDistribution.satisfactory}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-300">Necesita Mejora (&lt;60)</span>
                    <span className="text-xs text-red-400 font-semibold">
                      {dashboardData.performanceDistribution.needsImprovement}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5">
                    <div
                      className="bg-red-500 h-1.5 rounded-full"
                      style={{ width: `${dashboardData.performanceDistribution.needsImprovement}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-box border-line">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center space-x-2 text-white text-base">
                  <TrendingUp className="h-4 w-4 text-slate-400" />
                  <span>Mejores Estudiantes</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {dashboardData.topPerformers.map((student, index) => (
                    <div key={student.studentId+index} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/50 border border-line">
                      <div className="flex items-center space-x-2.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                          index === 0 ? 'bg-amber-500' :
                          index === 1 ? 'bg-slate-400' :
                          index === 2 ? 'bg-amber-600' : 'bg-blue-500'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">
                            {student.studentName}
                          </p>
                          <p className="text-xs text-slate-400">
                            {student.examsCompleted} exámenes completados
                          </p>
                        </div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium ${getPerformanceColor(student.averageScore)}`}>
                        {student.averageScore.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Competency Ranking */}
        {dashboardData && (
          <Card className="bg-box border-line">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-white text-base">
                  <Target className="h-4 w-4 text-slate-400" />
                  <span>Ranking de Competencias</span>
                </div>
                <Button
                  onClick={() => handleOpenExportModal('competency')}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-line text-slate-300 bg-blue-800 hover:bg-blue-700"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Exportar
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {dashboardData.competencyRanking.map((competency) => (
                  <div key={competency.competency} className="p-3 rounded-lg border border-line bg-slate-800/30">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-white capitalize text-sm">
                        {competency.competency.replace('_', ' ')}
                      </h3>
                      <div className={`px-1.5 py-0.5 rounded text-xs font-medium ${getDifficultyColor(competency.difficulty)}`}>
                        {competency.difficulty}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-xs text-slate-400">Promedio:</span>
                        <span className={`text-xs font-medium ${getPerformanceColor(competency.averageScore)}`}>
                          {competency.averageScore.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs text-slate-400">Estudiantes:</span>
                        <span className="text-xs font-medium text-slate-300">
                          {competency.studentsEvaluated}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recommendations and Improvement Areas */}
        {dashboardData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-box border-line">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base">Áreas de Mejora</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {dashboardData.improvementAreas.map((area, index) => (
                    <div key={index} className="flex items-center space-x-2 p-2 rounded bg-red-500/10 border border-red-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      <span className="text-xs text-white">{area}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-box border-line">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base">Recomendaciones</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {dashboardData.recommendations.map((recommendation, index) => (
                    <div key={index} className="flex items-center space-x-2 p-2 rounded bg-blue-500/10 border border-blue-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span className="text-xs text-white">{recommendation}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Export Actions */}
        <Card className="bg-box border-line">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center space-x-2 text-white text-base">
              <Download className="h-4 w-4 text-slate-400" />
              <span>Exportar Reportes</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-300">Reporte de Competencias</p>
                <Button
                  onClick={() => handleOpenExportModal('competency')}
                  variant="outline"
                  size="sm"
                  className="border-line text-white bg-blue-800 hover:bg-blue-700 text-xs h-8"
                >
                  <Download className="h-3 w-3 mr-1.5" />
                  Exportar
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-300">Reporte de Estudiantes</p>
                <Button
                  onClick={() => handleOpenExportModal('students')}
                  variant="outline"
                  size="sm"
                  className="border-line text-white bg-blue-800 hover:bg-blue-700 text-xs h-8"
                >
                  <Download className="h-3 w-3 mr-1.5" />
                  Exportar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Exportación */}
      <ExportOptionsModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={handleExportReport}
        reportType={exportReportType}
        isLoading={exportLoading}
      />
    </MainLayout>
  );
};

export default ReportsScreen;