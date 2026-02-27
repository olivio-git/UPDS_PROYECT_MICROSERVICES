import { Button } from '@/components/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Input } from '@/components/atoms/input';
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
import {
  Bar, BarChart, CartesianGrid, Cell,
  Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
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

  const [filters, setFilters] = useState<ReportFilters>({
    startDate: '',
    endDate: '',
    levels: [],
    competencies: [],
    examTypes: [],
  });

  const performanceChartData = dashboardData ? [
    { name: 'Excelente',  value: dashboardData.performanceDistribution.excellent,        fill: '#10b981' },
    { name: 'Bueno',      value: dashboardData.performanceDistribution.good,             fill: '#3b82f6' },
    { name: 'Satisfact.', value: dashboardData.performanceDistribution.satisfactory,     fill: '#f59e0b' },
    { name: 'Mejorar',    value: dashboardData.performanceDistribution.needsImprovement, fill: '#ef4444' },
  ] : [];

  useEffect(() => { loadReportsData(); }, []);

  const loadReportsData = async (customFilters?: ReportFilters) => {
    try {
      setLoading(true);
      const activeFilters = customFilters || filters;
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
    } catch {
      toast.error('Error cargando los reportes');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: keyof ReportFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleOpenExportModal = (type: 'competency' | 'students') => {
    setExportReportType(type);
    setExportModalOpen(true);
  };

  const handleExportReport = async (format: 'csv' | 'pdf', exportOptions?: ExportOptions) => {
    try {
      setExportLoading(true);
      await reportsService.exportReport(exportReportType, filters, format, undefined, exportOptions);
      const aiText = exportOptions?.includeInterpretation ? ' con análisis IA' : '';
      toast.success(`Reporte exportado como ${format.toUpperCase()}${aiText}`);
      setExportModalOpen(false);
    } catch {
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
      case 'easy':   return 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20';
      case 'medium': return 'text-amber-400 bg-amber-500/10 border border-amber-500/20';
      case 'hard':   return 'text-red-400 bg-red-500/10 border border-red-500/20';
      default:       return 'text-slate-400 bg-slate-500/10 border border-slate-500/20';
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="h-7 w-7 animate-spin mx-auto text-blue-500" />
            <p className="text-slate-400 text-sm">Cargando reportes...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-3 p-4">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Reportes y Análisis</h1>
            <p className="text-slate-400 text-xs">Rendimiento académico · Competencias · Tendencias</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => loadReportsData()} size="sm" variant="ghost"
              className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 px-2">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <Button onClick={() => handleOpenExportModal('competency')} size="sm" variant="outline"
              className="border-line text-slate-300 bg-slate-800 hover:bg-slate-700 text-xs h-8">
              <Download className="h-3 w-3 mr-1.5" />
              Competencias
            </Button>
            <Button onClick={() => handleOpenExportModal('students')} size="sm"
              className="bg-blue-700 hover:bg-blue-600 text-white text-xs h-8">
              <Download className="h-3 w-3 mr-1.5" />
              Estudiantes
            </Button>
          </div>
        </div>

        {/* ── Filtros colapsables ── */}
        <Card className="bg-box border-line">
          <CardHeader className="py-2 px-4">
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="flex items-center gap-2 text-slate-300 text-sm font-medium">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                Filtros
              </span>
              {filtersExpanded
                ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
            </button>
          </CardHeader>
          {filtersExpanded && (
            <CardContent className="pt-0 pb-3 px-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Fecha inicio</label>
                  <Input type="date" value={filters.startDate || ''}
                    onChange={e => handleFilterChange('startDate', e.target.value)}
                    className="bg-slate-800 border-line text-white text-xs h-7" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Fecha fin</label>
                  <Input type="date" value={filters.endDate || ''}
                    onChange={e => handleFilterChange('endDate', e.target.value)}
                    className="bg-slate-800 border-line text-white text-xs h-7" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Puntaje mínimo</label>
                  <Input type="number" placeholder="0–100" value={filters.minScore || ''}
                    onChange={e => handleFilterChange('minScore', Number(e.target.value))}
                    className="bg-slate-800 border-line text-white text-xs h-7" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Puntaje máximo</label>
                  <Input type="number" placeholder="0–100" value={filters.maxScore || ''}
                    onChange={e => handleFilterChange('maxScore', Number(e.target.value))}
                    className="bg-slate-800 border-line text-white text-xs h-7" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => loadReportsData(filters)} size="sm"
                  className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  Aplicar
                </Button>
                <Button onClick={() => { const e: ReportFilters = {}; setFilters(e); loadReportsData(e); }}
                  variant="outline" size="sm"
                  className="h-7 text-xs border-line text-slate-300 bg-slate-800 hover:bg-slate-700">
                  Limpiar
                </Button>
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── KPIs ── */}
        {dashboardData && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { label: 'Estudiantes', value: dashboardData.overview.totalStudents, sub: `${dashboardData.overview.evaluatedStudents} eval.`, icon: Users, color: 'text-blue-400' },
              { label: 'Promedio',    value: dashboardData.overview.averageScore.toFixed(1), sub: 'sobre 100', icon: Award, color: 'text-amber-400' },
              { label: 'Exámenes',   value: dashboardData.overview.totalExams, sub: 'realizados', icon: FileText, color: 'text-emerald-400' },
              { label: 'Completación', value: `${dashboardData.overview.completionRate.toFixed(1)}%`, sub: 'terminados', icon: Target, color: 'text-purple-400' },
              { label: 'Ef. Tiempo', value: `${dashboardData.trends.timeEfficiency.toFixed(1)}%`, sub: 'uso óptimo', icon: Clock, color: 'text-indigo-400' },
            ].map(({ label, value, sub, icon: Icon, color }) => (
              <Card key={label} className="bg-box border-line">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-400">{label}</p>
                      <p className="text-xl font-bold text-white leading-tight">{value}</p>
                      <p className={`text-xs ${color}`}>{sub}</p>
                    </div>
                    <Icon className={`h-6 w-6 ${color} opacity-70`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Gráficas principales — 3 columnas ── */}
        {dashboardData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

            {/* Distribución */}
            <Card className="bg-box border-line">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="flex items-center gap-2 text-white text-sm">
                  <BarChart3 className="h-4 w-4 text-slate-400" />
                  Distribución de Rendimiento
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={performanceChartData} margin={{ top: 4, right: 4, bottom: 4, left: -24 }}>
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '6px', fontSize: 12 }}
                      formatter={(v: number) => [`${v}%`, 'Porcentaje']}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {performanceChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Tendencias */}
            <Card className="bg-box border-line">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="flex items-center gap-2 text-white text-sm">
                  <TrendingUp className="h-4 w-4 text-slate-400" />
                  Tendencias
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-4">
                {trendsData && trendsData.trends.length > 0 ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={trendsData.trends} margin={{ top: 4, right: 4, bottom: 4, left: -24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="period" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '6px', fontSize: 12 }}
                        formatter={(v: number) => [`${v.toFixed(1)}`, 'Promedio']}
                      />
                      <Line type="monotone" dataKey="averageScore" stroke="#3b82f6" strokeWidth={2}
                        dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5 }} name="Promedio" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[180px] flex items-center justify-center text-slate-500 text-xs">
                    Sin datos de tendencias
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Performers */}
            <Card className="bg-box border-line">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="flex items-center gap-2 text-white text-sm">
                  <Award className="h-4 w-4 text-slate-400" />
                  Mejores Estudiantes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-4 space-y-1.5">
                {dashboardData.topPerformers.map((student, index) => (
                  <div key={student.studentId + index}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-800/50 border border-line">
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                        index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-slate-400' : index === 2 ? 'bg-amber-700' : 'bg-blue-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-white text-xs font-medium leading-tight">{student.studentName}</p>
                        <p className="text-slate-500 text-[10px]">{student.examsCompleted} exámenes</p>
                      </div>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${getPerformanceColor(student.averageScore)}`}>
                      {student.averageScore.toFixed(1)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Competencias — 2 columnas ── */}
        {dashboardData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

            {/* BarChart promedio por competencia */}
            <Card className="bg-box border-line">
              <CardHeader className="pb-2 pt-3 px-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-white text-sm">
                    <Target className="h-4 w-4 text-slate-400" />
                    Promedio por Competencia
                  </CardTitle>
                  <Button onClick={() => handleOpenExportModal('competency')} size="sm" variant="outline"
                    className="h-6 text-xs border-line text-slate-400 bg-transparent hover:bg-slate-800 px-2">
                    <Download className="h-3 w-3 mr-1" /> CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-3 px-4">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={dashboardData.competencyRanking.map(c => ({
                      name: c.competency.charAt(0).toUpperCase() + c.competency.slice(1),
                      promedio: c.averageScore,
                      difficulty: c.difficulty,
                    }))}
                    margin={{ top: 4, right: 4, bottom: 4, left: -24 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '6px', fontSize: 12 }}
                      formatter={(v: number) => [`${v.toFixed(1)}`, 'Promedio']}
                    />
                    <Bar dataKey="promedio" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                {/* Ranking compacto debajo del chart */}
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  {dashboardData.competencyRanking.map(c => (
                    <div key={c.competency} className="flex items-center justify-between px-2 py-1 rounded bg-slate-800/40 border border-line">
                      <span className="text-xs text-slate-300 capitalize">{c.competency.replace('_', ' ')}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] px-1 rounded ${getDifficultyColor(c.difficulty)}`}>{c.difficulty}</span>
                        <span className={`text-xs font-medium ${getPerformanceColor(c.averageScore).split(' ')[0]}`}>
                          {c.averageScore.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Áreas + Recomendaciones */}
            <div className="space-y-3">
              <Card className="bg-box border-line">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-white text-sm">Áreas de Mejora</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-3 px-4 space-y-1.5">
                  {dashboardData.improvementAreas.map((area, i) => (
                    <div key={i} className="flex items-start gap-2 p-1.5 rounded bg-red-500/8 border border-red-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1 shrink-0" />
                      <span className="text-xs text-slate-300 leading-snug">{area}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-box border-line">
                <CardHeader className="pb-2 pt-3 px-4">
                  <CardTitle className="text-white text-sm">Recomendaciones</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 pb-3 px-4 space-y-1.5">
                  {dashboardData.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 p-1.5 rounded bg-blue-500/8 border border-blue-500/20">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1 shrink-0" />
                      <span className="text-xs text-slate-300 leading-snug">{rec}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

      </div>

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
