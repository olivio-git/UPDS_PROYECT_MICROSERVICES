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
import GradientWrapper from "@/components/background/GrandWrapperSection";
import { MainLayout } from "@/components/layout";
import { BarChart3 } from "lucide-react";
import { useState } from "react";
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
    if (viewMode === "create") {
      return (
        <LevelForm
          onSave={handleSaveLevel}
          onCancel={handleBackToTable}
          isLoading={isFormLoading}
        />
      );
    }

    if (viewMode === "edit" && selectedLevel) {
      return (
        <LevelForm
          level={selectedLevel}
          isEditing={true}
          onSave={handleSaveLevel}
          onCancel={handleBackToTable}
          isLoading={isFormLoading}
        />
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
      <div className="max-w-7xl mx-auto space-y-8 epilogue-uniquifier px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center space-y-3 mb-5">
          <div className="flex justify-center">
            <div className="p-2.5 rounded-full bg-gradient-to-br from-blue-500/15 to-purple-600/15 border border-blue-500/20">
              <BarChart3 className="h-3.5 w-3.5 text-blue-300" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Gestión de Niveles MCER</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Configure y administre los niveles del Marco Común Europeo de Referencia para las Lenguas
          </p>
        </div>

        <GradientWrapper
          intensity="low"
          size="xl"
          position="right"
          animate={false}
          variant="cosmic"
        >
          <div className="min-h-screen">{renderContent()}</div>
        </GradientWrapper>
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