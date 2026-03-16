import { Button } from '@/components/atoms/button';
import { Calendar } from '@/components/atoms/calendar';
import { Card } from '@/components/atoms/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select';
import { MainLayout } from '@/components/layout';
import ExportOptionsModal from '@/components/modals/ExportOptionsModal';
import TrendChart from '@/components/charts/TrendChart';
import { examService } from '@/services/examService';
import {
  reportsService,
  type CompetencyAnalysis,
  type DashboardSummary,
  type ExportOptions,
  type ReportFilters,
  type StudentListEntry,
  type StudentStats,
  type TrendsData
} from '@/services/reportsService';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Award,
  BarChart3,
  Brain,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Search,
  Table2,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell,
  Line, LineChart, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { toast } from 'sonner';

type ViewMode = 'chart' | 'table';
type ActiveTab = 'resumen' | 'competencias' | 'estudiantes';

const MCER_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const COMPETENCY_LABELS: Record<string, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
};
const LEVEL_COLORS = ['#6366f1', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};

const SectionToggle: React.FC<{ view: ViewMode; onChange: (v: ViewMode) => void }> = ({ view, onChange }) => (
  <div className="flex gap-0.5 bg-muted rounded p-0.5">
    <button
      onClick={() => onChange('chart')}
      className={`p-1 rounded transition-colors ${view === 'chart' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      title="Ver gráfico"
    >
      <BarChart3 className="h-3.5 w-3.5" />
    </button>
    <button
      onClick={() => onChange('table')}
      className={`p-1 rounded transition-colors ${view === 'table' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
      title="Ver tabla"
    >
      <Table2 className="h-3.5 w-3.5" />
    </button>
  </div>
);

const ReportsScreen: React.FC = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardSummary | null>(null);
  const [competencyData, setCompetencyData] = useState<CompetencyAnalysis | null>(null);
  const [studentData, setStudentData] = useState<StudentStats | null>(null);
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);      // solo carga inicial
  const [refreshing, setRefreshing] = useState(false); // actualizaciones por filtro
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportReportType, setExportReportType] = useState<'competency' | 'students'>('competency');
  const [exportLoading, setExportLoading] = useState(false);

  // Student list state
  const [studentList, setStudentList] = useState<StudentListEntry[]>([]);
  const [studentListTotal, setStudentListTotal] = useState(0);
  const [studentListPage, setStudentListPage] = useState(1);
  const [studentListTotalPages, setStudentListTotalPages] = useState(1);
  const [studentListSearch, setStudentListSearch] = useState('');
  const [studentListLoading, setStudentListLoading] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('resumen');

  // View modes per section
  const [viewDistribution, setViewDistribution] = useState<ViewMode>('table');
  const [viewTrends, setViewTrends] = useState<ViewMode>('table');
  const [viewCompetency, setViewCompetency] = useState<ViewMode>('table');
  const [viewLevels, setViewLevels] = useState<ViewMode>('table');
  const [viewCriticalComp, setViewCriticalComp] = useState<ViewMode>('table');

  // Trend period
  const [trendPeriod, setTrendPeriod] = useState<'week' | 'month' | 'quarter'>('month');

  // Sessions for selector
  const [sessions, setSessions] = useState<Array<{ _id: string; name: string }>>([]);

  // Filters
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: '',
    endDate: '',
    levels: [],
    competencies: [],
    examTypes: [],
  });
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

  const performanceChartData = useMemo(() => {
    if (!dashboardData) return [];
    const dist = dashboardData.performanceDistribution;
    const total = (dist.excellent ?? 0) + (dist.good ?? 0) + (dist.acceptable ?? 0) + (dist.needsImprovement ?? 0);
    const pct = (n: number) => total > 0 ? Math.round((n ?? 0) / total * 100) : 0;
    return [
      { name: 'Excelente',  count: dist.excellent ?? 0,        value: pct(dist.excellent ?? 0),        fill: '#10b981', range: '≥85%' },
      { name: 'Bueno',      count: dist.good ?? 0,             value: pct(dist.good ?? 0),             fill: '#3b82f6', range: '70–84%' },
      { name: 'Satisfact.', count: dist.acceptable ?? 0,       value: pct(dist.acceptable ?? 0),       fill: '#f59e0b', range: '60–69%' },
      { name: 'Mejorar',    count: dist.needsImprovement ?? 0, value: pct(dist.needsImprovement ?? 0), fill: '#ef4444', range: '<60%' },
    ];
  }, [dashboardData]);

  const levelChartData = dashboardData?.levelDistribution
    ? Object.entries(dashboardData.levelDistribution)
        .sort(([a], [b]) => MCER_LEVELS.indexOf(a) - MCER_LEVELS.indexOf(b))
        .map(([level, raw]) => {
          const val = raw as any;
          const count: number = typeof val === 'number' ? val : (val?.count ?? 0);
          const averageScore: number | undefined = typeof val === 'object' ? val?.averageScore : undefined;
          const passRate: number | undefined = typeof val === 'object' ? val?.passRate : undefined;
          return { level, count, averageScore, passRate };
        })
    : [];

  // Derived: competencies at risk (averageScore < 70), sorted worst first
  const competenciesAtRisk = useMemo(() => {
    if (!competencyData?.competencyBreakdown) return [];
    return Object.entries(competencyData.competencyBreakdown)
      .map(([comp, data]) => ({ comp, ...data }))
      .filter(c => c.averageScore < 70)
      .sort((a, b) => a.averageScore - b.averageScore);
  }, [competencyData]);

  // Derived: full competency breakdown sorted by score ascending
  const competencyBreakdownSorted = useMemo(() => {
    if (!competencyData?.competencyBreakdown) return [];
    return Object.entries(competencyData.competencyBreakdown)
      .map(([comp, data]) => ({ comp, ...data }))
      .sort((a, b) => a.averageScore - b.averageScore);
  }, [competencyData]);

  const buildActiveFilters = (raw: ReportFilters): ReportFilters =>
    Object.fromEntries(
      Object.entries(raw).filter(([, v]) =>
        v !== '' && v !== undefined && v !== null &&
        !(Array.isArray(v) && v.length === 0)
      )
    ) as ReportFilters;

  const loadStudentList = useCallback(async (page = 1, search = '', overrideFilters?: ReportFilters) => {
    try {
      setStudentList([]);        // limpia inmediatamente para no mostrar datos viejos
      setStudentListLoading(true);
      const activeFilters = buildActiveFilters(overrideFilters ?? filters);
      const result = await reportsService.getStudentList(activeFilters, page, 20, search);
      setStudentList(result.students);
      setStudentListTotal(result.total);
      setStudentListPage(result.page);
      setStudentListTotalPages(result.totalPages);
    } catch {
      toast.error('Error cargando lista de estudiantes');
    } finally {
      setStudentListLoading(false);
    }
  }, [filters]);

  const handleStudentSearch = (value: string) => {
    setStudentListSearch(value);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => loadStudentList(1, value), 350);
  };

  useEffect(() => {
    loadReportsData();
    // Cargar lista de sesiones para el selector
    examService.getSessions({ status: 'completed' }, { page: 1, limit: 100 }).then(res => {
      if (res.success && res.data?.sessions) {
        setSessions(res.data.sessions.map((s: any) => ({ _id: s._id, name: s.sessionName || s.name || s._id })));
      }
    }).catch(() => {});
  }, []);

  // Carga la lista cuando se activa la tab
  useEffect(() => {
    if (activeTab === 'estudiantes') loadStudentList(1, studentListSearch);
  }, [activeTab]);

  const loadReportsData = async (customFilters?: ReportFilters, period?: 'week' | 'month' | 'quarter') => {
    const isInitial = !dashboardData;
    try {
      if (isInitial) setLoading(true);
      else setRefreshing(true);
      const raw = customFilters ?? filters;
      const effectivePeriod = period ?? trendPeriod;

      if (raw.startDate && raw.endDate && raw.startDate > raw.endDate) {
        toast.error('La fecha de inicio no puede ser posterior a la fecha de fin');
        setLoading(false);
        return;
      }

      const activeFilters = buildActiveFilters(raw);
      const [dashboard, competency, student, trends] = await Promise.all([
        reportsService.getDashboardSummary(activeFilters),
        reportsService.getCompetencyAnalysis(activeFilters),
        reportsService.getStudentStats(activeFilters),
        reportsService.getTrends(effectivePeriod, undefined, activeFilters)
      ]);
      setDashboardData(dashboard);
      setCompetencyData(competency);
      setStudentData(student);
      setTrendsData(trends);

      // Si el tab de estudiantes está activo, recargar la lista con los nuevos filtros
      if (activeTab === 'estudiantes') {
        loadStudentList(1, studentListSearch, raw);
      }
    } catch {
      toast.error('Error cargando los reportes');
    } finally {
      if (isInitial) setLoading(false);
      else setRefreshing(false);
    }
  };

  const handleFilterChange = (key: keyof ReportFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    setFilters(prev => ({
      ...prev,
      startDate: range?.from ? format(range.from, 'yyyy-MM-dd') : '',
      endDate: range?.to ? format(range.to, 'yyyy-MM-dd') : '',
    }));
  };

  const handleToggleLevel = (level: string) => {
    setFilters(prev => {
      const levels = prev.levels ?? [];
      return {
        ...prev,
        levels: levels.includes(level) ? levels.filter(l => l !== level) : [...levels, level],
      };
    });
  };

  const handleToggleCompetency = (comp: string) => {
    setFilters(prev => {
      const competencies = prev.competencies ?? [];
      return {
        ...prev,
        competencies: competencies.includes(comp) ? competencies.filter(c => c !== comp) : [...competencies, comp],
      };
    });
  };

  const handleClearFilters = () => {
    setDateRange(undefined);
    const empty: ReportFilters = {};
    setFilters(empty);
    setTrendPeriod('month');
    loadReportsData(empty, 'month');
  };

  const CURRENT_YEAR = new Date().getFullYear();
  const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

  const handlePeriodChange = (p: 'week' | 'month' | 'quarter') => {
    setTrendPeriod(p);
    loadReportsData(filters, p);
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
      default:       return 'text-muted-foreground bg-muted/10 border border-border/20';
    }
  };

  const getDifficultyLabel = (d: string) =>
    ({ easy: 'Fácil', medium: 'Medio', hard: 'Difícil' }[d] || d);

  // strugglingStudents may exist in API response even if not in the TS interface
  const strugglingStudents = studentData
    ? (studentData as any).strugglingStudents as Array<{
        studentId: string;
        studentName: string;
        averageScore: number;
        examsCompleted: number;
        weakCompetencies?: string[];
      }> | undefined
    : undefined;

  // Compact filter bar rendered at the top of each tab
  const TabFilters: React.FC<{ variant?: 'levels' | 'competencies' | 'dates-only' }> = ({ variant = 'dates-only' }) => (
    <div className="flex flex-wrap items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">

      {/* Gestión (año) */}
      <Select
        value={filters.gestion ? String(filters.gestion) : '__all__'}
        onValueChange={v => setFilters(prev => ({ ...prev, gestion: v === '__all__' ? undefined : Number(v), startDate: '', endDate: '', semestre: undefined }))}
      >
        <SelectTrigger className="h-7 w-[90px] text-xs border-border bg-muted/60">
          <SelectValue placeholder="Gestión" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Gestión</SelectItem>
          {YEAR_OPTIONS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* Semestre */}
      <div className="flex gap-0.5 bg-muted rounded p-0.5">
        {([['H1', '1er Sem'], ['H2', '2do Sem']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilters(prev => ({ ...prev, semestre: prev.semestre === val ? undefined : val, startDate: '', endDate: '' }))}
            title={val === 'H1' ? 'Enero – Junio' : 'Julio – Diciembre'}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${filters.semestre === val ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Sesión */}
      {sessions.length > 0 && (
        <Select
          value={filters.sessionId ?? '__all__'}
          onValueChange={v => setFilters(prev => ({ ...prev, sessionId: v === '__all__' ? undefined : v }))}
        >
          <SelectTrigger className="h-7 w-[160px] text-xs border-border bg-muted/60">
            <SelectValue placeholder="Por sesión" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas las sesiones</SelectItem>
            {sessions.map(s => <SelectItem key={s._id} value={s._id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      <div className="w-px h-5 bg-border shrink-0" />

      {/* Rango de fechas libre */}
      <Popover>
        <PopoverTrigger asChild>
          <button className={cn(
            'h-7 flex items-center gap-1.5 px-2 text-xs rounded border border-border bg-muted/60 text-foreground hover:bg-muted transition-colors whitespace-nowrap',
            !dateRange?.from && 'text-muted-foreground'
          )}>
            <CalendarIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>{format(dateRange.from, 'd MMM', { locale: es })} — {format(dateRange.to, 'd MMM yyyy', { locale: es })}</>
              ) : (
                format(dateRange.from, 'd MMM yyyy', { locale: es })
              )
            ) : (
              'Rango libre'
            )}
            {dateRange?.from && (
              <span role="button" onClick={e => { e.stopPropagation(); handleDateRangeChange(undefined); }}
                className="ml-1 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="range" selected={dateRange} onSelect={v => { handleDateRangeChange(v); setFilters(prev => ({ ...prev, gestion: undefined, semestre: undefined })); }} numberOfMonths={2} initialFocus />
        </PopoverContent>
      </Popover>

      {variant === 'levels' && (
        <>
          <div className="w-px h-5 bg-border shrink-0" />
          <div className="flex gap-1 flex-wrap">
            {MCER_LEVELS.map(level => {
              const active = filters.levels?.includes(level);
              return (
                <button key={level} onClick={() => handleToggleLevel(level)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${active ? 'bg-blue-600 border-blue-500 text-white' : 'bg-muted border-border text-muted-foreground hover:text-foreground'}`}>
                  {level}
                </button>
              );
            })}
          </div>
        </>
      )}
      {variant === 'competencies' && (
        <>
          <div className="w-px h-5 bg-border shrink-0" />
          <div className="flex gap-1 flex-wrap">
            {Object.entries(COMPETENCY_LABELS).map(([key, label]) => {
              const active = filters.competencies?.includes(key);
              return (
                <button key={key} onClick={() => handleToggleCompetency(key)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${active ? 'bg-purple-600 border-purple-500 text-white' : 'bg-muted border-border text-muted-foreground hover:text-foreground'}`}>
                  {label}
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="flex gap-1.5 ml-auto">
        <Button onClick={() => loadReportsData(filters)} size="sm"
          className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3">
          Aplicar
        </Button>
        <Button onClick={handleClearFilters} variant="ghost" size="sm"
          className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2">
          Limpiar
        </Button>
      </div>
    </div>
  );

  const tabs: Array<{ id: ActiveTab; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'resumen',      label: 'Resumen',       icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: 'competencias', label: 'Competencias',  icon: <Brain className="h-3.5 w-3.5" /> },
    { id: 'estudiantes',  label: 'Estudiantes',   icon: <Users className="h-3.5 w-3.5" /> },
  ];

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="h-7 w-7 animate-spin mx-auto text-blue-500" />
            <p className="text-muted-foreground text-sm">Cargando reportes...</p>
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
            <h1 className="text-xl font-bold text-foreground">Reportes y Análisis</h1>
            <p className="text-muted-foreground text-xs">Rendimiento académico · Competencias · Tendencias</p>
          </div>
          <Button
            onClick={() => loadReportsData()}
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8 p-0"
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* ── Tab Navigation ── */}
        <div className="flex gap-1.5 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors relative',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold',
                  activeTab === tab.id
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-red-500 text-white'
                )}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════
            TAB 1: RESUMEN
        ════════════════════════════════════════════════════ */}
        {activeTab === 'resumen' && (
          <div className="space-y-3">
            <TabFilters variant="levels" />

            {/* KPIs */}
            {dashboardData && (() => {
              const dist = dashboardData.performanceDistribution;
              const totalInDist = (dist.excellent ?? 0) + (dist.good ?? 0) + (dist.acceptable ?? 0) + (dist.needsImprovement ?? 0);
              const highCount = (dist.excellent ?? 0) + (dist.good ?? 0);
              const highRate = totalInDist > 0 ? Math.round(highCount / totalInDist * 100) : 0;
              const avgMin = studentData?.timeAnalysis?.averageDuration ?? null;
              return (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {[
                  { label: 'Estudiantes',  value: dashboardData.overview.totalStudents,           sub: `${totalInDist} evaluados`,                    icon: Users,    color: 'text-blue-400',    tooltip: 'Total de estudiantes registrados en el sistema. Entre paréntesis, los que han completado al menos un examen.' },
                  { label: 'Promedio',     value: dashboardData.overview.averageScore.toFixed(1), sub: 'sobre 100',                                   icon: Award,    color: 'text-amber-400',   tooltip: 'Promedio general de todos los exámenes completados, expresado sobre 100 puntos.' },
                  { label: 'Evaluaciones', value: dashboardData.overview.totalExams,              sub: 'completadas',                                 icon: FileText, color: 'text-emerald-400', tooltip: 'Cantidad total de exámenes completados y calificados en el período seleccionado.' },
                  { label: 'Rend. alto',   value: totalInDist > 0 ? `${highRate}%` : '—',         sub: totalInDist > 0 ? `${highCount} de ${totalInDist} (excelente/bueno)` : 'sin datos', icon: Target, color: highRate >= 60 ? 'text-emerald-400' : highRate >= 30 ? 'text-amber-400' : 'text-red-400', tooltip: 'Porcentaje de exámenes con resultado Excelente (≥85%) o Bueno (70–84%). Indica qué proporción del total tuvo buen desempeño.' },
                  { label: 'Tiempo prom.', value: avgMin !== null && avgMin > 0 ? `${avgMin} min` : '—', sub: 'por evaluación',                       icon: Clock,    color: 'text-indigo-400',  tooltip: 'Tiempo promedio que los estudiantes tardan en completar un examen, en minutos.' },
                ].map(({ label, value, sub, icon: Icon, color, tooltip }) => (
                  <Card key={label} title={tooltip} className="bg-card border-border shadow-none cursor-default">
                    <div className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
                          <p className={`text-xs ${color}`}>{sub}</p>
                        </div>
                        <Icon className={`h-6 w-6 ${color} opacity-60`} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              );
            })()}

            {/* Distribución + Tendencias */}
            {dashboardData && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

                {/* Distribución de Rendimiento */}
                <Card className="bg-card border-border shadow-none">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      Distribución de Rendimiento
                    </div>
                    <SectionToggle view={viewDistribution} onChange={setViewDistribution} />
                  </div>
                  <div className="p-4 pb-3">
                    {viewDistribution === 'chart' ? (
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={performanceChartData} margin={{ top: 4, right: 4, bottom: 4, left: -24 }}>
                          <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip cursor={{ fill: 'rgba(128,128,128,0.08)' }} contentStyle={TOOLTIP_STYLE}
                            formatter={(v: number) => [`${v}%`, 'Porcentaje']} />
                          <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                            {performanceChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[180px] overflow-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-1.5 text-muted-foreground font-medium">Categoría</th>
                              <th className="text-right py-1.5 text-muted-foreground font-medium">Rango</th>
                              <th className="text-right py-1.5 text-muted-foreground font-medium">%</th>
                              <th className="text-right py-1.5 text-muted-foreground font-medium">Alumnos</th>
                            </tr>
                          </thead>
                          <tbody>
                            {performanceChartData.map(row => (
                              <tr key={row.name} className="border-b border-border/50">
                                <td className="py-1.5 text-foreground">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.fill }} />
                                    {row.name}
                                  </span>
                                </td>
                                <td className="py-1.5 text-right text-muted-foreground">{row.range}</td>
                                <td className="py-1.5 text-right font-medium text-foreground">{row.value}%</td>
                                <td className="py-1.5 text-right text-muted-foreground">{row.count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </Card>

                {/* Tendencias */}
                <Card className="bg-card border-border shadow-none">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      Tendencias
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="flex gap-0.5 bg-muted rounded p-0.5">
                        {([
                          ['week',    'Sem',  'Agrupa los resultados por semana (ej. 2026-W07)'],
                          ['month',   'Mes',  'Agrupa los resultados por mes (ej. 2026-02)'],
                          ['quarter', 'Trim', 'Agrupa los resultados por trimestre (ej. 2026-Q1 = enero–marzo)'],
                        ] as const).map(([p, lbl, tip]) => (
                          <button
                            key={p}
                            title={tip}
                            onClick={() => handlePeriodChange(p)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                              trendPeriod === p ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                            }`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                      <SectionToggle view={viewTrends} onChange={setViewTrends} />
                    </div>
                  </div>
                  <div className="p-4 pb-3">
                    {viewTrends === 'chart' ? (
                      <TrendChart data={trendsData?.trends ?? []} height={220} />
                    ) : (
                      <div className="h-[180px] overflow-auto">
                        {(() => {
                          const rows = trendsData?.trends.filter(r => r.studentsEvaluated > 0) ?? [];
                          return rows.length > 0 ? (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="text-left py-1.5 text-muted-foreground font-medium">Período</th>
                                  <th className="text-right py-1.5 text-muted-foreground font-medium">Promedio</th>
                                  <th className="text-right py-1.5 text-muted-foreground font-medium">Evaluados</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((row, i) => (
                                  <tr key={i} className="border-b border-border/50">
                                    <td className="py-1.5 text-foreground">{row.period}</td>
                                    <td className="py-1.5 text-right">
                                      <span className={`font-medium ${getPerformanceColor(row.averageScore).split(' ')[0]}`}>
                                        {row.averageScore.toFixed(1)}
                                      </span>
                                    </td>
                                    <td className="py-1.5 text-right text-muted-foreground">{row.studentsEvaluated}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                              Sin datos de tendencias en el período seleccionado
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* Áreas de Mejora + Recomendaciones */}
            {dashboardData && (
              <Card className="bg-card border-border shadow-none">
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p title="Competencias donde el promedio general está por debajo del 70%. Son las áreas donde el instituto debe reforzar más." className="text-xs font-semibold text-red-400 mb-2 flex items-center gap-1.5 cursor-default">
                        <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                        Áreas de Mejora
                        {competencyData && (
                          <span className="ml-auto text-[10px] text-muted-foreground font-normal">
                            puntaje &lt;70%
                          </span>
                        )}
                      </p>
                      <div className="space-y-1.5">
                        {(() => {
                          // Solo mostrar áreas con datos reales (studentsEvaluated > 0 y score < 70)
                          const realAreas = dashboardData.improvementAreas.filter(area => {
                            const compData = competencyData?.competencyBreakdown?.[area];
                            return compData ? compData.studentsEvaluated > 0 : false;
                          });
                          if (realAreas.length === 0) {
                            return <p className="text-xs text-muted-foreground italic">Sin áreas críticas identificadas</p>;
                          }
                          return realAreas.map((area, i) => {
                            const compData = competencyData?.competencyBreakdown?.[area];
                            const label = COMPETENCY_LABELS[area] ?? area;
                            return (
                              <div key={i} className="flex items-center gap-1.5 p-1.5 rounded border border-red-500/20 bg-red-500/5">
                                <span className="text-red-500 text-xs shrink-0">↓</span>
                                <span className="text-xs text-foreground/80 flex-1">{label}</span>
                                {compData && (
                                  <span className="text-[10px] text-red-400 font-medium">
                                    {compData.averageScore.toFixed(1)}%
                                  </span>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                    <div>
                      <p title="Sugerencias generadas automáticamente basadas en los resultados del período. Ayudan a identificar acciones concretas para mejorar el rendimiento." className="text-xs font-semibold text-blue-400 mb-2 flex items-center gap-1.5 cursor-default">
                        <span className="inline-block w-2 h-2 rounded-full bg-blue-400" />
                        Recomendaciones
                      </p>
                      <div className="space-y-1.5">
                        {dashboardData.recommendations.length > 0 ? dashboardData.recommendations.map((rec, i) => (
                          <div key={i} className="flex items-start gap-1.5 p-1.5 rounded border border-blue-500/20 bg-blue-500/5">
                            <span className="text-blue-400 text-xs font-bold mt-0.5 shrink-0">{i + 1}.</span>
                            <span className="text-xs text-foreground/80 leading-snug">{rec}</span>
                          </div>
                        )) : (
                          <p className="text-xs text-muted-foreground italic">Sin recomendaciones</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Semáforo de Niveles MCER */}
            {dashboardData && (
              <Card className="bg-card border-border shadow-none">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 text-sm font-medium text-foreground">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span title="Cuántos alumnos distintos han rendido exámenes en cada nivel MCER (A1=básico → C2=maestría). Un alumno cuenta una vez por nivel aunque haya dado múltiples exámenes en ese nivel.">Distribución por Nivel MCER</span>
                </div>
                <div className="p-4 pb-3">
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {MCER_LEVELS.map((level, i) => {
                      const raw = dashboardData.levelDistribution[level];
                      const val = raw as any;
                      const count: number = raw == null ? 0 : typeof val === 'number' ? val : (val?.count ?? 0);
                      const hasData = count > 0;
                      return (
                        <div key={level} className={cn(
                          'flex flex-col items-center justify-center gap-1 p-3 rounded-lg border text-center',
                          hasData ? 'border-blue-500/20 bg-blue-500/5' : 'border-border bg-muted/30'
                        )}>
                          <span className="text-sm font-bold px-2 py-0.5 rounded"
                            style={{ backgroundColor: hasData ? LEVEL_COLORS[i] + '22' : undefined, color: hasData ? LEVEL_COLORS[i] : undefined }}>
                            {level}
                          </span>
                          {hasData ? (
                            <>
                              <span className="text-xl font-bold text-foreground leading-none">{count}</span>
                              <span className="text-[10px] text-muted-foreground">evaluados</span>
                            </>
                          ) : (
                            <>
                              <span className="text-lg font-bold text-muted-foreground/40">—</span>
                              <span className="text-[10px] text-muted-foreground/60">Sin datos</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            TAB 2: COMPETENCIAS
        ════════════════════════════════════════════════════ */}
        {activeTab === 'competencias' && (
          <div className="space-y-3">

            {/* Filter + Export */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <TabFilters variant="competencies" />
              </div>
              <Button
                onClick={() => handleOpenExportModal('competency')}
                size="sm"
                variant="outline"
                className="border-border text-foreground/80 bg-muted hover:bg-muted text-xs h-8 shrink-0"
              >
                <Download className="h-3 w-3 mr-1.5" />
                Exportar
              </Button>
            </div>

            {/* Competency Ranking Chart + Table */}
            {dashboardData && (
              <Card className="bg-card border-border shadow-none">
                <div className="px-4 py-2.5 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Brain className="h-4 w-4 text-muted-foreground" />
                      Promedio por Competencia
                    </div>
                    <SectionToggle view={viewCompetency} onChange={setViewCompetency} />
                  </div>
                  {/* Resumen rápido de competencias con datos */}
                  {competencyData?.competencyBreakdown && (
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      {Object.entries(competencyData.competencyBreakdown)
                        .filter(([, d]) => d.studentsEvaluated > 0)
                        .sort(([, a], [, b]) => b.averageScore - a.averageScore)
                        .map(([comp, d]) => (
                          <span key={comp} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                            d.averageScore >= 70
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : d.averageScore >= 50
                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                              : 'bg-red-500/10 border-red-500/20 text-red-400'
                          }`}>
                            {COMPETENCY_LABELS[comp] ?? comp} {d.averageScore.toFixed(0)}%
                          </span>
                        ))}
                    </div>
                  )}
                </div>
                <div className="p-4 pb-3">
                  {viewCompetency === 'chart' ? (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart
                          data={dashboardData.competencyRanking.map(c => ({
                            name: c.competency.charAt(0).toUpperCase() + c.competency.slice(1),
                            promedio: c.averageScore,
                          }))}
                          margin={{ top: 4, right: 4, bottom: 4, left: -24 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(128,128,128,0.08)' }}
                            formatter={(v: number) => [`${v.toFixed(1)}`, 'Promedio']} />
                          <Bar dataKey="promedio" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="grid grid-cols-2 gap-1.5 mt-2">
                        {dashboardData.competencyRanking.map(c => (
                          <div key={c.competency} className="flex items-center justify-between px-2 py-1 rounded bg-muted/40 border border-border">
                            <span className="text-xs text-foreground/80 capitalize">{c.competency.replace('_', ' ')}</span>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] px-1 rounded ${getDifficultyColor(c.difficulty)}`}>{getDifficultyLabel(c.difficulty)}</span>
                              <span className={`text-xs font-medium ${getPerformanceColor(c.averageScore).split(' ')[0]}`}>
                                {c.averageScore.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="overflow-auto max-h-[300px]">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-card">
                          <tr className="border-b border-border">
                            <th className="text-left py-1.5 text-muted-foreground font-medium">Competencia</th>
                            <th className="text-right py-1.5 text-muted-foreground font-medium">Promedio</th>
                            <th title="Nivel de dominio basado en el promedio: Alto ≥75%, Medio 50–74%, Bajo <50%" className="text-right py-1.5 text-muted-foreground font-medium cursor-default">Dominio</th>
                            <th className="text-right py-1.5 text-muted-foreground font-medium">Evaluados</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(competencyData
                            ? Object.entries(competencyData.competencyBreakdown)
                            : dashboardData.competencyRanking.map(c => [c.competency, c] as [string, typeof c])
                          ).map(([comp, data]) => {
                            const score = (data as any).averageScore ?? 0;
                            const evaluated = (data as any).studentsEvaluated ?? (data as any).studentsEvaluated ?? 0;
                            const dominio = score >= 75 ? { label: 'Alto', cls: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' }
                              : score >= 50 ? { label: 'Medio', cls: 'text-amber-400 bg-amber-500/10 border border-amber-500/20' }
                              : { label: 'Bajo', cls: 'text-red-400 bg-red-500/10 border border-red-500/20' };
                            return (
                              <tr key={comp} className={`border-b border-border/50 ${evaluated === 0 ? 'opacity-40' : ''}`}>
                                <td className="py-1.5 text-foreground font-medium">
                                  {COMPETENCY_LABELS[comp] ?? comp}
                                  {evaluated === 0 && <span className="ml-1.5 text-[10px] text-muted-foreground">(sin datos)</span>}
                                </td>
                                <td className="py-1.5 text-right">
                                  {evaluated > 0
                                    ? <span className={`font-medium ${getPerformanceColor(score).split(' ')[0]}`}>{score.toFixed(1)}</span>
                                    : <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className="py-1.5 text-right">
                                  {evaluated > 0
                                    ? <span className={`text-[10px] px-1.5 py-0.5 rounded ${dominio.cls}`}>{dominio.label}</span>
                                    : <span className="text-muted-foreground">—</span>}
                                </td>
                                <td className="py-1.5 text-right text-muted-foreground">{evaluated > 0 ? evaluated : '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Card>
            )}

          </div>
        )}

        {/* ════════════════════════════════════════════════════
            TAB 3: ESTUDIANTES
        ════════════════════════════════════════════════════ */}
        {activeTab === 'estudiantes' && (
          <div className="space-y-3">

            {/* Filter + Export */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <TabFilters variant="levels" />
              </div>
              <Button
                onClick={() => handleOpenExportModal('students')}
                size="sm"
                className="bg-blue-700 hover:bg-blue-600 text-white text-xs h-8 shrink-0"
              >
                <Download className="h-3 w-3 mr-1.5" />
                Exportar
              </Button>
            </div>

            {/* Distribución MCER — compacta */}
            {dashboardData && levelChartData.length > 0 && (
              <Card className="bg-card border-border shadow-none">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    Distribución por Nivel MCER
                  </div>
                  <SectionToggle view={viewLevels} onChange={setViewLevels} />
                </div>
                <div className="p-4 pb-3">
                  {viewLevels === 'chart' ? (
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={levelChartData} layout="vertical" margin={{ top: 2, right: 16, bottom: 2, left: 8 }}>
                        <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="level" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={24} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(128,128,128,0.08)' }}
                          formatter={(v: number) => [`${v}`, 'Estudiantes']} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {levelChartData.map((_, i) => <Cell key={i} fill={LEVEL_COLORS[i % LEVEL_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex gap-2 flex-wrap py-1">
                      {levelChartData.map(({ level, count }, i) => {
                        const total = levelChartData.reduce((s, r) => s + r.count, 0);
                        const pct = total > 0 ? (count / total * 100).toFixed(0) : '0';
                        return (
                          <div key={level} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-muted/30">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: LEVEL_COLORS[i % LEVEL_COLORS.length] }} />
                            <span className="text-xs font-medium text-foreground">{level}</span>
                            <span className="text-xs font-bold text-foreground">{count}</span>
                            <span className="text-[10px] text-muted-foreground">({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Lista de estudiantes */}
            <Card className="bg-card border-border shadow-none">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Estudiantes
                  {studentListTotal > 0 && (
                    <span className="text-[10px] text-muted-foreground font-normal">({studentListTotal} en total)</span>
                  )}
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={studentListSearch}
                    onChange={e => handleStudentSearch(e.target.value)}
                    className="h-7 pl-6 pr-2 text-xs bg-muted/60 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-44"
                  />
                </div>
              </div>
              <div className="p-4 pb-3">
                {studentListLoading ? (
                  <div className="h-40 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : studentList.length === 0 ? (
                  <div className="h-40 flex items-center justify-center text-muted-foreground text-xs">
                    {studentListSearch ? 'Sin resultados para la búsqueda' : 'Sin estudiantes con exámenes completados'}
                  </div>
                ) : (
                  <>
                    <div className="overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-card">
                          <tr className="border-b border-border">
                            <th className="text-left py-1.5 text-muted-foreground font-medium">Estudiante</th>
                            <th className="text-center py-1.5 text-muted-foreground font-medium">Nivel</th>
                            <th className="text-right py-1.5 text-muted-foreground font-medium">Promedio</th>
                            <th className="text-right py-1.5 text-muted-foreground font-medium">Exámenes</th>
                            <th className="text-right py-1.5 text-muted-foreground font-medium">Último</th>
                            <th className="text-center py-1.5 text-muted-foreground font-medium">Tendencia</th>
                            <th className="py-1.5" />
                          </tr>
                        </thead>
                        <tbody>
                          {studentList.map(student => (
                            <tr key={student.candidateId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                              <td className="py-2">
                                <div>
                                  <p className="text-foreground font-medium leading-tight">{student.name || '—'}</p>
                                  {student.email && <p className="text-muted-foreground text-[10px]">{student.email}</p>}
                                </div>
                              </td>
                              <td className="py-2 text-center">
                                {student.currentLevel !== 'N/A' ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                                    {student.currentLevel}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="py-2 text-right">
                                {Number.isFinite(student.averageScore) ? (
                                  <span className={`font-semibold ${getPerformanceColor(student.averageScore).split(' ')[0]}`}>
                                    {student.averageScore.toFixed(1)}
                                  </span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </td>
                              <td className="py-2 text-right text-muted-foreground">{student.examCount}</td>
                              <td className="py-2 text-right text-muted-foreground">
                                {student.lastExamDate
                                  ? new Date(student.lastExamDate).toLocaleDateString('es-BO', { day: '2-digit', month: 'short' })
                                  : '—'}
                              </td>
                              <td className="py-2 text-center">
                                {student.trend === 'improving'
                                  ? <TrendingUp className="h-3.5 w-3.5 text-emerald-400 mx-auto" />
                                  : student.trend === 'declining'
                                  ? <TrendingDown className="h-3.5 w-3.5 text-red-400 mx-auto" />
                                  : <span className="text-muted-foreground text-[10px]">—</span>}
                              </td>
                              <td className="py-2">
                                <button
                                  onClick={() => navigate(`/student-history/${student.candidateId}`)}
                                  className="flex items-center gap-1 text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Ver
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Paginación */}
                    {studentListTotalPages > 1 && (
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                        <span className="text-[10px] text-muted-foreground">
                          Página {studentListPage} de {studentListTotalPages}
                        </span>
                        <div className="flex gap-1">
                          <button
                            disabled={studentListPage <= 1}
                            onClick={() => loadStudentList(studentListPage - 1, studentListSearch)}
                            className="h-6 w-6 flex items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </button>
                          <button
                            disabled={studentListPage >= studentListTotalPages}
                            onClick={() => loadStudentList(studentListPage + 1, studentListSearch)}
                            className="h-6 w-6 flex items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            TAB 4: ÁREAS CRÍTICAS — eliminado, contenido movido a Resumen
        ════════════════════════════════════════════════════ */}
        {false && activeTab === 'criticas' && (
          <div className="space-y-3">
            <TabFilters variant="competencies" />

            {/* A) Semáforo de Niveles */}
            {dashboardData && (
              <Card className="bg-card border-border shadow-none">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Semáforo de Niveles MCER
                  </div>
                </div>
                <div className="p-4 pb-3">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                    {MCER_LEVELS.map((level, i) => {
                      const raw = dashboardData.levelDistribution[level];
                      const val = raw as any;
                      const count: number = raw == null ? 0 : typeof val === 'number' ? val : (val?.count ?? 0);
                      const hasData = count > 0;
                      return (
                        <div
                          key={level}
                          className={cn(
                            'flex flex-col items-center justify-center gap-1 p-3 rounded-lg border text-center',
                            hasData
                              ? 'border-blue-500/20 bg-blue-500/5'
                              : 'border-border bg-muted/30'
                          )}
                        >
                          <span
                            className="text-sm font-bold px-2 py-0.5 rounded"
                            style={{ backgroundColor: hasData ? LEVEL_COLORS[i] + '22' : undefined, color: hasData ? LEVEL_COLORS[i] : undefined }}
                          >
                            {level}
                          </span>
                          {hasData ? (
                            <>
                              <span className="text-xl font-bold text-foreground leading-none">{count}</span>
                              <span className="text-[10px] text-muted-foreground">evaluados</span>
                            </>
                          ) : (
                            <>
                              <span className="text-lg font-bold text-muted-foreground/40">—</span>
                              <span className="text-[10px] text-muted-foreground/60">Sin datos</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>
            )}

            {/* B) Competencias en Riesgo */}
            <Card className="bg-card border-border shadow-none">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  Competencias en Riesgo
                  {competenciesAtRisk.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 font-normal">
                      {competenciesAtRisk.length} bajo 70%
                    </span>
                  )}
                </div>
                <SectionToggle view={viewCriticalComp} onChange={setViewCriticalComp} />
              </div>
              <div className="p-4 pb-3">
                {competenciesAtRisk.length === 0 ? (
                  <div className="h-[180px] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <span className="text-2xl">✓</span>
                    <p className="text-xs">Todas las competencias superan el 70%</p>
                  </div>
                ) : viewCriticalComp === 'chart' ? (
                  <div className="relative">
                    <ResponsiveContainer width="100%" height={Math.max(160, competenciesAtRisk.length * 40)}>
                      <BarChart
                        data={competenciesAtRisk.map(c => ({
                          name: c.comp.charAt(0).toUpperCase() + c.comp.slice(1),
                          promedio: c.averageScore,
                          fill: c.averageScore < 60 ? '#ef4444' : '#f59e0b',
                        }))}
                        layout="vertical"
                        margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
                      >
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={64} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(128,128,128,0.08)' }}
                          formatter={(v: number) => [`${v.toFixed(1)}`, 'Promedio']} />
                        <ReferenceLine x={60} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1.5}
                          label={{ value: '60', position: 'top', fontSize: 9, fill: '#ef4444' }} />
                        <ReferenceLine x={70} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1.5}
                          label={{ value: '70', position: 'top', fontSize: 9, fill: '#f59e0b' }} />
                        <Bar dataKey="promedio" radius={[0, 4, 4, 0]}>
                          {competenciesAtRisk.map((c, i) => (
                            <Cell key={i} fill={c.averageScore < 60 ? '#ef4444' : '#f59e0b'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground justify-end">
                      <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-red-500 inline-block" /> Crítico (&lt;60)</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-500 inline-block" /> En riesgo (&lt;70)</span>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-auto max-h-[260px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b border-border">
                          <th className="text-left py-1.5 text-muted-foreground font-medium">Competencia</th>
                          <th className="text-right py-1.5 text-muted-foreground font-medium">Promedio</th>
                          <th className="text-right py-1.5 text-muted-foreground font-medium">Evaluados</th>
                          <th title="Nivel de dominio basado en el promedio: Alto ≥75%, Medio 50–74%, Bajo <50%" className="text-right py-1.5 text-muted-foreground font-medium cursor-default">Dominio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {competenciesAtRisk.map(c => {
                          const dominio = c.averageScore >= 75
                            ? { label: 'Alto', cls: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' }
                            : c.averageScore >= 50
                            ? { label: 'Medio', cls: 'text-amber-400 bg-amber-500/10 border border-amber-500/20' }
                            : { label: 'Bajo', cls: 'text-red-400 bg-red-500/10 border border-red-500/20' };
                          return (
                            <tr key={c.comp} className="border-b border-border/50">
                              <td className="py-1.5 text-foreground capitalize">{COMPETENCY_LABELS[c.comp] ?? c.comp.replace('_', ' ')}</td>
                              <td className="py-1.5 text-right">
                                <span className={`font-semibold ${c.averageScore < 60 ? 'text-red-400' : 'text-amber-400'}`}>
                                  {c.averageScore.toFixed(1)}
                                </span>
                              </td>
                              <td className="py-1.5 text-right text-muted-foreground">{c.studentsEvaluated}</td>
                              <td className="py-1.5 text-right">
                                <span className={`text-[10px] px-1 rounded ${dominio.cls}`}>
                                  {dominio.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>

            {/* C) Estudiantes en Riesgo */}
            <Card className="bg-card border-border shadow-none">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  Estudiantes en Riesgo
                </div>
              </div>
              <div className="p-4">
                {studentData ? (() => {
                  const dist = studentData.performanceDistribution;
                  const total = (dist.excellent ?? 0) + (dist.good ?? 0) + (dist.acceptable ?? 0) + (dist.needsImprovement ?? 0);
                  const pct = (n: number) => total > 0 ? Math.round((n ?? 0) / total * 100) : 0;
                  return (
                  <div className="space-y-3">
                    {/* Big number */}
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border border-red-500/30 bg-red-500/5 shrink-0">
                        <span className="text-3xl font-bold text-red-400 leading-none">
                          {dist.needsImprovement ?? 0}
                        </span>
                        <span className="text-[9px] text-red-400/70 text-center leading-tight mt-0.5">necesitan<br/>mejorar</span>
                      </div>
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Excelente</span>
                          <span className="text-emerald-400 font-medium">{dist.excellent ?? 0} ({pct(dist.excellent ?? 0)}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct(dist.excellent ?? 0)}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Bueno</span>
                          <span className="text-blue-400 font-medium">{dist.good ?? 0} ({pct(dist.good ?? 0)}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct(dist.good ?? 0)}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Satisfactorio</span>
                          <span className="text-amber-400 font-medium">{dist.acceptable ?? 0} ({pct(dist.acceptable ?? 0)}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${pct(dist.acceptable ?? 0)}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Necesita Mejorar</span>
                          <span className="text-red-400 font-medium">{dist.needsImprovement ?? 0} ({pct(dist.needsImprovement ?? 0)}%)</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-red-500" style={{ width: `${pct(dist.needsImprovement ?? 0)}%` }} />
                        </div>
                      </div>
                    </div>

                    {/* Struggling students list */}
                    {strugglingStudents && strugglingStudents.length > 0 ? (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Estudiantes identificados</p>
                        {strugglingStudents.map((student, index) => (
                          <div key={student.studentId + index}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-5 h-5 rounded-full flex items-center justify-center bg-red-500/20 border border-red-500/30 shrink-0">
                                <span className="text-red-400 text-[9px] font-bold">{index + 1}</span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-foreground text-xs font-medium leading-tight truncate">{student.studentName}</p>
                                {student.weakCompetencies && student.weakCompetencies.length > 0 && (
                                  <div className="flex gap-1 mt-0.5 flex-wrap">
                                    {student.weakCompetencies.slice(0, 3).map(comp => (
                                      <span key={comp} className="text-[9px] px-1 rounded bg-red-500/10 border border-red-500/20 text-red-400">
                                        {comp}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold shrink-0 ml-2 ${getPerformanceColor(student.averageScore)}`}>
                              {student.averageScore.toFixed(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic pt-1">
                        {(dist.needsImprovement ?? 0) > 0
                          ? `${dist.needsImprovement} estudiante(s) necesitan mejora — sin detalle individual disponible`
                          : 'Sin estudiantes en riesgo identificados'
                        }
                      </p>
                    )}
                  </div>
                  );
                })() : (
                  <div className="h-[120px] flex items-center justify-center text-muted-foreground text-xs">
                    Sin datos de estudiantes
                  </div>
                )}
              </div>
            </Card>

            {/* D) Ranking por Competencia */}
            {competencyBreakdownSorted.length > 0 && (
              <Card className="bg-card border-border shadow-none">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    Ranking por Competencia
                  </div>
                </div>
                <div className="p-4 pb-3">
                  <div className="overflow-auto max-h-[300px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b border-border">
                          <th className="text-left py-1.5 text-muted-foreground font-medium">Competencia</th>
                          <th className="text-right py-1.5 text-muted-foreground font-medium">Promedio</th>
                          <th title="Nivel de dominio basado en el promedio: Alto ≥75%, Medio 50–74%, Bajo <50%" className="text-right py-1.5 text-muted-foreground font-medium cursor-default">Dominio</th>
                          <th className="text-right py-1.5 text-muted-foreground font-medium">Evaluados</th>
                        </tr>
                      </thead>
                      <tbody>
                        {competencyBreakdownSorted.map(c => {
                          const dominio = c.averageScore >= 75
                            ? { label: 'Alto', cls: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' }
                            : c.averageScore >= 50
                            ? { label: 'Medio', cls: 'text-amber-400 bg-amber-500/10 border border-amber-500/20' }
                            : { label: 'Bajo', cls: 'text-red-400 bg-red-500/10 border border-red-500/20' };
                          return (
                            <tr key={c.comp} className="border-b border-border/50">
                              <td className="py-1.5 text-foreground capitalize">{COMPETENCY_LABELS[c.comp] ?? c.comp.replace('_', ' ')}</td>
                              <td className="py-1.5 text-right">
                                <span className={`font-semibold ${getPerformanceColor(c.averageScore).split(' ')[0]}`}>
                                  {c.averageScore.toFixed(1)}
                                </span>
                              </td>
                              <td className="py-1.5 text-right">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded ${dominio.cls}`}>
                                  {dominio.label}
                                </span>
                              </td>
                              <td className="py-1.5 text-right text-muted-foreground">{c.studentsEvaluated}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            )}
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
