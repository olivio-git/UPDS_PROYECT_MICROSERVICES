import { NativeSelect, NativeSelectOption } from '@/components/keel/native-select';
import { Input } from '@/components/keel/input';
import { Button } from '@/components/keel/button';
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
    <div className="flex shrink-0 flex-col gap-3">

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
            <Button
              variant="destructive"
              size="sm"
              onClick={onDeleteSelected}
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar ({selectedCount})
            </Button>
          )}
          <Button
            size="sm"
            onClick={onCreateRubric}
          >
            <Plus className="w-3.5 h-3.5" /> Nueva Rúbrica
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-card border border-border px-3 py-2 flex flex-wrap items-center gap-2 rounded-xl">

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            placeholder="Buscar rúbricas..."
            value={filters.search || ''}
            onChange={e => handleSearchChange(e.target.value)}
            className="w-44 h-7 pl-6 pr-2 text-xs"
          />
        </div>

        <div className="w-px h-5 bg-border shrink-0" />

        {/* Competencia */}
        <NativeSelect size="sm" className="text-xs w-auto"
          value={filters.competency || 'all'}
          onChange={e => handleCompetencyChange(e.target.value === 'all' ? undefined : e.target.value as Competency)}
        >
          <NativeSelectOption value="all">Todas las competencias</NativeSelectOption>
          <NativeSelectOption value="reading">Comprensión Lectora</NativeSelectOption>
          <NativeSelectOption value="writing">Expresión Escrita</NativeSelectOption>
          <NativeSelectOption value="listening">Comprensión Auditiva</NativeSelectOption>
          <NativeSelectOption value="speaking">Expresión Oral</NativeSelectOption>
        </NativeSelect>

        {/* Nivel MCER */}
        <NativeSelect size="sm" className="text-xs w-auto"
          value={filters.level || 'all'}
          onChange={e => handleLevelChange(e.target.value === 'all' ? undefined : e.target.value as MCERLevel)}
        >
          <NativeSelectOption value="all">Todos los niveles</NativeSelectOption>
          <NativeSelectOption value="A1">A1</NativeSelectOption>
          <NativeSelectOption value="A2">A2</NativeSelectOption>
          <NativeSelectOption value="B1">B1</NativeSelectOption>
          <NativeSelectOption value="B2">B2</NativeSelectOption>
          <NativeSelectOption value="C1">C1</NativeSelectOption>
          <NativeSelectOption value="C2">C2</NativeSelectOption>
        </NativeSelect>

        {/* Tipo de evaluación */}
        <NativeSelect size="sm" className="text-xs w-auto"
          value={filters.scoringType || 'all'}
          onChange={e => handleScoringTypeChange(e.target.value === 'all' ? undefined : e.target.value as ScoringType)}
        >
          <NativeSelectOption value="all">Todos los tipos</NativeSelectOption>
          <NativeSelectOption value="holistic">Holística</NativeSelectOption>
          <NativeSelectOption value="analytic">Analítica</NativeSelectOption>
        </NativeSelect>

        {/* Estado */}
        <NativeSelect size="sm" className="text-xs w-auto"
          value={currentStatus}
          onChange={e => handleStatusChange(e.target.value)}
        >
          <NativeSelectOption value="all">Todos los estados</NativeSelectOption>
          <NativeSelectOption value="active">Activas</NativeSelectOption>
          <NativeSelectOption value="inactive">Inactivas</NativeSelectOption>
        </NativeSelect>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
          >
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
};

export default RubricTableHeader;
