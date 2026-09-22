import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { MainLayout } from '@/components/layout';
import {
  reportsService,
  type StudentHistoryData,
  type ExportOptions
} from '@/services/reportsService';
import { candidateService, type Candidate } from '@/services/candidateService';
import ExportOptionsModal from '@/components/modals/ExportOptionsModal';
import { UserAvatar } from '@/components/atoms/UserAvatar';
import CustomizableTable from '@/components/common/CustomizableTable';
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
} from '@tanstack/react-table';
import {
  Award, BookOpen, Calendar, CheckCircle, ChevronLeft, ChevronRight, Clock,
  Download, Eye, Loader2, MessageSquare, Minus, Search, Star, Target,
  TrendingDown, TrendingUp, User, X, AlertTriangle,
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useNavigate, useParams } from 'react-router-dom';
import { authSDK } from '@/services/sdk-simple-auth';

const EXAM_API = import.meta.env.VITE_EXAM_SERVICE_URL || 'http://localhost:3002';

type ExamEntry = StudentHistoryData['examHistory'][number];

const StudentHistoryScreen: React.FC = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [selectedExam, setSelectedExam] = useState<ExamEntry | null>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Candidate[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [historyData, setHistoryData] = useState<StudentHistoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [examPage, setExamPage] = useState(1);
  const [examSearch, setExamSearch] = useState('');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterResult, setFilterResult] = useState<'all' | 'passed' | 'failed'>('all');
  const [showTop, setShowTop] = useState(false);
  const [topCount, setTopCount] = useState(5);
  const EXAM_PAGE_SIZE = 5;
  const MCER_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

  const runSearch = async (value: string) => {
    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    try {
      setSearchLoading(true);
      const res = await candidateService.searchCandidates(value.trim());
      const candidates = Array.isArray((res.data as any)?.results) ? (res.data as any).results : [];
      setSearchResults(candidates);
      setShowDropdown(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 350);
  };

  const handleSearchClick = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    runSearch(query);
  };

  const handleSelectCandidate = async (candidate: Candidate) => {
    setSelectedCandidate(candidate);
    setShowDropdown(false);
    setQuery('');
    setSearchResults([]);
    await loadHistory(candidate._id);
  };

  const openExamDetail = async (exam: ExamEntry) => {
    setSelectedExam(exam);
    setDetailData(null);
    if (!exam.resultId) return;
    try {
      setDetailLoading(true);
      const res = await fetch(`${EXAM_API}/api/v1/exam-results/${exam.resultId}/admin`, {
        headers: { Authorization: `Bearer ${authSDK.getAccessToken()}` },
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setDetailData(json.data);
    } catch {
      toast.error('No se pudo cargar el detalle completo');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleClear = () => {
    setSelectedCandidate(null);
    setHistoryData(null);
    setQuery('');
  };

  const loadHistory = async (id: string) => {
    try {
      setLoading(true);
      setExamPage(1);
      setExamSearch('');
      const history = await reportsService.getStudentHistory(id);
      setHistoryData(history);
    } catch {
      toast.error('Error cargando el historial del estudiante');
      setHistoryData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'pdf', opts?: ExportOptions) => {
    if (!historyData) return;
    try {
      setExportLoading(true);
      await reportsService.exportReport('student-history', {}, format, historyData.studentId, opts);
      toast.success(`Exportado como ${format.toUpperCase()}`);
      setExportModalOpen(false);
    } catch {
      toast.error('Error exportando el historial');
    } finally {
      setExportLoading(false);
    }
  };

  React.useEffect(() => {
    if (studentId) loadHistory(studentId);
  }, [studentId]);

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('es-ES', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  const dur = (m: number) => {
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m % 60}m`;
  };

  const scoreColor = (p: number) =>
    p >= 80 ? 'text-emerald-600 dark:text-emerald-400'
    : p >= 60 ? 'text-blue-600 dark:text-blue-400'
    : p >= 40 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  const scoreBadge = (p: number) =>
    p >= 80
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/40'
      : p >= 60
      ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/40'
      : p >= 40
      ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/40'
      : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/40';

  const trendBadge = (t: 'improving' | 'stable' | 'declining') =>
    t === 'improving' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
    : t === 'declining' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    : 'bg-muted text-muted-foreground';

  const trendIcon = (t: 'improving' | 'stable' | 'declining') =>
    t === 'improving' ? <TrendingUp className="h-3 w-3" />
    : t === 'declining' ? <TrendingDown className="h-3 w-3" />
    : <Minus className="h-3 w-3" />;

  const [examSorting, setExamSorting] = useState<SortingState>([]);

  const columnHelper = createColumnHelper<ExamEntry>();

  const examColumns = useMemo(() => [
    columnHelper.accessor('examTitle', {
      header: 'Examen',
      size: 220,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="font-medium text-foreground text-xs leading-tight truncate">{row.original.examTitle}</p>
          <p className="text-[11px] text-muted-foreground truncate">{row.original.sessionName}</p>
        </div>
      ),
    }),
    columnHelper.accessor('completedAt', {
      header: 'Fecha',
      size: 110,
      cell: ({ getValue }) => (
        <span className="flex items-center gap-1 text-muted-foreground text-xs whitespace-nowrap">
          <Calendar className="h-3 w-3 shrink-0" />
          {fmt(getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('level', {
      header: 'Nivel',
      size: 60,
      cell: ({ getValue }) => (
        <span className="text-[10px] bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded-full font-mono">
          {getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('timeSpent', {
      header: 'Tiempo',
      size: 70,
      cell: ({ getValue }) => (
        <span className="flex items-center gap-1 text-muted-foreground text-xs">
          <Clock className="h-3 w-3 shrink-0" />
          {dur(getValue())}
        </span>
      ),
    }),
    columnHelper.accessor('percentage', {
      header: '%',
      size: 72,
      cell: ({ getValue }) => (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${scoreBadge(getValue())}`}>
          {getValue().toFixed(1)}%
        </span>
      ),
    }),
    columnHelper.display({
      id: 'actions',
      size: 36,
      header: '',
      cell: ({ row }) => (
        <button
          onClick={e => { e.stopPropagation(); openExamDetail(row.original); }}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <Eye className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-blue-500" />
        </button>
      ),
    }),
  ], []);

  const filteredExams = useMemo(() => {
    let list = historyData?.examHistory ?? [];
    if (examSearch.trim()) {
      const q = examSearch.toLowerCase();
      list = list.filter(e =>
        e.examTitle.toLowerCase().includes(q) ||
        e.sessionName.toLowerCase().includes(q) ||
        e.level.toLowerCase().includes(q)
      );
    }
    if (filterLevel !== 'all') list = list.filter(e => e.level === filterLevel);
    if (filterResult === 'passed') list = list.filter(e => e.percentage >= 60);
    if (filterResult === 'failed') list = list.filter(e => e.percentage < 60);
    if (showTop) list = [...list].sort((a, b) => b.percentage - a.percentage).slice(0, topCount);
    return list;
  }, [historyData, examSearch, filterLevel, filterResult, showTop, topCount]);

  const examTable = useReactTable({
    data: filteredExams,
    columns: examColumns,
    state: { sorting: examSorting },
    onSortingChange: setExamSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const initials = (name: string) =>
    name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

  const candName = (c: Candidate) =>
    `${c.personalInfo.firstName} ${c.personalInfo.lastName}`;

  const parseResponse = (raw: any) => {
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return raw; }
    }
    return raw;
  };

  const renderQuestionResponse = (qr: any): React.ReactNode => {
    const response = parseResponse(qr.response);
    const qd = qr.questionData;
    const options: any[] = qd?.options ?? [];
    const questionType: string = qr.questionType ?? qd?.questionType ?? '';

    if (response === null || response === undefined || response === '') {
      return <p className="text-xs text-muted-foreground italic">Sin respuesta registrada</p>;
    }

    switch (questionType) {
      case 'multiple_choice': {
        const selected: string[] = response?.selectedOptions ?? [];
        if (options.length > 0) {
          return (
            <div className="space-y-1.5">
              {options.map((opt: any) => {
                const isSelected = selected.includes(String(opt.id));
                const isCorrect = !!opt.isCorrect;
                let cls = 'border border-border bg-muted/40 text-muted-foreground';
                if (isSelected && isCorrect) cls = 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-300';
                else if (isSelected && !isCorrect) cls = 'border border-red-200 bg-red-50 text-red-700 dark:border-red-600/50 dark:bg-red-900/20 dark:text-red-300';
                else if (!isSelected && isCorrect) cls = 'border border-emerald-200/70 bg-emerald-50/60 text-emerald-600/70 dark:border-emerald-600/30 dark:bg-emerald-900/10 dark:text-emerald-400/60';
                return (
                  <div key={opt.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${cls}`}>
                    <span>{isSelected ? '●' : '○'}</span>
                    <span>{opt.text}</span>
                    {isCorrect && <span className="ml-auto text-emerald-600/70 dark:text-emerald-400/70">✓ correcta</span>}
                  </div>
                );
              })}
            </div>
          );
        }
        const sel: string[] = response?.selectedOptions ?? [];
        return <p className="text-xs text-foreground/80 bg-muted/40 px-3 py-2 rounded-lg">Opción(es): {sel.join(', ') || '—'}</p>;
      }

      case 'true_false': {
        const ans = response?.answer;
        const userTrue = ans === true || ans === 'true' || String(ans).toLowerCase() === 'verdadero';
        const userFalse = ans === false || ans === 'false' || String(ans).toLowerCase() === 'falso';
        const correctOpt = options.find((o: any) => o.isCorrect);
        const correctIsTrue = correctOpt?.id?.toLowerCase() === 'true' || correctOpt?.text?.toLowerCase() === 'true' || correctOpt?.text?.toLowerCase() === 'verdadero';
        return (
          <div className="flex gap-2">
            {['Verdadero', 'Falso'].map((label) => {
              const isThisTrue = label === 'Verdadero';
              const isSelected = isThisTrue ? userTrue : userFalse;
              const isCorrect = isThisTrue ? correctIsTrue : !correctIsTrue;
              let cls = 'border border-border bg-muted/40 text-muted-foreground';
              if (isSelected && isCorrect) cls = 'border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-600/50 dark:bg-emerald-900/20 dark:text-emerald-300 font-semibold';
              else if (isSelected && !isCorrect) cls = 'border border-red-200 bg-red-50 text-red-700 dark:border-red-600/50 dark:bg-red-900/20 dark:text-red-300 font-semibold';
              else if (!isSelected && isCorrect) cls = 'border border-emerald-200/70 bg-emerald-50/60 text-emerald-600/70 dark:border-emerald-600/30 dark:bg-emerald-900/10 dark:text-emerald-400/60';
              return (
                <div key={label} className={`px-4 py-2 rounded-lg text-xs ${cls}`}>{label}</div>
              );
            })}
          </div>
        );
      }

      case 'fill_blanks': {
        const blanks: string[] = response?.blanks ?? [];
        if (blanks.length === 0) return <p className="text-xs text-muted-foreground italic">Sin respuesta</p>;
        const correctBlanks: any[] = qd?.blanks ?? [];
        return (
          <div className="flex flex-wrap gap-2">
            {blanks.map((b: string, i: number) => {
              const correctAnswers: string[] = correctBlanks[i]?.correctAnswers ?? [];
              const isOk = correctAnswers.length > 0
                ? correctAnswers.some((c: string) => c.trim().toLowerCase() === b.trim().toLowerCase())
                : null;
              const cls = isOk === true
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-600/40 dark:text-emerald-300'
                : isOk === false
                ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-600/40 dark:text-red-300'
                : 'bg-muted/40 border-border text-foreground/80';
              return (
                <span key={i} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs ${cls}`}>
                  <span className="text-muted-foreground">[{i + 1}]</span>
                  <span className="font-medium">{b || '—'}</span>
                  {isOk === false && correctAnswers.length > 0 && (
                    <span className="text-emerald-600/70 dark:text-emerald-400/70 ml-1">✓ {correctAnswers[0]}</span>
                  )}
                </span>
              );
            })}
          </div>
        );
      }

      case 'essay':
      case 'open_text': {
        const text = typeof response === 'string' ? response : response?.text ?? response?.answer ?? response?.essay ?? '';
        return (
          <div className="bg-muted/40 border border-border rounded-lg px-3 py-2.5">
            <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{String(text) || 'Sin texto'}</p>
          </div>
        );
      }

      case 'audio_response':
      case 'speaking': {
        const rawUrl: string = response?.audioUrl ?? response?.url ?? '';
        const audioUrl = rawUrl.replace(/^https?:\/\/minio(:\d+)?/, 'http://localhost:9000');
        const transcription: string | undefined = response?.transcription ?? response?.text;
        if (!audioUrl && !transcription) return <p className="text-xs text-muted-foreground italic">Sin audio registrado</p>;
        return (
          <div className="space-y-2">
            {audioUrl && (
              <div className="bg-muted/40 border border-border rounded-lg p-2.5">
                <p className="text-xs text-muted-foreground mb-1.5">🔊 Audio del candidato</p>
                <audio controls className="w-full">
                  <source src={audioUrl} type="audio/webm" />
                  <source src={audioUrl} />
                </audio>
              </div>
            )}
            {transcription && (
              <div className="bg-muted/40 border border-border rounded-lg px-3 py-2">
                <p className="text-xs text-muted-foreground mb-1">Transcripción</p>
                <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">{transcription}</p>
              </div>
            )}
          </div>
        );
      }

      default: {
        const text = typeof response === 'string' ? response : JSON.stringify(response);
        return (
          <div className="bg-muted/40 rounded px-2.5 py-1.5">
            <p className="text-xs text-foreground/80 whitespace-pre-wrap">{text || '—'}</p>
          </div>
        );
      }
    }
  };

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-3 p-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="h-7 w-7 flex items-center justify-center rounded border border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Historial de Estudiante</h1>
              <p className="text-xs text-muted-foreground">Progreso académico individual</p>
            </div>
          </div>
          {historyData && (
            <Button onClick={() => setExportModalOpen(true)} size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs">
              <Download className="h-3 w-3 mr-1" />Exportar
            </Button>
          )}
        </div>

        {/* Search bar */}
        <div className="bg-card border border-border rounded-lg p-3">
          {selectedCandidate ? (
            <div className="flex items-center gap-2.5">
              <UserAvatar
                avatarUrl={selectedCandidate.avatarUrl}
                firstName={selectedCandidate.personalInfo.firstName}
                lastName={selectedCandidate.personalInfo.lastName}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{candName(selectedCandidate)}</p>
                <p className="text-xs text-muted-foreground truncate">{selectedCandidate.personalInfo.email}</p>
              </div>
              <span className="text-xs bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full font-mono shrink-0">
                {selectedCandidate.academicInfo.currentLevel}
              </span>
              <Button variant="ghost" size="sm" onClick={handleClear}
                className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Nombre o email del estudiante..."
                    value={query}
                    onChange={e => handleQueryChange(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    onKeyDown={e => e.key === 'Enter' && handleSearchClick()}
                    className="pl-8 h-8 text-sm"
                    autoComplete="off"
                  />
                </div>
                <Button onClick={handleSearchClick} disabled={searchLoading || query.trim().length < 2}
                  size="sm" className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white shrink-0">
                  {searchLoading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Search className="h-3.5 w-3.5" />}
                </Button>
              </div>

              {showDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                  {searchResults.slice(0, 7).map(c => (
                    <button key={c._id} onClick={() => handleSelectCandidate(c)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/60 transition-colors text-left border-b border-border/40 last:border-0">
                      <UserAvatar
                        avatarUrl={c.avatarUrl}
                        firstName={c.personalInfo.firstName}
                        lastName={c.personalInfo.lastName}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{candName(c)}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.personalInfo.email}</p>
                      </div>
                      <span className="text-xs bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded-full shrink-0">
                        {c.academicInfo.currentLevel}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {showDropdown && !searchLoading && query.length >= 2 && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 px-4 py-2.5">
                  <p className="text-xs text-muted-foreground text-center">Sin resultados</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400 mr-2" />
            <span className="text-sm text-muted-foreground">Cargando historial...</span>
          </div>
        )}

        {historyData && !loading && (
          <>
            {/* Summary stats — horizontal compact */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Exámenes', value: historyData.summary.totalExams, icon: BookOpen, bg: 'bg-blue-100 dark:bg-blue-900/30', ic: 'text-blue-600 dark:text-blue-400', tooltip: 'Cantidad total de exámenes completados por el alumno' },
                { label: 'Promedio', value: `${historyData.summary.averageScore.toFixed(1)}%`, icon: Award, bg: 'bg-emerald-100 dark:bg-emerald-900/30', ic: 'text-emerald-600 dark:text-emerald-400', tooltip: 'Promedio de todos los porcentajes obtenidos en los exámenes' },
                { label: 'Mejor nota', value: `${historyData.summary.bestScore.toFixed(1)}%`, icon: Star, bg: 'bg-amber-100 dark:bg-amber-900/30', ic: 'text-amber-600 dark:text-amber-400', tooltip: 'El porcentaje más alto obtenido en cualquier examen' },
              ].map(({ label, value, icon: Icon, bg, ic, tooltip }) => (
                <div key={label} title={tooltip} className="bg-card border border-border rounded-lg p-3 flex items-center gap-2.5 cursor-default">
                  <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                    <Icon className={`h-4 w-4 ${ic}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground leading-none">{label}</p>
                    <p className="text-lg font-bold text-foreground leading-tight">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Competency progress */}
            {Object.keys(historyData.competencyProgress).length > 0 && (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                  <h2 className="text-xs font-semibold text-foreground">Progreso por Competencia</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-px bg-border">
                  {Object.entries(historyData.competencyProgress).map(([comp, data]) => (
                    <div key={comp} className="bg-card px-3 py-2.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium text-foreground capitalize truncate">
                          {comp.replace('_', ' ')}
                        </span>
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-medium ${trendBadge(data.trend)}`}>
                          {trendIcon(data.trend)}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full ${
                          data.averageScore >= 80 ? 'bg-emerald-500'
                          : data.averageScore >= 60 ? 'bg-blue-500'
                          : data.averageScore >= 40 ? 'bg-amber-500' : 'bg-red-500'
                        }`} style={{ width: `${Math.min(data.averageScore, 100)}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{data.currentLevel} · {data.examsCount} ex.</span>
                        <span className={`font-semibold ${scoreColor(data.averageScore)}`}>
                          {data.averageScore.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Exam history table */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Header row */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <h2 className="text-xs font-semibold text-foreground shrink-0">Historial de Exámenes</h2>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-muted text-muted-foreground border border-border shrink-0">
                  {filteredExams.length}
                </span>
                <div className="relative flex-1 max-w-48 ml-auto">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={examSearch}
                    onChange={e => setExamSearch(e.target.value)}
                    className="w-full pl-6 pr-2 h-6 text-xs bg-muted/50 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-blue-500 focus:ring-0"
                  />
                </div>
              </div>
              {/* Filter bar */}
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/20">
                {/* Nivel */}
                <div className="flex items-center gap-1">
                  {['all', ...MCER_LEVELS].map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => setFilterLevel(lvl)}
                      className={`h-5 px-2 rounded text-[10px] font-medium transition-colors border ${
                        filterLevel === lvl
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-transparent text-muted-foreground border-border hover:border-blue-400 hover:text-foreground'
                      }`}
                    >
                      {lvl === 'all' ? 'Nivel' : lvl}
                    </button>
                  ))}
                </div>
                {/* Separador */}
                <div className="h-4 w-px bg-border" />
                {/* Resultado */}
                <div className="flex items-center gap-1">
                  {([['all', 'Todos'], ['passed', 'Aprobados ≥60'], ['failed', 'No aprobados']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setFilterResult(val)}
                      className={`h-5 px-2 rounded text-[10px] font-medium transition-colors border ${
                        filterResult === val
                          ? val === 'passed' ? 'bg-emerald-600 text-white border-emerald-600'
                            : val === 'failed' ? 'bg-red-600 text-white border-red-600'
                            : 'bg-blue-600 text-white border-blue-600'
                          : 'bg-transparent text-muted-foreground border-border hover:border-blue-400 hover:text-foreground'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {/* Separador */}
                <div className="h-4 w-px bg-border" />
                {/* Top N */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowTop(t => !t)}
                    title="Muestra solo los N mejores exámenes del alumno ordenados por porcentaje"
                    className={`h-5 px-2 rounded text-[10px] font-medium transition-colors border flex items-center gap-1 ${
                      showTop
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-transparent text-muted-foreground border-border hover:border-amber-400 hover:text-foreground'
                    }`}
                  >
                    ★ Top
                  </button>
                  {showTop && (
                    <input
                      type="number"
                      min={3}
                      max={20}
                      value={topCount}
                      onChange={e => {
                        const v = Math.min(20, Math.max(3, Number(e.target.value) || 3));
                        setTopCount(v);
                      }}
                      title="Mínimo 3, máximo 20"
                      className="w-10 h-5 text-center text-[10px] font-semibold bg-amber-500/10 border border-amber-500/40 rounded text-amber-600 dark:text-amber-400 focus:outline-none focus:border-amber-500"
                    />
                  )}
                </div>
                {/* Limpiar filtros */}
                {(filterLevel !== 'all' || filterResult !== 'all' || showTop) && (
                  <button
                    onClick={() => { setFilterLevel('all'); setFilterResult('all'); setShowTop(false); }}
                    className="h-5 px-2 rounded text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5 ml-auto"
                  >
                    <X className="h-2.5 w-2.5" /> Limpiar
                  </button>
                )}
              </div>
              <CustomizableTable
                table={examTable}
                isLoading={false}
                rows={5}
                noDataMessage="Sin exámenes registrados"
              />
            </div>

            {/* Recommendations */}
            {historyData.recommendations.length > 0 && (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                  <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  <h2 className="text-xs font-semibold text-foreground">Recomendaciones</h2>
                </div>
                <div className="p-3 space-y-1.5">
                  {historyData.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/15 dark:border-blue-800/30">
                      <CheckCircle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                      <span className="text-xs text-blue-700 dark:text-blue-300">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!loading && !historyData && !selectedCandidate && !studentId && (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Busca un estudiante</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Escribe nombre o email para ver el historial académico completo
            </p>
          </div>
        )}

        {!loading && !historyData && selectedCandidate && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <p className="text-xs text-muted-foreground">Sin historial para este estudiante</p>
          </div>
        )}

        <ExportOptionsModal
          isOpen={exportModalOpen}
          onClose={() => setExportModalOpen(false)}
          onExport={handleExport}
          reportType="student-history"
          isLoading={exportLoading}
        />
      </div>

      {/* Modal detalle de examen */}
      {selectedExam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => { setSelectedExam(null); setDetailData(null); }}
        >
          <div
            className="relative w-full max-w-2xl max-h-[90vh] flex flex-col bg-card border border-border rounded-xl shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground truncate">{selectedExam.examTitle}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedExam.sessionName}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-bold border ${scoreBadge(selectedExam.percentage)}`}>
                  {selectedExam.percentage.toFixed(1)}%
                </span>
                <button onClick={() => { setSelectedExam(null); setDetailData(null); }}
                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Meta stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: 'Nivel', value: selectedExam.level, icon: Target },
                  { label: 'Tiempo', value: dur(selectedExam.timeSpent), icon: Clock },
                  { label: 'Puntos', value: `${selectedExam.finalScore} / ${selectedExam.maxScore}`, icon: Award },
                  { label: 'Fecha', value: fmt(selectedExam.completedAt), icon: Calendar },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-muted/40 rounded-lg px-3 py-2 flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground leading-none">{label}</p>
                      <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Grading performance */}
              {(() => {
                const ms = (detailData?.gradingDurationMs ?? (selectedExam as any).gradingDurationMs) as number | null | undefined;
                if (ms == null) return null;
                const display = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
                return (
                  <div className="rounded-lg border border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10 px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <div>
                        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">Tiempo de corrección</p>
                      </div>
                    </div>
                    <span className="text-lg font-bold text-violet-700 dark:text-violet-300 shrink-0 tabular-nums">
                      {display}
                    </span>
                  </div>
                );
              })()}

              {/* Competencias */}
              {selectedExam.competencyScores.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground">Competencias</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedExam.competencyScores.map((cs, i) => (
                      <div key={i} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="capitalize text-muted-foreground">{cs.competency.replace('_', ' ')}</span>
                          <span className={`font-semibold ${scoreColor(cs.percentage)}`}>{cs.percentage.toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${
                            cs.percentage >= 80 ? 'bg-emerald-500'
                            : cs.percentage >= 60 ? 'bg-blue-500'
                            : cs.percentage >= 40 ? 'bg-amber-500' : 'bg-red-500'
                          }`} style={{ width: `${Math.min(cs.percentage, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Overall feedback */}
              {selectedExam.feedback && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 dark:bg-blue-900/15 dark:border-blue-800/30 p-3 space-y-1">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">Retroalimentación general</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">{selectedExam.feedback}</p>
                </div>
              )}

              {/* Question-level detail */}
              {detailLoading ? (
                <div className="flex items-center justify-center py-6 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                  <span className="text-xs text-muted-foreground">Cargando preguntas...</span>
                </div>
              ) : detailData?.questionResults?.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    Preguntas
                    <span className="text-muted-foreground font-normal">({detailData.questionResults.length})</span>
                  </p>
                  {detailData.questionResults.map((qr: any, idx: number) => {
                    const qd = qr.questionData;
                    const pct = qr.maxScore > 0 ? Math.round((qr.score / qr.maxScore) * 100) : 0;
                    return (
                      <div key={idx} className="rounded-lg border border-border overflow-hidden">
                        {/* Q header */}
                        <div className="flex items-start justify-between gap-2 px-3 py-2 bg-muted/30 border-b border-border/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-bold text-muted-foreground shrink-0">#{idx + 1}</span>
                            {(qr.questionType ?? qd?.questionType) && (
                              <span className="text-xs bg-muted text-muted-foreground border border-border px-1.5 py-0.5 rounded-full shrink-0">
                                {(qr.questionType ?? qd?.questionType).replace(/_/g, ' ')}
                              </span>
                            )}
                            {qd?.competency && (
                              <span className="text-xs text-muted-foreground capitalize truncate">{qd.competency}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${scoreBadge(pct)}`}>
                              {qr.score}/{qr.maxScore}
                            </span>
                            {qr.isCorrect != null && (
                              qr.isCorrect
                                ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                : <X className="h-3.5 w-3.5 text-red-500" />
                            )}
                          </div>
                        </div>

                        <div className="px-3 py-2.5 space-y-2">
                          {/* Question text */}
                          {qd?.questionText && (
                            <p className="text-xs text-foreground leading-relaxed">{qd.questionText}</p>
                          )}

                          {/* Student response — rendered per question type */}
                          <div className="space-y-0.5">
                            <p className="text-xs text-muted-foreground font-medium">Respuesta del estudiante</p>
                            {renderQuestionResponse(qr)}
                          </div>

                          {/* Per-question feedback */}
                          {qr.feedback && (
                            <div className="rounded bg-blue-50 border border-blue-200 dark:bg-blue-900/15 dark:border-blue-800/30 px-2.5 py-1.5">
                              <p className="text-xs text-blue-700 dark:text-blue-300 flex items-start gap-1.5">
                                <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
                                {qr.feedback}
                              </p>
                            </div>
                          )}

                          {/* AI analysis */}
                          {qr.aiAnalysis?.feedback && (
                            <div className="rounded bg-purple-50 border border-purple-200 dark:bg-purple-900/15 dark:border-purple-800/30 px-2.5 py-2 space-y-1.5">
                              <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                                Análisis
                              </p>
                              <p className="text-xs text-purple-600 dark:text-purple-400 leading-relaxed">{qr.aiAnalysis.feedback}</p>
                              {qr.aiAnalysis.suggestions?.length > 0 && (
                                <ul className="space-y-0.5">
                                  {qr.aiAnalysis.suggestions.map((s: string, si: number) => (
                                    <li key={si} className="text-xs text-purple-600 dark:text-purple-400 flex items-start gap-1">
                                      <span className="shrink-0 mt-0.5">•</span>
                                      <span>{s}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default StudentHistoryScreen;
