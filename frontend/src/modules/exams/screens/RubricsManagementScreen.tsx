import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/atoms/alert-dialog";
import { MainLayout } from "@/components/layout";
import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import RubricForm from "../components/rubrics/RubricForm";
import RubricTable from "../components/rubrics/RubricTable";
import RubricTableHeader from "../components/rubrics/RubricTableHeader";
import { useRubrics } from "../hooks/useRubrics";
import type { Rubric, RubricFilters } from "../types/rubrics.types";

type ViewMode = "table" | "create" | "edit";

const RubricsManagementScreen = () => {
  // Estados de UI
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [selectedRubric, setSelectedRubric] = useState<Rubric | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [rubricToDelete, setRubricToDelete] = useState<Rubric | null>(null);
  const [isDeleteMultipleDialogOpen, setIsDeleteMultipleDialogOpen] = useState(false);
  const [isFormLoading, setIsFormLoading] = useState(false);

  // Hook de rúbricas
  const {
    rubrics,
    isLoading,
    isError,
    errorMessage,
    filters,
    setFilters,
    selectedRubrics,
    selectRubric,
    selectAllRubrics,
    clearSelection,
    refreshRubrics,
    createRubric,
    updateRubric,
    deleteRubric,
    deleteSelectedRubrics,
    cloneRubric,
    activateRubric,
    deactivateRubric,
  } = useRubrics();

  // Manejadores de navegación
  const handleCreateRubric = () => {
    setSelectedRubric(null);
    setViewMode("create");
  };

  const handleEditRubric = (rubric: Rubric) => {
    setSelectedRubric(rubric);
    setViewMode("edit");
  };

  const handleViewRubric = (rubric: Rubric) => {
    setSelectedRubric(rubric);
    setViewMode("edit");
  };

  const handleBackToTable = () => {
    setSelectedRubric(null);
    setViewMode("table");
    clearSelection();
  };

  // Manejadores CRUD
  const handleSaveRubric = async (rubricData: Omit<Rubric, '_id' | 'createdAt' | 'updatedAt'>) => {
    setIsFormLoading(true);
    try {
      let success = false;

      if (viewMode === "create") {
        success = await createRubric(rubricData);
        if (success) {
          toast.success("Rúbrica creada exitosamente");
          handleBackToTable();
        }
      } else if (viewMode === "edit" && selectedRubric) {
        success = await updateRubric(selectedRubric._id!, rubricData);
        if (success) {
          toast.success("Rúbrica actualizada exitosamente");
          refreshRubrics();
          handleBackToTable();
        }
      }
    } catch (error) {
      console.error("Error saving rubric:", error);
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleDeleteRubric = (rubric: Rubric) => {
    setRubricToDelete(rubric);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteRubric = async () => {
    if (!rubricToDelete) return;

    const success = await deleteRubric(rubricToDelete._id!);
    if (success) {
      toast.success(`Rúbrica "${rubricToDelete.name}" eliminada`);
    }

    setIsDeleteDialogOpen(false);
    setRubricToDelete(null);
  };

  const handleDeleteSelectedRubrics = () => {
    if (selectedRubrics.length === 0) {
      toast.warning("No hay rúbricas seleccionadas");
      return;
    }
    setIsDeleteMultipleDialogOpen(true);
  };

  const confirmDeleteSelectedRubrics = async () => {
    await deleteSelectedRubrics();
    setIsDeleteMultipleDialogOpen(false);
  };

  // Manejadores de acciones específicas
  const handleActivateRubric = async (rubric: Rubric) => {
    const success = await activateRubric(rubric._id!);
    if (success) {
      toast.success(`Rúbrica "${rubric.name}" activada`);
    }
  };

  const handleDeactivateRubric = async (rubric: Rubric) => {
    const success = await deactivateRubric(rubric._id!);
    if (success) {
      toast.success(`Rúbrica "${rubric.name}" desactivada`);
    }
  };

  const handleCloneRubric = async (rubric: Rubric) => {
    const newName = `${rubric.name} (Copia)`;
    const success = await cloneRubric(rubric._id!, newName);
    if (success) {
      toast.success(`Rúbrica clonada como "${newName}"`);
    }
  };

  // Manejadores de filtros
  const handleFiltersChange = (newFilters: RubricFilters) => {
    setFilters(newFilters);
    clearSelection();
  };

  // Renderizar contenido según el modo de vista
  const renderContent = () => {
    if (viewMode === "create" || (viewMode === "edit" && selectedRubric)) {
      return (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              {viewMode === "edit" ? "Editar Rúbrica" : "Nueva Rúbrica"}
            </h2>
            <button
              onClick={handleBackToTable}
              className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-muted-foreground hover:bg-muted flex items-center gap-2 text-sm"
            >
              <X className="w-4 h-4" /> Volver
            </button>
          </div>
          <RubricForm
            rubric={viewMode === "edit" ? selectedRubric! : undefined}
            isEditing={viewMode === "edit"}
            onSave={handleSaveRubric}
            onCancel={handleBackToTable}
            isLoading={isFormLoading}
          />
        </div>
      );
    }

    // Vista de tabla (por defecto)
    return (
      <div className="space-y-6">
        {/* Header con filtros */}
        <RubricTableHeader
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onCreateRubric={handleCreateRubric}
          onDeleteSelected={handleDeleteSelectedRubrics}
          selectedCount={selectedRubrics.length}
          totalCount={rubrics.length}
          isLoading={isLoading}
        />
        {/* Tabla de rúbricas */}
        <RubricTable
          rubrics={rubrics}
          selectedRubrics={selectedRubrics}
          onSelectRubric={selectRubric}
          onSelectAllRubrics={selectAllRubrics}
          onEditRubric={handleEditRubric}
          onDeleteRubric={handleDeleteRubric}
          onViewRubric={handleViewRubric}
          onActivateRubric={handleActivateRubric}
          onDeactivateRubric={handleDeactivateRubric}
          onCloneRubric={handleCloneRubric}
          isLoading={isLoading}
          isError={isError}
          errorMessage={errorMessage}
        />
      </div>
    );
  };

  return (
    <MainLayout gradientVariant="aurora">
      <div className="max-w-7xl mx-auto epilogue-uniquifier px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </div>

      {/* Dialog para eliminar rúbrica individual */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              ¿Estás seguro de que deseas eliminar la rúbrica{" "}
              <strong>"{rubricToDelete?.name}"</strong>? Esta acción no se puede deshacer y puede afectar evaluaciones relacionadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-foreground border border-line focus:outline-none">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRubric}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para eliminar múltiples rúbricas */}
      <AlertDialog
        open={isDeleteMultipleDialogOpen}
        onOpenChange={setIsDeleteMultipleDialogOpen}
      >
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmar eliminación múltiple</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              ¿Estás seguro de que deseas eliminar {selectedRubrics.length}{" "}
              rúbrica(s) seleccionada(s)? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-foreground border border-line focus:outline-none">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSelectedRubrics}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar {selectedRubrics.length} rúbrica(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default RubricsManagementScreen;