import { EmptyState } from '@/components/common/EmptyState';
import { Input } from '@/components/keel/input';
import { Button } from '@/components/keel/button';
import { FormPage } from '@/components/layout';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/keel/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/keel/select";
import CustomizableTable from "@/components/common/CustomizableTable";
import { MainLayout } from "@/components/layout";
import { getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import {
  BookOpen,
  ChevronLeft, ChevronRight,
  Copy, Edit,
  Eye,
  MoreVertical,
  Plus, Search,
  Trash2
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
  };

  const handleClearFilters = () => {
    setLocalFilters({ type: "all", targetLevel: "all", isTemplate: false, isActive: true });
    clearFilters();
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
          <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
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
              <DropdownMenuTrigger render={<button className="p-2 hover:bg-muted rounded-lg transition-colors" />}>
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleViewDetails(exam)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Ver detalles
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleEdit(exam)}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleClone(exam)}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Clonar
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => askDelete(exam)}
                  variant="destructive"
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
        <FormPage title={viewMode === "edit" ? "Editar Examen" : "Nuevo Examen"} onBack={handleBackToTable}>
          <ExamForm
            exam={viewMode === "edit" ? selectedExam : null}
            onCancel={handleBackToTable}
            onSaved={() => { 
              handleBackToTable(); 
              loadExams(); 
            }}
          />
        </FormPage>
      );
    }

    // Tabla
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">Gestión de Exámenes</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalItems > 0 ? `${totalItems} exámenes` : 'Sin exámenes'} · gestión del banco de evaluaciones
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleCreate}
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo Examen
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-card border border-border px-3 py-2 flex shrink-0 flex-wrap items-center gap-2">

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Buscar exámenes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleApplyFilters()}
              className="w-44 h-7 pl-6 pr-2 text-xs"
            />
          </div>

          <div className="w-px h-5 bg-border shrink-0" />

          {/* Tipo */}
          <Select
            value={localFilters.type}
            onValueChange={(value) => value && setLocalFilters({ ...localFilters, type: value })}
            items={{ all: "Todos los tipos", placement: "Nivelación", progress: "Progreso", final: "Final", practice: "Práctica" }}
          >
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="text-xs" value="all">Todos los tipos</SelectItem>
              <SelectItem className="text-xs" value="placement">Nivelación</SelectItem>
              <SelectItem className="text-xs" value="progress">Progreso</SelectItem>
              <SelectItem className="text-xs" value="final">Final</SelectItem>
              <SelectItem className="text-xs" value="practice">Práctica</SelectItem>
            </SelectContent>
          </Select>

          {/* Nivel */}
          <Select
            value={localFilters.targetLevel}
            onValueChange={(value) => value && setLocalFilters({ ...localFilters, targetLevel: value })}
            items={{ all: "Todos los niveles", A1: "A1", A2: "A2", B1: "B1", B2: "B2", C1: "C1", C2: "C2" }}
          >
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue placeholder="Nivel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="text-xs" value="all">Todos los niveles</SelectItem>
              <SelectItem className="text-xs" value="A1">A1</SelectItem>
              <SelectItem className="text-xs" value="A2">A2</SelectItem>
              <SelectItem className="text-xs" value="B1">B1</SelectItem>
              <SelectItem className="text-xs" value="B2">B2</SelectItem>
              <SelectItem className="text-xs" value="C1">C1</SelectItem>
              <SelectItem className="text-xs" value="C2">C2</SelectItem>
            </SelectContent>
          </Select>

          {/* Estado */}
          <Select
            value={localFilters.isActive.toString()}
            onValueChange={(value) => setLocalFilters({ ...localFilters, isActive: value === "true" })}
            items={{ true: "Activos", false: "Inactivos" }}
          >
            <SelectTrigger size="sm" className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem className="text-xs" value="true">Activos</SelectItem>
              <SelectItem className="text-xs" value="false">Inactivos</SelectItem>
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={handleApplyFilters}
          >
            Aplicar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
          >
            Limpiar
          </Button>
        </div>

        {/* Table */}
        <div className="flex flex-1 min-h-0 flex-col border-t border-border bg-card">
          {loading ? (
            <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              <p className="mt-4 text-sm text-muted-foreground">Cargando exámenes...</p>
            </div>
          ) : error ? (
            <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center">
              <p className="text-sm text-red-400 mb-4">{error}</p>
              <Button
                size="sm"
                onClick={() => loadExams()}
              >
                Reintentar
              </Button>
            </div>
          ) : exams.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No se encontraron exámenes"
              action={<Button size="sm" onClick={handleCreate}>Crear primer examen</Button>}
            />
          ) : (
            <>
              <div className="flex-1 min-h-0">
                <CustomizableTable
                  table={table}
                  isLoading={loading}
                  isFetching={false}
                  isError={!!error}
                  errorMessage={error!}
                  noDataMessage="No se encontraron exámenes"
                  rows={10}
                />
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-border flex shrink-0 items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {(currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, totalItems)} de {totalItems} exámenes
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => changePage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
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
                    <Button
                      variant="outline"
                      size="icon-sm"
                      onClick={() => changePage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <MainLayout gradientVariant="aurora">
      <div className="flex h-full min-h-0 flex-col gap-3 p-3">
        {renderView()}
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