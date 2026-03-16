import { Plus, Search, Trash2 } from "lucide-react";
import type { MCERLevel, ScoringType } from "../../constants/academic.constants";
import type { Competency } from "../../types";
import type { RubricFilters } from "../../types/rubrics.types";

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

  const hasActiveFilters = Object.values(filters).some(value =>
    value !== undefined && value !== '' && value !== null
  );

  const currentStatus =
    filters.isActive === true ? "active" :
    filters.isActive === false ? "inactive" :
    "all";

  return (
    <div className="flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Gestión de Rúbricas</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading ? "Cargando..." : `${totalCount} rúbrica(s) disponible(s)`}
            {selectedCount > 0 && ` · ${selectedCount} seleccionada(s)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <button
              onClick={onDeleteSelected}
              className="h-8 flex items-center gap-1.5 px-3 text-xs rounded-md border border-red-500/60 bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar ({selectedCount})
            </button>
          )}
          <button
            onClick={onCreateRubric}
            className="h-8 flex items-center gap-1.5 px-3 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva Rúbrica
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
            placeholder="Buscar rúbricas..."
            value={filters.search || ''}
            onChange={e => handleSearchChange(e.target.value)}
            className="h-7 pl-6 pr-2 text-xs bg-muted/60 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-44"
          />
        </div>

        <div className="w-px h-5 bg-border shrink-0" />

        {/* Competencia */}
        <select
          value={filters.competency || 'all'}
          onChange={e => handleCompetencyChange(e.target.value === 'all' ? undefined : e.target.value as Competency)}
          className="h-7 text-xs bg-muted/60 border border-border rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todas las competencias</option>
          <option value="reading">Comprensión Lectora</option>
          <option value="writing">Expresión Escrita</option>
          <option value="listening">Comprensión Auditiva</option>
          <option value="speaking">Expresión Oral</option>
        </select>

        {/* Nivel MCER */}
        <select
          value={filters.level || 'all'}
          onChange={e => handleLevelChange(e.target.value === 'all' ? undefined : e.target.value as MCERLevel)}
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

        {/* Tipo de evaluación */}
        <select
          value={filters.scoringType || 'all'}
          onChange={e => handleScoringTypeChange(e.target.value === 'all' ? undefined : e.target.value as ScoringType)}
          className="h-7 text-xs bg-muted/60 border border-border rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos los tipos</option>
          <option value="holistic">Holística</option>
          <option value="analytic">Analítica</option>
        </select>

        {/* Estado */}
        <select
          value={currentStatus}
          onChange={e => handleStatusChange(e.target.value)}
          className="h-7 text-xs bg-muted/60 border border-border rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="inactive">Inactivas</option>
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="h-7 px-2 text-xs rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
};

export default RubricTableHeader;
