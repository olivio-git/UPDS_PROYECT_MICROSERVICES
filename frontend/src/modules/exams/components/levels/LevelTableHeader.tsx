import { Plus, Search } from "lucide-react";

type FilterType = 'all' | 'active' | 'inactive';

interface LevelTableHeaderProps {
  onCreateLevel: () => void;
  totalCount: number;
  isLoading: boolean;
  currentFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
}

const LevelTableHeader = ({
  onCreateLevel,
  totalCount,
  isLoading,
  currentFilter,
  onFilterChange,
  searchTerm,
  onSearchChange
}: LevelTableHeaderProps) => {

  const filters: { value: FilterType; label: string }[] = [
    { value: 'all',      label: 'Todos' },
    { value: 'active',   label: 'Activos' },
    { value: 'inactive', label: 'Inactivos' },
  ];

  return (
    <div className="flex flex-col gap-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Niveles MCER</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLoading ? "Cargando..." : `${totalCount} nivel(es) configurado(s)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCreateLevel}
            className="h-8 flex items-center gap-1.5 px-3 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nuevo Nivel
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
            placeholder="Buscar niveles..."
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            className="h-7 pl-6 pr-2 text-xs bg-muted/60 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-44"
          />
        </div>

        <div className="w-px h-5 bg-border shrink-0" />

        {/* Status pills */}
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`h-7 px-2.5 text-xs rounded transition-colors ${
              currentFilter === f.value
                ? 'bg-blue-600 text-white'
                : 'bg-muted/50 border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {f.label}
            {currentFilter === f.value && ` (${totalCount})`}
          </button>
        ))}
      </div>
    </div>
  );
};

export default LevelTableHeader;
export type { FilterType };
