import { Button } from "@/components/atoms/button";
import { Input } from "@/components/atoms/input";
import { Download, Plus, Search, Upload } from "lucide-react";
import { useState } from "react";

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

  const handleExport = () => {
    // TODO: Implementar exportación
    console.log("Exportar niveles");
  };

  const handleImport = () => {
    // TODO: Implementar importación
    console.log("Importar niveles");
  };

  return (
    <div className="bg-box/50 backdrop-blur-sm border border-line rounded-xl p-6 bg-box">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Título y contador */}
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-gray-200">
            Niveles MCER
          </h2>
          <p className="text-sm text-gray-400">
            {isLoading ? "Cargando..." : `${totalCount} nivel(es) configurado(s)`}
          </p>
        </div>

        {/* Acciones principales */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar niveles..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 bg-input border-line text-gray-300 w-full sm:w-64"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="bg-transparent border-line text-gray-300 hover:bg-line/50"
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleImport}
              className="bg-transparent border-line text-gray-300 hover:bg-line/50"
            >
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>

            <Button
              onClick={onCreateLevel}
              size="sm"
              className="hover:from-blue-700 hover:to-purple-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Nivel
            </Button>
          </div>
        </div>
      </div>

      {/* Filtros rápidos */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onFilterChange('all')}
          className={`text-xs ${
            currentFilter === 'all'
              ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
              : 'bg-transparent border-line text-gray-400 hover:bg-line/50'
          }`}
        >
          Todos {currentFilter === 'all' ? `(${totalCount})` : ''}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onFilterChange('active')}
          className={`text-xs ${
            currentFilter === 'active'
              ? 'bg-green-500/20 border-green-500/50 text-green-300'
              : 'bg-transparent border-line text-gray-400 hover:bg-line/50'
          }`}
        >
          Activos {currentFilter === 'active' ? `(${totalCount})` : ''}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onFilterChange('inactive')}
          className={`text-xs ${
            currentFilter === 'inactive'
              ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
              : 'bg-transparent border-line text-gray-400 hover:bg-line/50'
          }`}
        >
          Inactivos {currentFilter === 'inactive' ? `(${totalCount})` : ''}
        </Button>
      </div>
    </div>
  );
};

export default LevelTableHeader;
export type { FilterType };