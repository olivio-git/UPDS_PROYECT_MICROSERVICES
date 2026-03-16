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
import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import LevelForm from "../components/levels/LevelForm";
import LevelTable from "../components/levels/LevelTable";
import LevelTableHeader, { type FilterType } from "../components/levels/LevelTableHeader";
import { useLevels } from "../hooks/useLevels";
import type { MCERLevelDefinition } from "../types/levels.types";

type ViewMode = "table" | "create" | "edit";

const LevelsManagementScreen = () => {
  // Estados de UI
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [selectedLevel, setSelectedLevel] = useState<MCERLevelDefinition | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [levelToDelete, setLevelToDelete] = useState<MCERLevelDefinition | null>(null);
  const [isFormLoading, setIsFormLoading] = useState(false);

  // Estados para filtrado y búsqueda
  const [currentFilter, setCurrentFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Preparar filtros para el hook
  const getLevelsFilters = () => {
    const filters: any = {};

    if (currentFilter === 'active') {
      filters.isActive = true;
    } else if (currentFilter === 'inactive') {
      filters.isActive = false;
    }
    // Para 'all' no enviamos isActive

    if (searchTerm.trim()) {
      filters.search = searchTerm.trim();
    }

    return Object.keys(filters).length > 0 ? filters : undefined;
  };

  // Hook de niveles
  const {
    levels,
    isLoading,
    isError,
    errorMessage,
    refreshLevels,
    loadLevels,
    createLevel,
    updateLevel,
    deleteLevel,
    activateLevel,
    deactivateLevel,
  } = useLevels();

  // Manejadores de navegación
  const handleCreateLevel = () => {
    setSelectedLevel(null);
    setViewMode("create");
  };

  const handleEditLevel = (level: MCERLevelDefinition) => {
    setSelectedLevel(level);
    setViewMode("edit");
  };

  const handleViewLevel = (level: MCERLevelDefinition) => {
    setSelectedLevel(level);
    setViewMode("edit");
  };

  const handleBackToTable = () => {
    setSelectedLevel(null);
    setViewMode("table");
  };

  // Manejadores CRUD
  const handleSaveLevel = async (levelData: Omit<MCERLevelDefinition, '_id' | 'createdAt' | 'updatedAt'>) => {
    setIsFormLoading(true);
    try {
      let success = false;

      if (viewMode === "create") {
        success = await createLevel(levelData);
        if (success) {
          toast.success("Nivel MCER creado exitosamente");
          handleBackToTable();
        }
      } else if (viewMode === "edit" && selectedLevel) {
        success = await updateLevel(selectedLevel._id!, levelData);
        if (success) {
          toast.success("Nivel MCER actualizado exitosamente");
          refreshLevels();
          handleBackToTable();
        }
      }
    } catch (error) {
      console.error("Error saving level:", error);
    } finally {
      setIsFormLoading(false);
    }
  };

  const handleDeleteLevel = (level: MCERLevelDefinition) => {
    setLevelToDelete(level);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteLevel = async () => {
    if (!levelToDelete) return;

    const success = await deleteLevel(levelToDelete._id!);
    if (success) {
      toast.success(`Nivel ${levelToDelete.code} eliminado`);
    }

    setIsDeleteDialogOpen(false);
    setLevelToDelete(null);
  };

  // Manejadores para filtros - ahora llaman al backend
  const handleFilterChange = (filter: FilterType) => {
    setCurrentFilter(filter);
    // Aplicar filtros inmediatamente
    const newFilters = getLevelsFilters();
    // Actualizar el filtro antes de hacer la petición
    if (filter === 'active') {
      loadLevels({ isActive: true, search: searchTerm.trim() || undefined });
    } else if (filter === 'inactive') {
      loadLevels({ isActive: false, search: searchTerm.trim() || undefined });
    } else {
      loadLevels({ search: searchTerm.trim() || undefined });
    }
  };

  const handleSearchChange = (search: string) => {
    setSearchTerm(search);
    // Aplicar búsqueda con filtro actual
    const filters: any = {};
    if (currentFilter === 'active') {
      filters.isActive = true;
    } else if (currentFilter === 'inactive') {
      filters.isActive = false;
    }
    if (search.trim()) {
      filters.search = search.trim();
    }
    loadLevels(Object.keys(filters).length > 0 ? filters : undefined);
  };

  // Manejadores de acciones específicas
  const handleActivateLevel = async (level: MCERLevelDefinition) => {
    const success = await activateLevel(level._id!);
    if (success) {
      toast.success(`Nivel ${level.code} activado`);
    }
  };

  const handleDeactivateLevel = async (level: MCERLevelDefinition) => {
    const success = await deactivateLevel(level._id!);
    if (success) {
      toast.success(`Nivel ${level.code} desactivado`);
    }
  };

  // Renderizar contenido según el modo de vista
  const renderContent = () => {
    if (viewMode === "create" || (viewMode === "edit" && selectedLevel)) {
      return (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">
              {viewMode === "edit" ? "Editar Nivel MCER" : "Nuevo Nivel MCER"}
            </h2>
            <button
              onClick={handleBackToTable}
              className="px-3 py-2 bg-muted/50 border border-border rounded-lg text-muted-foreground hover:bg-muted flex items-center gap-2 text-sm"
            >
              <X className="w-4 h-4" /> Volver
            </button>
          </div>
          <LevelForm
            level={viewMode === "edit" ? selectedLevel! : undefined}
            isEditing={viewMode === "edit"}
            onSave={handleSaveLevel}
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
        <LevelTableHeader
          onCreateLevel={handleCreateLevel}
          totalCount={levels.length}
          isLoading={isLoading}
          currentFilter={currentFilter}
          onFilterChange={handleFilterChange}
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
        />
        {/* Tabla de niveles */}
        <LevelTable
          levels={levels}
          onEditLevel={handleEditLevel}
          onDeleteLevel={handleDeleteLevel}
          onViewLevel={handleViewLevel}
          onActivateLevel={handleActivateLevel}
          onDeactivateLevel={handleDeactivateLevel}
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

      {/* Dialog para eliminar nivel */}
      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent className="bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              ¿Estás seguro de que deseas eliminar el nivel{" "}
              <strong>{levelToDelete?.code}</strong>? Esta acción no se puede deshacer y puede afectar preguntas y exámenes relacionados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent text-foreground border border-line focus:outline-none">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteLevel}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default LevelsManagementScreen;