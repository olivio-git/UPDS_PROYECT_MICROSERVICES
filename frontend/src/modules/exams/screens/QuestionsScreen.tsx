import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/atoms/dropdown-menu';
import { AudioPlayer } from '@/components/audio';
import CustomizableTable from '@/components/common/CustomizableTable';
import { MainLayout } from '@/components/layout';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Edit,
  FileText,
  Image as ImageIcon,
  Mic,
  MoreVertical,
  PenTool,
  Plus,
  Search,
  Trash2,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import ConfirmBar from '../components/ConfirmBar';
import ImportPanel from '../components/ImportPanel';
import QuestionDetailView from '../components/QuestionDetailView';
import QuestionForm from '../components/QuestionForm';
import { useQuestions } from '../hooks/useQuestions';
import type { Question, QuestionType } from '../types';

type ViewMode = 'table' | 'create' | 'edit' | 'import' | 'detail';

const QuestionsScreen = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');

  const [localFilters, setLocalFilters] = useState({
    type: 'all',
    competency: 'all',
    level: 'all',
    difficulty: 0,
    isActive: true,
  });

  const {
    questions,
    loading,
    error,
    totalPages,
    totalItems,
    currentPage,
    changePage,
    applyFilters,
    clearFilters,
    deleteQuestion,
    loadQuestions,
  } = useQuestions();

  // ── Navigation ──────────────────────────────────────────
  const handleCreate = () => { setSelectedQuestion(null); setViewMode('create'); };
  const handleEdit = (q: Question) => { setSelectedQuestion(q); setViewMode('edit'); };
  const handleImport = () => setViewMode('import');
  const handleBackToTable = () => { setSelectedQuestion(null); setViewMode('table'); };
  const handleViewDetails = (q: Question) => { setSelectedQuestion(q); setViewMode('detail'); };
  const handleEditFromDetails = () => { if (selectedQuestion) setViewMode('edit'); };

  // ── Delete ───────────────────────────────────────────────
  const askDelete = (q: Question) => setQuestionToDelete(q);
  const cancelDelete = () => setQuestionToDelete(null);
  const confirmDelete = async () => {
    if (!questionToDelete?._id) return;
    await deleteQuestion(questionToDelete._id);
    toast.success('Pregunta eliminada exitosamente');
    setQuestionToDelete(null);
    if (viewMode !== 'table') handleBackToTable();
    loadQuestions();
  };

  // ── Filters ──────────────────────────────────────────────
  const handleApplyFilters = () => {
    const active: any = {};
    if (localFilters.type !== 'all') active.type = localFilters.type;
    if (localFilters.competency !== 'all') active.competency = localFilters.competency;
    if (localFilters.level !== 'all') active.level = localFilters.level;
    if (localFilters.difficulty > 0) active.difficulty = localFilters.difficulty;
    active.isActive = localFilters.isActive;
    applyFilters(active);
  };

  const handleClearFilters = () => {
    setLocalFilters({ type: 'all', competency: 'all', level: 'all', difficulty: 0, isActive: true });
    setSearchTerm('');
    clearFilters();
  };

  // ── Helpers ──────────────────────────────────────────────
  const getQuestionTypeIcon = (type: QuestionType) => {
    switch (type) {
      case 'audio_response': return <Volume2 className="w-4 h-4 text-foreground" />;
      case 'file_upload':    return <Upload className="w-4 h-4 text-foreground" />;
      case 'multiple_choice':
      case 'true_false':     return <ClipboardList className="w-4 h-4 text-foreground" />;
      case 'speaking':       return <Mic className="w-4 h-4 text-foreground" />;
      case 'writing':        return <PenTool className="w-4 h-4 text-foreground" />;
      default:               return <FileText className="w-4 h-4 text-foreground" />;
    }
  };

  const getQuestionTypeLabel = (type: QuestionType) => {
    const labels: Record<QuestionType, string> = {
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
      speaking: 'Expresión Oral',
      writing: 'Expresión Escrita',
    };
    return labels[type] || type;
  };

  const getDifficultyColor = (d: number) => {
    if (d <= 2) return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30';
    if (d <= 3) return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30';
    if (d <= 4) return 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30';
    return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30';
  };

  const getDifficultyLabel = (d: number) =>
    ['', 'Muy Fácil', 'Fácil', 'Medio', 'Difícil', 'Muy Difícil'][d] || '';

  const detectMediaType = (mediaUrl: string): 'audio' | 'image' | null => {
    if (!mediaUrl) return null;
    const url = mediaUrl.toLowerCase();
    if (['.mp3', '.wav', '.ogg', '.m4a', '.aac'].some(e => url.includes(e))) return 'audio';
    if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].some(e => url.includes(e))) return 'image';
    return null;
  };

  // ── Columns ──────────────────────────────────────────────
  const columns = useMemo<ColumnDef<Question>[]>(() => [
    {
      id: 'content.question',
      header: 'Pregunta',
      size: 200,
      accessorFn: row => row.content.question,
      cell: ({ getValue }) => {
        const text = String(getValue() ?? '');
        return (
          <button
            type="button"
            onClick={() => { setPreviewContent(text); setPreviewOpen(true); }}
            className="text-left w-full group"
            title="Ver pregunta completa"
          >
            <div className="text-sm text-foreground line-clamp-2 max-w-md group-hover:underline">
              {text}
            </div>
          </button>
        );
      },
      enableSorting: true,
      enableResizing: true,
    },
    {
      id: 'type',
      header: 'Tipo',
      size: 170,
      accessorKey: 'type',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {getQuestionTypeIcon(row.original.type)}
          <span className="text-sm text-muted-foreground">{getQuestionTypeLabel(row.original.type)}</span>
        </div>
      ),
      enableSorting: true,
      enableResizing: true,
    },
    {
      id: 'competency',
      header: 'Competencia',
      size: 140,
      accessorKey: 'competency',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground capitalize">{String(getValue() ?? '')}</span>
      ),
      enableSorting: true,
      enableResizing: true,
    },
    {
      id: 'level',
      header: 'Nivel',
      size: 80,
      accessorKey: 'level',
      cell: ({ getValue }) => (
        <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30 rounded">
          {String(getValue() ?? '')}
        </span>
      ),
      enableSorting: true,
      enableResizing: true,
    },
    {
      id: 'difficulty',
      header: 'Dificultad',
      size: 110,
      accessorKey: 'difficulty',
      cell: ({ getValue }) => {
        const diff = Number(getValue() ?? 0);
        return (
          <span className={`px-2 py-0.5 text-xs font-medium border rounded ${getDifficultyColor(diff)}`}>
            {getDifficultyLabel(diff)}
          </span>
        );
      },
      enableSorting: true,
      enableResizing: true,
    },
    {
      id: 'media',
      header: 'Media',
      size: 150,
      accessorFn: row => row.content.mediaType ?? '',
      cell: ({ row }) => {
        const { mediaUrl, mediaType } = row.original.content;
        if (!mediaUrl) return <span className="text-xs text-muted-foreground/60">—</span>;
        const detected = mediaType || detectMediaType(mediaUrl);
        return (
          <div className="flex items-center gap-2">
            {detected === 'audio' && (
              <>
                <Volume2 className="w-4 h-4 text-blue-400 shrink-0" />
                <AudioPlayer src={mediaUrl} variant="compact" title="Audio" showControls={{ time: true }} className="w-full bg-transparent h-8 border-none" />
              </>
            )}
            {detected === 'image' && (
              <>
                <ImageIcon className="w-4 h-4 text-green-400 shrink-0" />
                <img src={mediaUrl} alt="Preview" className="h-8 w-8 rounded object-cover cursor-pointer hover:scale-110 transition-transform" onClick={() => window.open(mediaUrl, '_blank')} />
              </>
            )}
            {!detected && <span className="text-xs text-muted-foreground/60">Desconocido</span>}
          </div>
        );
      },
      enableSorting: false,
      enableResizing: true,
    },
    {
      id: 'isActive',
      header: 'Estado',
      size: 90,
      accessorKey: 'isActive',
      cell: ({ getValue }) => {
        const active = Boolean(getValue());
        return (
          <span className={`px-2 py-0.5 text-xs font-medium border rounded ${
            active
              ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30'
              : 'bg-muted/20 text-muted-foreground border-border/30'
          }`}>
            {active ? 'Activa' : 'Inactiva'}
          </span>
        );
      },
      enableSorting: true,
      enableResizing: true,
    },
    {
      id: 'actions',
      header: '',
      size: 48,
      cell: ({ row }) => {
        const q = row.original;
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={() => handleViewDetails(q)} className="cursor-pointer">
                <FileText className="w-3.5 h-3.5 mr-2" /> Ver detalles
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleEdit(q)} className="cursor-pointer">
                <Edit className="w-3.5 h-3.5 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => askDelete(q)} className="cursor-pointer text-red-500 focus:text-red-500">
                <Trash2 className="w-3.5 h-3.5 mr-2" /> Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
      enableResizing: false,
    },
  ], []);

  const table = useReactTable({
    data: questions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
  });

  // ── Render ───────────────────────────────────────────────
  const renderView = () => {
    if (viewMode === 'detail' && selectedQuestion) {
      return (
        <QuestionDetailView
          question={selectedQuestion}
          onBack={handleBackToTable}
          onEdit={handleEditFromDetails}
        />
      );
    }

    if (viewMode === 'create' || viewMode === 'edit') {
      return (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              {viewMode === 'edit' ? 'Editar Pregunta' : 'Nueva Pregunta'}
            </h2>
            <button
              onClick={handleBackToTable}
              className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-muted-foreground hover:bg-muted flex items-center gap-2 text-sm"
            >
              <X className="w-4 h-4" /> Volver
            </button>
          </div>
          <QuestionForm
            question={viewMode === 'edit' ? selectedQuestion : null}
            onCancel={handleBackToTable}
            onSaved={() => { handleBackToTable(); loadQuestions(); }}
          />
        </div>
      );
    }

    if (viewMode === 'import') {
      return (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Importar preguntas</h2>
            <button
              onClick={handleBackToTable}
              className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-muted-foreground hover:bg-muted flex items-center gap-2 text-sm"
            >
              <X className="w-4 h-4" /> Volver
            </button>
          </div>
          <ImportPanel
            onCancel={handleBackToTable}
            onImported={() => { handleBackToTable(); loadQuestions(); }}
          />
        </div>
      );
    }

    // ── Table view ──
    return (
      <div className="flex flex-col gap-3">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Banco de Preguntas</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalItems > 0 ? `${totalItems} preguntas` : 'Sin preguntas'} · gestión del banco de evaluación
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImport}
              className="h-8 flex items-center gap-1.5 px-3 text-xs rounded-md border border-border bg-muted/60 hover:bg-muted text-foreground transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Importar
            </button>
            <button
              onClick={handleCreate}
              className="h-8 flex items-center gap-1.5 px-3 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Nueva Pregunta
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-card border border-border rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar pregunta..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleApplyFilters()}
              className="h-7 pl-6 pr-2 text-xs bg-muted/60 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-44"
            />
          </div>

          <div className="w-px h-5 bg-border shrink-0" />

          {/* Tipo */}
          <select
            value={localFilters.type}
            onChange={e => setLocalFilters(p => ({ ...p, type: e.target.value }))}
            className="h-7 text-xs bg-muted/60 border border-border rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Todos los tipos</option>
            <option value="multiple_choice">Opción Múltiple</option>
            <option value="true_false">Verdadero/Falso</option>
            <option value="open_text">Texto Abierto</option>
            <option value="essay">Ensayo</option>
            <option value="fill_blanks">Completar Espacios</option>
            <option value="drag_drop">Arrastrar y Soltar</option>
            <option value="matching">Emparejar</option>
            <option value="ordering">Ordenar</option>
            <option value="audio_response">Respuesta de Audio</option>
            <option value="speaking">Expresión Oral</option>
            <option value="writing">Expresión Escrita</option>
          </select>

          {/* Competencia */}
          <select
            value={localFilters.competency}
            onChange={e => setLocalFilters(p => ({ ...p, competency: e.target.value }))}
            className="h-7 text-xs bg-muted/60 border border-border rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Todas las competencias</option>
            <option value="reading">Comprensión Lectora</option>
            <option value="writing">Expresión Escrita</option>
            <option value="listening">Comprensión Auditiva</option>
            <option value="speaking">Expresión Oral</option>
          </select>

          {/* Nivel */}
          <select
            value={localFilters.level}
            onChange={e => setLocalFilters(p => ({ ...p, level: e.target.value }))}
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

          {/* Dificultad */}
          <select
            value={localFilters.difficulty.toString()}
            onChange={e => setLocalFilters(p => ({ ...p, difficulty: Number(e.target.value) }))}
            className="h-7 text-xs bg-muted/60 border border-border rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="0">Toda dificultad</option>
            <option value="1">Muy Fácil</option>
            <option value="2">Fácil</option>
            <option value="3">Medio</option>
            <option value="4">Difícil</option>
            <option value="5">Muy Difícil</option>
          </select>

          <button
            onClick={handleApplyFilters}
            className="h-7 px-2.5 text-xs rounded bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Aplicar
          </button>
          <button
            onClick={handleClearFilters}
            className="h-7 px-2 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Limpiar
          </button>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              <p className="mt-4 text-sm text-muted-foreground">Cargando preguntas...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-sm text-red-400 mb-4">{error}</p>
              <button onClick={loadQuestions} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Reintentar
              </button>
            </div>
          ) : questions.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">No se encontraron preguntas</p>
              <button onClick={handleCreate} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Crear primera pregunta
              </button>
            </div>
          ) : (
            <>
              <CustomizableTable
                table={table}
                isLoading={loading}
                isFetching={false}
                isError={!!error}
                errorMessage={error!}
                noDataMessage="No se encontraron preguntas"
                rows={10}
              />

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {(currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, totalItems)} de {totalItems} preguntas
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => changePage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-1.5 bg-muted/50 border border-border rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    {(() => {
                      const maxVisible = 5;
                      const half = Math.floor(maxVisible / 2);
                      let start = Math.max(1, currentPage - half);
                      const end = Math.min(totalPages, start + maxVisible - 1);
                      if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);
                      return Array.from({ length: end - start + 1 }, (_, i) => start + i).map(page => (
                        <button
                          key={page}
                          onClick={() => changePage(page)}
                          className={`px-2.5 py-1 text-xs rounded transition-all ${
                            page === currentPage
                              ? 'bg-blue-600 text-white'
                              : 'bg-muted/50 border border-border text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {page}
                        </button>
                      ));
                    })()}
                    <button
                      onClick={() => changePage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="p-1.5 bg-muted/50 border border-border rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Preview modal */}
        {previewOpen && (
          <div
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-2xl bg-card border border-border rounded-lg shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Pregunta completa</h3>
                <button onClick={() => setPreviewOpen(false)} className="p-1.5 rounded hover:bg-muted" aria-label="Cerrar">
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
              <div className="p-4 max-h-[70vh] overflow-y-auto">
                <p className="whitespace-pre-wrap text-sm text-foreground">{previewContent}</p>
              </div>
              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
                <button
                  onClick={() => { navigator.clipboard?.writeText(previewContent).catch(() => {}); toast.success('Copiado al portapapeles'); }}
                  className="px-3 py-1.5 text-xs bg-muted/50 border border-border rounded-lg text-muted-foreground hover:bg-muted"
                >
                  Copiar
                </button>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <MainLayout>
      <div className="flex flex-col gap-3 p-4 max-w-7xl mx-auto w-full">
        {renderView()}
      </div>

      {questionToDelete && (
        <ConfirmBar
          message="¿Eliminar la pregunta seleccionada? Esta acción no se puede deshacer."
          confirmLabel="Eliminar"
          cancelLabel="Cancelar"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          tone="danger"
        />
      )}
    </MainLayout>
  );
};

export default QuestionsScreen;
