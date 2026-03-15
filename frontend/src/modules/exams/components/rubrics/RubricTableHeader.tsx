import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/atoms/select";
import { Download, Filter, Plus, Search, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import type { MCERLevel, ScoringType } from "../../constants/academic.constants";
import type { Competency } from "../../types";
import type { RubricFilters } from "../../types/rubrics.types";
import CompetencySelector from "../shared/CompetencySelector";
import MCERLevelSelector from "../shared/MCERLevelSelector";

interface RubricTableHeaderProps {
  filters: RubricFilters;
  onFiltersChange: (filters: RubricFilters) => void;
  onCreateRubric: () => void;
  onDeleteSelected: () => void;
  selectedCount: number;
  totalCount: number;
  isLoading: boolean;
}

const RubricTableHeader = ({
  filters,
  onFiltersChange,
  onCreateRubric,
  onDeleteSelected,
  selectedCount,
  totalCount,
  isLoading
}: RubricTableHeaderProps) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const handleSearchChange = (search: string) => {
    onFiltersChange({ ...filters, search });
  };

  const handleCompetencyChange = (competency: Competency | undefined) => {
    onFiltersChange({ ...filters, competency });
  };

  const handleLevelChange = (level: MCERLevel | undefined) => {
    onFiltersChange({ ...filters, level });
  };

  const handleScoringTypeChange = (scoringType: ScoringType | undefined) => {
    onFiltersChange({ ...filters, scoringType });
  };

  const handleStatusChange = (status: string) => {
    const isActive = status === "active" ? true : status === "inactive" ? false : undefined;
    onFiltersChange({ ...filters, isActive });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  const handleExport = () => {
    // TODO: Implementar exportación
    console.log("Exportar rúbricas");
  };

  const handleImport = () => {
    // TODO: Implementar importación
    console.log("Importar rúbricas");
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value !== undefined && value !== '' && value !== null
  );

  return (
    <div className="bg-box backdrop-blur-sm border border-line rounded-xl p-6 space-y-4">
      {/* Header principal */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Título y contador */}
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            Gestión de Rúbricas
          </h2>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Cargando..." : `${totalCount} rúbrica(s) disponible(s)`}
            {selectedCount > 0 && ` • ${selectedCount} seleccionada(s)`}
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar rúbricas..."
              value={filters.search || ''}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-10 bg-input border-line text-foreground w-full sm:w-64"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`bg-transparent border-line text-muted-foreground hover:bg-line/50 ${
                hasActiveFilters ? 'border-blue-500 text-blue-300' : ''
              }`}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>

            {selectedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDeleteSelected}
                className="bg-transparent border-red-500 text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar ({selectedCount})
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="bg-transparent border-line text-muted-foreground hover:bg-line/50"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              className="bg-transparent border-line text-muted-foreground hover:bg-line/50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>

            <Button
              onClick={onCreateRubric}
              size="sm"
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Rúbrica
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros avanzados */}
      {showAdvancedFilters && (
        <div className="border-t border-line pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Filtro por competencia */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Competencia</label>
              <CompetencySelector
                value={filters.competency}
                onValueChange={handleCompetencyChange}
                placeholder="Todas las competencias"
              />
            </div>

            {/* Filtro por nivel MCER */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Nivel MCER</label>
              <MCERLevelSelector
                value={filters.level}
                onValueChange={handleLevelChange}
                placeholder="Todos los niveles"
                showDescriptions={false}
              />
            </div>

            {/* Filtro por tipo de scoring */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Tipo de Evaluación</label>
              <Select
                value={filters.scoringType}
                onValueChange={handleScoringTypeChange}
              >
                <SelectTrigger className="bg-input border-line text-foreground">
                  <SelectValue placeholder="Todos los tipos" />
                </SelectTrigger>
                <SelectContent className="bg-box border-line">
                  <SelectItem 
                    value="holistic"
                    className="text-foreground hover:bg-line/50 focus:bg-line/50"
                  >
                    Holística
                  </SelectItem>
                  <SelectItem 
                    value="analytic"
                    className="text-foreground hover:bg-line/50 focus:bg-line/50"
                  >
                    Analítica
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por estado */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Estado</label>
              <Select
                value={
                  filters.isActive === true ? "active" : 
                  filters.isActive === false ? "inactive" : 
                  "all"
                }
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="bg-input border-line text-foreground">
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent className="bg-box border-line">
                  <SelectItem 
                    value="all"
                    className="text-foreground hover:bg-line/50 focus:bg-line/50"
                  >
                    Todos los estados
                  </SelectItem>
                  <SelectItem 
                    value="active"
                    className="text-foreground hover:bg-line/50 focus:bg-line/50"
                  >
                    Activas
                  </SelectItem>
                  <SelectItem 
                    value="inactive"
                    className="text-foreground hover:bg-line/50 focus:bg-line/50"
                  >
                    Inactivas
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botón para limpiar filtros */}
          {hasActiveFilters && (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Filtros rápidos */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          className="bg-transparent border-line text-muted-foreground hover:bg-line/50 text-xs"
        >
          Todas ({totalCount})
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-transparent border-line text-muted-foreground hover:bg-line/50 text-xs"
        >
          Activas
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-transparent border-line text-muted-foreground hover:bg-line/50 text-xs"
        >
          Por Competencia
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="bg-transparent border-line text-muted-foreground hover:bg-line/50 text-xs"
        >
          Recientes
        </Button>
      </div>
    </div>
  );
};

export default RubricTableHeader;