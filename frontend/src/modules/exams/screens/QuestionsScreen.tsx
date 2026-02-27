import { Button } from '@/components/atoms/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/atoms/dropdown-menu';
import { Input } from '@/components/atoms/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { AudioPlayer } from '@/components/audio';
import GradientWrapper from '@/components/background/GrandWrapperSection';
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
  Filter,
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
  // Navegación / vistas
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(
    null
  );

  // Estados de UI
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Confirmación no modal de eliminación
  const [questionToDelete, setQuestionToDelete] = useState<Question | null>(
    null
  );

  // Filtros locales
  const [localFilters, setLocalFilters] = useState({
    type: 'all',
    competency: 'all',
    level: 'all',
    difficulty: 0,
    isActive: true,
  });

  // Hook de preguntas
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

  // Navegación
  const handleCreate = () => {
    setSelectedQuestion(null);
    setViewMode('create');
  };

  const handleEdit = (q: Question) => {
    // Asegurar que se pasa la pregunta completa con todos sus datos
    console.log('Editando pregunta:', q); // Debug
    setSelectedQuestion(q);
    setViewMode('edit');
  };
  const handleImport = () => setViewMode('import');
  const handleBackToTable = () => {
    setSelectedQuestion(null);
    setViewMode('table');
  };

  // Detail Modal functions
  const handleViewDetails = (q: Question) => {
    setSelectedQuestion(q);
    setViewMode('detail');
  };

  const handleEditFromDetails = () => {
    if (selectedQuestion) {
      setViewMode('edit');
    }
  };

  // Preview Question
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');

  // Borrado (no modal)
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

  // Filtros
  const handleApplyFilters = () => {
    const active: any = {};
    if (localFilters.type && localFilters.type !== 'all') active.type = localFilters.type;
    if (localFilters.competency && localFilters.competency !== 'all') active.competency = localFilters.competency;
    if (localFilters.level && localFilters.level !== 'all') active.level = localFilters.level;
    if (localFilters.difficulty > 0)
      active.difficulty = localFilters.difficulty;
    active.isActive = localFilters.isActive;
    applyFilters(active);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setLocalFilters({
      type: 'all',
      competency: 'all',
      level: 'all',
      difficulty: 0,
      isActive: true,
    });
    clearFilters();
    setShowFilters(false);
  };

  // Utilidades de render
  const getQuestionTypeIcon = (type: QuestionType) => {
    switch (type) {
      case 'audio_response':
        return <Volume2 className="w-4 h-4 text-white" />;
      case 'file_upload':
        return <Upload className="w-4 h-4 text-white" />;
      case 'multiple_choice':
      case 'true_false':
        return <ClipboardList className="w-4 h-4 text-white" />;
      case 'speaking':
        return <Mic className="w-4 h-4 text-white" />;
      case 'writing':
        return <PenTool className="w-4 h-4 text-white" />;
      default:
        return <FileText className="w-4 h-4 text-white" />;
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
    if (d <= 2) return 'text-green-400 bg-green-900/20 border-green-800/30';
    if (d <= 3) return 'text-yellow-400 bg-yellow-900/20 border-yellow-800/30';
    if (d <= 4) return 'text-orange-400 bg-orange-900/20 border-orange-800/30';
    return 'text-red-400 bg-red-900/20 border-red-800/30';
  };
  const getDifficultyLabel = (d: number) =>
    ['', 'Muy Fácil', 'Fácil', 'Medio', 'Difícil', 'Muy Difícil'][d] || '';

  // Función para detectar tipo de media automáticamente
  const detectMediaType = (mediaUrl: string): 'audio' | 'image' | null => {
    if (!mediaUrl) return null;

    const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.aac'];
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

    const url = mediaUrl.toLowerCase();

    if (audioExtensions.some(ext => url.includes(ext))) return 'audio';
    if (imageExtensions.some(ext => url.includes(ext))) return 'image';

    return null;
  };

  const columns = useMemo<ColumnDef<Question>[]>(
    () => [
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
              onClick={() => {
                setPreviewContent(text);
                setPreviewOpen(true);
              }}
              className="text-left w-full group"
              title="Ver pregunta completa"
            >
              <div className="text-sm text-gray-200 line-clamp-2 max-w-md group-hover:underline">
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
            <span className="text-sm text-gray-300">
              {getQuestionTypeLabel(row.original.type)}
            </span>
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
          <span className="text-sm text-gray-300 capitalize">
            {String(getValue() ?? '')}
          </span>
        ),
        enableSorting: true,
        enableResizing: true,
      },
      {
        id: 'level',
        header: 'Nivel',
        size: 120,
        accessorKey: 'level',
        cell: ({ getValue }) => (
          <span className="px-2.5 py-1 text-xs font-medium bg-blue-900/20 text-blue-400 border border-blue-800/30 rounded-lg">
            {String(getValue() ?? '')}
          </span>
        ),
        enableSorting: true,
        enableResizing: true,
      },
      {
        id: 'difficulty',
        header: 'Dificultad',
        size: 140,
        accessorKey: 'difficulty',
        cell: ({ getValue }) => {
          const diff = Number(getValue() ?? 0);
          return (
            <span
              className={`px-2.5 py-1 text-xs font-medium border rounded-lg ${getDifficultyColor(
                diff
              )}`}
            >
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

          if (!mediaUrl) {
            return <div className="text-gray-500 text-sm">Sin media</div>;
          }

          // Detectar tipo automáticamente si no está definido
          const detectedType = mediaType || detectMediaType(mediaUrl);

          return (
            <div className="flex items-center gap-2">
              {detectedType === 'audio' && (
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-blue-400" />
                  <AudioPlayer
                    src={mediaUrl}
                    variant="compact"
                    title="Audio de la pregunta"
                    showControls={{
                      // volume: true,
                      // speed: true,
                      // seek: true,
                      time: true,
                    }}
                    className="w-full bg-transparent h-8 border-none p-l-1"
                  />
                  {/* Tu navegador no soporta audio. */}
                  {/* <audio controls className="h-8" style={{width: '120px'}}>
                <source src={mediaUrl} type="audio/mpeg" />
                Tu navegador no soporta audio.
              </audio> */}
                </div>
              )}
              {detectedType === 'image' && (
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-green-400" />
                  <img
                    src={mediaUrl}
                    alt="Preview"
                    className="h-8 w-8 rounded object-cover cursor-pointer hover:scale-110 transition-transform"
                    onClick={() => window.open(mediaUrl, '_blank')}
                    title="Click para ver imagen completa"
                  />
                </div>
              )}
              {!detectedType && (
                <div className="text-gray-500 text-sm">Tipo desconocido</div>
              )}
            </div>
          );
        },
        enableSorting: false,
        enableResizing: true,
      },
      {
        id: 'isActive',
        header: 'Estado',
        size: 120,
        accessorKey: 'isActive',
        cell: ({ getValue }) => {
          const active = Boolean(getValue());
          return (
            <span
              className={`px-2.5 py-1 text-xs font-medium border rounded-lg ${
                active
                  ? 'bg-green-900/20 text-green-400 border-green-800/30'
                  : 'bg-gray-900/20 text-gray-400 border-gray-800/30'
              }`}
            >
              {active ? 'Activa' : 'Inactiva'}
            </span>
          );
        },
        enableSorting: true,
        enableResizing: true,
      },
      {
        id: 'actions',
        header: 'Acciones',
        size: 60,
        cell: ({ row }) => {
          const q = row.original;
          return (
            <div className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 hover:bg-dark-light rounded-lg transition-colors">
                    <MoreVertical className="w-4 h-4 text-gray-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-box border-line">
                  <DropdownMenuItem
                    onClick={() => handleViewDetails(q)}
                    className="text-gray-200 hover:bg-dark-light cursor-pointer"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Ver detalles
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleEdit(q)}
                    className="text-gray-200 hover:bg-dark-light cursor-pointer"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-line" />
                  <DropdownMenuItem
                    onClick={() => askDelete(q)}
                    className="text-red-400 hover:bg-dark-light cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
        enableSorting: false,
        enableResizing: false,
      },
    ],
    [getQuestionTypeIcon, getQuestionTypeLabel]
  );
  const table = useReactTable({
    data: questions,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: 'onChange',
    // Seguimos usando paginación externa, así que no activamos la interna.
  });

  // Contenido según vista
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
        <div className="bg-box border border-line rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-100">
              {viewMode === 'edit' ? 'Editar Pregunta' : 'Nueva Pregunta'}
            </h2>
            <button
              onClick={handleBackToTable}
              className="px-3 py-2 bg-dark-light border border-line rounded-lg text-gray-300 hover:bg-dark-light/80 flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Volver
            </button>
          </div>

          <QuestionForm
            question={viewMode === 'edit' ? selectedQuestion : null}
            onCancel={handleBackToTable}
            onSaved={() => {
              handleBackToTable();
              loadQuestions();
            }}
          />
        </div>
      );
    }

    if (viewMode === 'import') {
      return (
        <div className="bg-box border border-line rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-100">
              Importar preguntas
            </h2>
            <button
              onClick={handleBackToTable}
              className="px-3 py-2 bg-dark-light border border-line rounded-lg text-gray-300 hover:bg-dark-light/80 flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Volver
            </button>
          </div>
          <ImportPanel
            onCancel={handleBackToTable}
            onImported={() => {
              handleBackToTable();
              loadQuestions();
            }}
          />
        </div>
      );
    }
    const baseInputClass =
      'bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 border-[0.5px] focus:border-blue-500 focus:ring-0 rounded-lg';

    // Tabla
    return (
      <div className="space-y-6">
        {/* Header con búsqueda y acciones */}
        <div className="bg-box border border-line rounded-xl p-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-200">
              Gestión de Preguntas
            </h2>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Búsqueda */}
            <div className="flex-1 max-w-xl">
              <div className="relative">
                {/* <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" /> */}
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 focus:outline-none " />
                <Input
                  placeholder="Buscar preguntas..."
                  value={searchTerm || ''}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 pr-3 w-full bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
                />
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2.5 bg-dark-light border border-line rounded-lg hover:bg-dark-light/80 text-gray-300 flex items-center gap-2 transition-all"
              >
                <Filter className="w-4 h-4" />
                Filtros
              </button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleImport}
                className="w-full bg-gradient-to-r from-green-500/10 to-emerald-600/30 border border-green-500/30 text-green-300 hover:from-green-500/30 hover:to-emerald-600/30"
              >
                <Upload className="w-4 h-4" />
                Importar
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCreate}
                className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4" />
                Nueva Pregunta
              </Button>
            </div>
          </div>

          {/* Filtros expandidos */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-line">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Tipo
                  </label>
                  {/* <select
                    className="w-full px-3 py-2 bg-dark-light border border-line rounded-lg text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                    value={localFilters.type}
                    onChange={(e) => setLocalFilters({ ...localFilters, type: e.target.value })}
                  >
                    <option value="">Todos</option>
                    <option value="multiple_choice">Opción Múltiple</option>
                    <option value="true_false">Verdadero/Falso</option>
                    <option value="open_text">Texto Abierto</option>
                    <option value="listening">Comprensión Auditiva</option>
                    <option value="speaking">Expresión Oral</option>
                    <option value="reading">Comprensión Lectora</option>
                    <option value="writing">Expresión Escrita</option>
                  </select> */}
                  <Select
                    value={localFilters.type as string}
                    onValueChange={value =>
                      setLocalFilters({ ...localFilters, type: value })
                    }
                  >
                    <SelectTrigger className={baseInputClass}>
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border border-line">
                      <SelectItem className="hover:bg-gray-800" value="all">
                        Todos
                      </SelectItem>
                      <SelectItem
                        className="hover:bg-gray-800"
                        value="multiple_choice"
                      >
                        Opción Múltiple
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="true_false">
                        Verdadero/Falso
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="open_text">
                        Texto Abierto
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="essay">
                        Ensayo
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="fill_blanks">
                        Completar Espacios
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="drag_drop">
                        Arrastrar y Soltar
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="matching">
                        Emparejar
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="ordering">
                        Ordenar
                      </SelectItem>
                      <SelectItem
                        className="hover:bg-gray-800"
                        value="audio_response"
                      >
                        Respuesta de Audio
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="file_upload">
                        Subir Archivo
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="speaking">
                        Expresión Oral (Speaking)
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="writing">
                        Expresión Escrita (Writing)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Competencia
                  </label>
                  <Select
                    value={localFilters.competency as string}
                    onValueChange={value =>
                      setLocalFilters({ ...localFilters, competency: value })
                    }
                  >
                    <SelectTrigger className={baseInputClass}>
                      <SelectValue placeholder="Selecciona la competencia" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border border-line">
                      <SelectItem className="hover:bg-gray-800" value="all">
                        Todas
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="reading">
                        Comprensión Lectora
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="writing">
                        Expresión Escrita
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="listening">
                        Comprensión Auditiva
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="speaking">
                        Expresión Oral
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="grammar">
                        Gramática
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="vocabulary">
                        Vocabulario
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Nivel
                  </label>
                  <Select
                    value={localFilters.level as string}
                    onValueChange={value =>
                      setLocalFilters({ ...localFilters, level: value })
                    }
                  >
                    <SelectTrigger className={baseInputClass}>
                      <SelectValue placeholder="Todos los niveles" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border border-line">
                      <SelectItem className="hover:bg-gray-800" value="all">
                        Todos
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="A1">
                        A1
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="A2">
                        A2
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="B1">
                        B1
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="B2">
                        B2
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="C1">
                        C1
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="C2">
                        C2
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Dificultad
                  </label>
                  <Select
                    value={localFilters.difficulty.toString()}
                    onValueChange={value =>
                      setLocalFilters({ ...localFilters, difficulty: Number(value) })
                    }
                  >
                    <SelectTrigger className={baseInputClass}>
                      <SelectValue placeholder="Todas las dificultades" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border border-line">
                      <SelectItem className="hover:bg-gray-800" value="0">
                        Todas
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="1">
                        Muy Fácil
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="2">
                        Fácil
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="3">
                        Medio
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="4">
                        Difícil
                      </SelectItem>
                      <SelectItem className="hover:bg-gray-800" value="5">
                        Muy Difícil
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end gap-2">
                  <button
                    onClick={handleApplyFilters}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
                  >
                    Aplicar
                  </button>
                  <button
                    onClick={handleClearFilters}
                    className="px-4 py-2 bg-dark-light border border-line rounded-lg hover:bg-dark-light/80 text-gray-300 transition-all"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabla */}
        <div className="bg-box border border-line rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-400">Cargando preguntas...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={loadQuestions}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
              >
                Reintentar
              </button>
            </div>
          ) : questions.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">No se encontraron preguntas</p>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
              >
                Crear primera pregunta
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <div className="bg-box border border-line rounded-xl overflow-hidden">
                  <CustomizableTable
                    table={table}
                    isLoading={loading}
                    isFetching={false}
                    isError={!!error}
                    errorMessage={error!}
                    noDataMessage="No se encontraron preguntas"
                    rows={10} // cantidad de esqueletos mientras carga
                  />

                  {/* Paginación externa: la mantenemos igual */}
                  <div className="px-6 py-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-400">
                      Mostrando {(currentPage - 1) * 10 + 1} a{' '}
                      {Math.min(currentPage * 10, totalItems)} de {totalItems}{' '}
                      preguntas
                      {/* Debug info */}
                      {/* <span className="ml-2 text-xs text-yellow-400">
                        (Página {currentPage} de {totalPages})
                      </span> */}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => changePage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="p-2 bg-dark-light border border-line rounded-lg hover:bg-dark-light/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-400" />
                      </button>

                      <div className="flex gap-1">
                        {(() => {
                          const pageButtons = [];
                          const maxVisiblePages = 5;
                          const halfVisible = Math.floor(maxVisiblePages / 2);

                          let startPage = Math.max(1, currentPage - halfVisible);
                          let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

                          // Ajustar startPage si estamos cerca del final
                          if (endPage - startPage + 1 < maxVisiblePages) {
                            startPage = Math.max(1, endPage - maxVisiblePages + 1);
                          }

                          for (let page = startPage; page <= endPage; page++) {
                            pageButtons.push(
                              <button
                                key={page}
                                onClick={() => changePage(page)}
                                className={`px-3 py-1 rounded-lg transition-all ${
                                  page === currentPage
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-dark-light border border-line text-gray-400 hover:bg-dark-light/80'
                                }`}
                              >
                                {page}
                              </button>
                            );
                          }

                          return pageButtons;
                        })()}
                      </div>

                      <button
                        onClick={() => changePage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="p-2 bg-dark-light border border-line rounded-lg hover:bg-dark-light/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* Paginación */}
              {/* <div className="px-6 py-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-gray-400">
                  Mostrando {((currentPage - 1) * 10) + 1} a {Math.min(currentPage * 10, totalItems)} de {totalItems} preguntas
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => changePage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 bg-dark-light border border-line rounded-lg hover:bg-dark-light/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                  </button>

                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = i + 1;
                      return (
                        <button
                          key={page}
                          onClick={() => changePage(page)}
                          className={`px-3 py-1 rounded-lg transition-all ${
                            page === currentPage
                              ? "bg-blue-600 text-white"
                              : "bg-dark-light border border-line text-gray-400 hover:bg-dark-light/80"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={() => changePage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 bg-dark-light border border-line rounded-lg hover:bg-dark-light/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              </div> */}
            </>
          )}
        </div>
        {previewOpen && (
          <div
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
          >
            <div className="w-full max-w-2xl bg-box border border-line rounded-lg shadow-xl">
              <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                <h3 id="preview-title" className="text-white font-semibold">
                  Pregunta completa
                </h3>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="p-2 rounded hover:bg-dark-light"
                  aria-label="Cerrar"
                >
                  <X className="w-4 h-4 text-gray-300" />
                </button>
              </div>

              <div className="p-4 max-h-[70vh] overflow-y-auto">
                <p className="whitespace-pre-wrap text-gray-200">
                  {previewContent}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-line">
                <button
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(previewContent)
                      .catch(() => {});
                    toast.success('Copiado al portapapeles');
                  }}
                  className="px-3 py-2 bg-dark-light border border-line rounded-lg text-gray-300 hover:bg-dark-light/80"
                >
                  Copiar
                </button>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
    <MainLayout gradientVariant="aurora">
      <div className="max-w-7xl mx-auto space-y-8 epilogue-uniquifier">
        <div className="text-center space-y-3 mb-5">
          <div className="flex justify-center">
            <div className="p-2.5 rounded-full bg-gradient-to-br from-blue-500/15 to-purple-600/15 border border-blue-500/20">
              <ClipboardList className="h-3.5 w-3.5 text-blue-300" />
            </div>
          </div>
        </div>

        <GradientWrapper
          intensity="low"
          size="xl"
          position="right"
          animate={false}
          variant="cosmic"
        >
          <div className="min-h-screen">{renderView()}</div>
        </GradientWrapper>
      </div>

      {/* Barra de confirmación (no modal) */}
      {questionToDelete && (
        <ConfirmBar
          message={`¿Eliminar la pregunta seleccionada? Esta acción no se puede deshacer.`}
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
