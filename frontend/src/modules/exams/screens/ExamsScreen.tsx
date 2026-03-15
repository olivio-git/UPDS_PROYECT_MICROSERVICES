import { Button } from "@/components/atoms/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/atoms/dropdown-menu";
import { Input } from "@/components/atoms/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/atoms/select";
import GradientWrapper from "@/components/background/GrandWrapperSection";
import CustomizableTable from "@/components/common/CustomizableTable";
import { MainLayout } from "@/components/layout";
import { getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import {
  BookOpen,
  ChevronLeft, ChevronRight,
  Copy, Edit,
  Eye,
  Filter,
  MoreVertical,
  Plus, Search,
  Trash2,
  X
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import ConfirmBar from "../components/ConfirmBar";
import ExamDetailView from "../components/ExamDetailView";
import ExamForm from "../components/ExamForm";
import { useExams } from "../hooks/useExams";
import type { Exam } from "../types";

type ViewMode = "table" | "create" | "edit" | "detail";

const ExamsScreen = () => {
  // Navegación / vistas
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);

  // Estados de UI
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Confirmación no modal de eliminación
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);

  // Filtros locales
  const [localFilters, setLocalFilters] = useState({
    type: "all",
    targetLevel: "all",
    isTemplate: false,
    isActive: true
  });

  // Hook de exámenes
  const {
    exams, loading, error, totalPages, totalItems, currentPage,
    changePage, applyFilters, clearFilters, deleteExam, loadExams, cloneExam
  } = useExams();

  // Navegación
  const handleCreate = () => { 
    setSelectedExam(null); 
    setViewMode("create"); 
  };
  
  const handleEdit = (exam: Exam) => { 
    setSelectedExam(exam); 
    setViewMode("edit"); 
  };

  const handleBackToTable = () => { 
    setSelectedExam(null); 
    setViewMode("table"); 
  };

  // Detail Modal functions
  const handleViewDetails = (exam: Exam) => {
    setSelectedExam(exam);
    setViewMode("detail");
  };
  
  const handleEditFromDetails = () => {
    if (selectedExam) {
      setViewMode("edit");
    }
  };

  // Borrado (no modal)
  const askDelete = (exam: Exam) => setExamToDelete(exam);
  const cancelDelete = () => setExamToDelete(null);
  const confirmDelete = async () => {
    if (!examToDelete?._id) return;
    await deleteExam(examToDelete._id);
    toast.success("Examen eliminado exitosamente");
    setExamToDelete(null);
    if (viewMode !== "table") handleBackToTable();
    loadExams();
  };

  // Clonar examen
  const handleClone = async (exam: Exam) => {
    if (exam._id) {
      await cloneExam(exam._id);
    }
  };

  // Filtros
  const handleApplyFilters = () => {
    const active: any = {};
    if (localFilters.type && localFilters.type !== "all") active.type = localFilters.type;
    if (localFilters.targetLevel && localFilters.targetLevel !== "all") active.level = localFilters.targetLevel;
    if (localFilters.isTemplate) active.isTemplate = localFilters.isTemplate;
    active.isActive = localFilters.isActive;
    applyFilters(active);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setLocalFilters({ type: "all", targetLevel: "all", isTemplate: false, isActive: true });
    clearFilters();
    setShowFilters(false);
  };

  // Utilidades de render
  const getExamTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      placement: "Nivelación",
      progress: "Progreso",
      final: "Final",
      practice: "Práctica"
    };
    return labels[type] || type;
  };

  const getExamTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      placement: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
      progress:  "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
      final:     "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
      practice:  "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30",
    };
    return colors[type] || "text-muted-foreground bg-muted/20 border-border";
  };

  const columns = useMemo<ColumnDef<Exam>[]>(() => [
    {
      id: "name",
      header: "Nombre del Examen",
      size: 250,
      accessorKey: "name",
      cell: ({ row }) => {
        const exam = row.original;
        return (
          <div className="space-y-1">
            <div className="font-medium text-foreground">
              {exam.name}
            </div>
            {exam.description && (
              <div className="text-sm text-muted-foreground line-clamp-2">
                {exam.description}
              </div>
            )}
          </div>
        );
      },
      enableSorting: true,
      enableResizing: true,
    },
    {
      id: "type",
      header: "Tipo",
      size: 140,
      accessorKey: "type",
      cell: ({ getValue }) => {
        const type = String(getValue());
        return (
          <span className={`px-2.5 py-1 text-xs font-medium border rounded-lg ${getExamTypeColor(type)}`}>
            {getExamTypeLabel(type)}
          </span>
        );
      },
      enableSorting: true,
      enableResizing: true,
    },
    {
      id: "targetLevel",
      header: "Nivel",
      size: 100,
      accessorKey: "targetLevel",
      cell: ({ getValue }) => (
        <span className="px-2.5 py-1 text-xs font-medium bg-purple-100 text-purple-700 border border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30 rounded-lg">
          {String(getValue() ?? "")}
        </span>
      ),
      enableSorting: true,
      enableResizing: true,
    },
    {
      id: "structure",
      header: "Estructura",
      size: 180,
      accessorFn: (row) => row.structure,
      cell: ({ row }) => {
        const structure = row.original.structure;
        return (
          <div className="space-y-1 text-sm">
            <div className="text-foreground/80">
              {structure.sections?.length || 0} secciones
            </div>
            <div className="text-muted-foreground">
              {structure.totalDuration || 0} min • {structure.passingScore || 0}% mín.
            </div>
          </div>
        );
      },
      enableSorting: false,
      enableResizing: true,
    },
    {
      id: "questionPool",
      header: "Preguntas",
      size: 120,
      accessorFn: (row) => row.questionPool?.length || 0,
      cell: ({ getValue }) => (
        <div className="text-center">
          <span className="text-lg font-semibold text-blue-400">
            {Number(getValue())}
          </span>
          <div className="text-xs text-muted-foreground">preguntas</div>
        </div>
      ),
      enableSorting: true,
      enableResizing: true,
    },
    {
      id: "status",
      header: "Estado",
      size: 120,
      accessorFn: (row) => ({ isActive: row.isActive, isTemplate: row.isTemplate }),
      cell: ({ getValue }) => {
        const { isActive, isTemplate } = getValue() as { isActive: boolean; isTemplate: boolean };
        
        if (isTemplate) {
          return (
            <span className="px-2.5 py-1 text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30 rounded-lg">
              Plantilla
            </span>
          );
        }
        
        return (
          <span
            className={`px-2.5 py-1 text-xs font-medium border rounded-lg ${
              isActive
                ? "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30"
                : "bg-muted/20 text-muted-foreground border-border"
            }`}
          >
            {isActive ? "Activo" : "Inactivo"}
          </span>
        );
      },
      enableSorting: true,
      enableResizing: true,
    },
    {
      id: "actions",
      header: "Acciones",
      size: 60,
      cell: ({ row }) => {
        const exam = row.original;
        return (
          <div className="text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover border-line">
                <DropdownMenuItem
                  onClick={() => handleViewDetails(exam)}
                  className="text-foreground hover:bg-muted cursor-pointer"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ver detalles
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleEdit(exam)}
                  className="text-foreground hover:bg-muted cursor-pointer"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleClone(exam)}
                  className="text-foreground hover:bg-muted cursor-pointer"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Clonar
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={() => askDelete(exam)}
                  className="text-red-400 hover:bg-muted cursor-pointer"
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
  ], []);

  const table = useReactTable({
    data: exams,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    columnResizeMode: "onChange",
  });

  // Contenido según vista
  const renderView = () => {
    if (viewMode === "detail" && selectedExam) {
      return (
        <ExamDetailView
          exam={selectedExam}
          onBack={handleBackToTable}
          onEdit={handleEditFromDetails}
        />
      );
    }

    if (viewMode === "create" || viewMode === "edit") {
      return (
        <div className="bg-card border border-line rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              {viewMode === "edit" ? "Editar Examen" : "Nuevo Examen"}
            </h2>
            <button
              onClick={handleBackToTable}
              className="px-3 py-2 bg-muted/50 border border-line rounded-lg text-muted-foreground hover:bg-muted flex items-center gap-2"
            >
              <X className="w-4 h-4" /> Volver
            </button>
          </div>

          <ExamForm
            exam={viewMode === "edit" ? selectedExam : null}
            onCancel={handleBackToTable}
            onSaved={() => { 
              handleBackToTable(); 
              loadExams(); 
            }}
          />
        </div>
      );
    }

    const baseInputClass =
      "bg-muted/50 border-border text-foreground placeholder:text-muted-foreground border-[0.5px] focus:border-blue-500 focus:ring-0 rounded-lg";

    // Tabla
    return (
      <div className="space-y-6">
        {/* Header con búsqueda y acciones */}
        <div className="bg-card border border-line rounded-xl p-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-foreground">
              Gestión de Exámenes
            </h2> 
          </div>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Búsqueda */}
            <div className="flex-1 max-w-xl">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  placeholder="Buscar exámenes..."
                  value={searchTerm || ''}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-3 w-full bg-muted/50 border-border text-foreground placeholder:text-muted-foreground"
                /> 
              </div>
            </div>

            {/* Acciones */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2.5 bg-muted/50 border border-line rounded-lg hover:bg-muted text-muted-foreground flex items-center gap-2 transition-all"
              >
                <Filter className="w-4 h-4" />
                Filtros
              </button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleCreate}
                className="gap-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Plus className="w-4 h-4" />
                Nuevo Examen
              </Button>
            </div>
          </div>

          {/* Filtros expandidos */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-line">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Tipo</label>
                  <Select
                    value={localFilters.type}
                    onValueChange={(value) => setLocalFilters({ ...localFilters, type: value })}
                  >
                    <SelectTrigger className={baseInputClass}>
                      <SelectValue placeholder="Selecciona el tipo" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border">
                      <SelectItem className="hover:bg-muted" value="all">Todos</SelectItem>
                      <SelectItem className="hover:bg-muted" value="placement">Nivelación</SelectItem>
                      <SelectItem className="hover:bg-muted" value="progress">Progreso</SelectItem>
                      <SelectItem className="hover:bg-muted" value="final">Final</SelectItem>
                      <SelectItem className="hover:bg-muted" value="practice">Práctica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Nivel</label>
                  <Select
                    value={localFilters.targetLevel}
                    onValueChange={(value) => setLocalFilters({ ...localFilters, targetLevel: value })}
                  >
                    <SelectTrigger className={baseInputClass}>
                      <SelectValue placeholder="Selecciona el nivel" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border">
                      <SelectItem className="hover:bg-muted" value="all">Todos</SelectItem>
                      <SelectItem className="hover:bg-muted" value="A1">A1</SelectItem>
                      <SelectItem className="hover:bg-muted" value="A2">A2</SelectItem>
                      <SelectItem className="hover:bg-muted" value="B1">B1</SelectItem>
                      <SelectItem className="hover:bg-muted" value="B2">B2</SelectItem>
                      <SelectItem className="hover:bg-muted" value="C1">C1</SelectItem>
                      <SelectItem className="hover:bg-muted" value="C2">C2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Estado</label>
                  <Select
                    value={localFilters.isActive.toString()}
                    onValueChange={(value) => setLocalFilters({ ...localFilters, isActive: value === "true" })}
                  >
                    <SelectTrigger className={baseInputClass}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border border-border">
                      <SelectItem className="hover:bg-muted" value="true">Activos</SelectItem>
                      <SelectItem className="hover:bg-muted" value="false">Inactivos</SelectItem>
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
                    className="px-4 py-2 bg-muted/50 border border-line rounded-lg hover:bg-muted text-muted-foreground transition-all"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabla */}
        <div className="bg-card border border-line rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-muted-foreground">Cargando exámenes...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => loadExams()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
              >
                Reintentar
              </button>
            </div>
          ) : exams.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No se encontraron exámenes</p>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
              >
                Crear primer examen
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <CustomizableTable
                  table={table}
                  isLoading={loading}
                  isFetching={false}
                  isError={!!error}
                  errorMessage={error!}
                  noDataMessage="No se encontraron exámenes"
                  rows={10}
                />
                
                {/* Paginación */}
                <div className="px-6 py-4 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {((currentPage - 1) * 10) + 1} a {Math.min(currentPage * 10, totalItems)} de {totalItems} exámenes
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => changePage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="p-2 bg-muted/50 border border-line rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4 text-muted-foreground" />
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
                                : "bg-muted/50 border border-line text-muted-foreground hover:bg-muted"
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
                      className="p-2 bg-muted/50 border border-line rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <MainLayout gradientVariant="aurora">
      <div className="max-w-7xl mx-auto space-y-8 epilogue-uniquifier">
        <div className="text-center space-y-3 mb-5">
          <div className="flex justify-center">
            <div className="p-2.5 rounded-full bg-gradient-to-br from-blue-500/15 to-purple-600/15 border border-blue-500/20">
              <BookOpen className="h-3.5 w-3.5 text-blue-300" />
            </div>
          </div> 
        </div>

        <GradientWrapper intensity="low" size="xl" position="right" animate={false} variant="cosmic">
          <div className="min-h-screen">{renderView()}</div>
        </GradientWrapper>
      </div>

      {/* Barra de confirmación (no modal) */}
      {examToDelete && (
        <ConfirmBar
          message={`¿Eliminar el examen "${examToDelete.name}"? Esta acción no se puede deshacer.`}
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

export default ExamsScreen;