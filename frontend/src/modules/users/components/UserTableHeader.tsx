import React, { useState } from 'react';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select';
import { Search, Filter, Trash2, UserPlus, Download, Upload, X } from 'lucide-react';
import type { UserFilters, UserRole, UserStatus } from '../types/user.types';
import { USER_ROLES, USER_STATUSES } from '../types/user.types';

interface UserTableHeaderProps {
  filters: UserFilters;
  onFiltersChange: (filters: UserFilters) => void;
  onCreateUser: () => void;
  onDeleteSelected?: () => void;
  onExportUsers?: () => void;
  onImportUsers?: () => void;
  selectedCount?: number;
  totalCount?: number;
  isLoading?: boolean;
}

const UserTableHeader: React.FC<UserTableHeaderProps> = ({
  filters,
  onFiltersChange,
  onCreateUser,
  onDeleteSelected,
  onExportUsers,
  onImportUsers,
  selectedCount = 0,
  totalCount = 0,
  isLoading = false
}) => {
  const [showFilters, setShowFilters] = useState(true);

  const handleSearchChange = (value: string) => {
    onFiltersChange({
      ...filters,
      search: value || undefined,
      page: 1 // Reset a la primera página al buscar
    });
  };

  const handleRoleChange = (value: string) => {
    onFiltersChange({
      ...filters,
      role: value === 'all' ? undefined : (value as UserRole),
      page: 1
    });
  };

  const handleStatusChange = (value: string) => {
    onFiltersChange({
      ...filters,
      status: value === 'all' ? undefined : (value as UserStatus),
      page: 1
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      page: 1,
      limit: filters.limit,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    setShowFilters(false);
  };

  const hasActiveFilters = filters.search || filters.role || filters.status;

  return (
    <div className="space-y-4 bg-box border border-line rounded-lg p-4 text-gray-200">
      {/* Header principal */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between p-2">
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-200">
            Gestión de Usuarios
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {totalCount > 0 ? (
              <>
                Mostrando {totalCount} usuario{totalCount !== 1 ? 's' : ''}
                {selectedCount > 0 && (
                  <span className="text-blue-600 font-medium ml-2">
                    ({selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''})
                  </span>
                )}
              </>
            ) : (
              'Cargando usuarios...'
            )}
          </p>
        </div>

        <div className="flex gap-2">
          {/* Acciones de selección múltiple */}
          {selectedCount > 0 && (
            <>
              {onDeleteSelected && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={onDeleteSelected}
                  className="gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar ({selectedCount})
                </Button>
              )}
            </>
          )}

          {/* Acciones generales */}
          {onImportUsers && (
            <Button
              variant="outline"
              size="sm"
              onClick={onImportUsers}
              className="w-full bg-gradient-to-r from-green-500/10 to-emerald-600/30 border border-green-500/30 text-green-300 hover:from-green-500/30 hover:to-emerald-600/30"

            >
              <Upload className="w-4 h-4" />
              Importar
            </Button>
          )}

          {onExportUsers && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportUsers}
              className="bg-yellow-700/10 border-yellow-500/40 text-yellow-300 hover:bg-yellow-700/30"

            >
              <Download className="w-4 h-4" />
              Exportar
            </Button>
          )}

          <Button
            onClick={onCreateUser}
            size="sm"
            className="gap-1 bg-blue-600 hover:bg-blue-700"
            disabled={isLoading}
          >
            <UserPlus className="w-4 h-4" />
            Nuevo Usuario
          </Button>
        </div>
      </div>

      {/* Barra de búsqueda y filtros */}
      <div className="flex flex-col sm:flex-row gap-1 rounded-lg items-center justify-between px-1">
        {/* Búsqueda */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 focus:outline-none " />
          <Input
            placeholder="Buscar por nombre, email..."
            value={filters.search || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 pr-3 w-full bg-gray-800/50 border-gray-600 text-white placeholder-gray-400"
          />
        </div>

        {/* Botón de filtros */}
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className={`gap-1 bg-transparent border ${hasActiveFilters ? ' border text-white border-line' : 'text-white border-line'}`}
        >
          <Filter className="w-4 h-4" />
          Filtros
          {hasActiveFilters && (
            <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full ml-1">
              {[filters.search, filters.role, filters.status].filter(Boolean).length}
            </span>
          )}
        </Button>
      </div>

      {/* Panel de filtros expandido */}
      {showFilters && (
        <div className="border border-gray-200 rounded-lg p-4 space-y-4 border-line text-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium ">Filtros Avanzados</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(false)}
              className="h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Filtro por rol */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Rol</label>
              <Select value={filters.role || 'all'} onValueChange={handleRoleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los roles" />
                </SelectTrigger>
                <SelectContent className='bg-gray-900 border border-line'>
                  <SelectItem value="all">Todos los roles</SelectItem>
                  {USER_ROLES.map((role) => (
                    <SelectItem className="hover:bg-gray-800" key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por estado */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Estado</label>
              <Select value={filters.status || 'all'} onValueChange={handleStatusChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent className='bg-gray-900 border border-line'>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {USER_STATUSES.map((status) => (
                    <SelectItem className="hover:bg-gray-800" key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ordenamiento */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Ordenar por</label>
              <Select 
                value={`${filters.sortBy || 'createdAt'}-${filters.sortOrder || 'desc'}`} 
                onValueChange={(value) => {
                  const [sortBy, sortOrder] = value.split('-');
                  onFiltersChange({
                    ...filters,
                    sortBy: sortBy as UserFilters['sortBy'],
                    sortOrder: sortOrder as 'asc' | 'desc'
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">Más reciente</SelectItem>
                  <SelectItem value="createdAt-asc">Más antiguo</SelectItem>
                  <SelectItem value="firstName-asc">Nombre A-Z</SelectItem>
                  <SelectItem value="firstName-desc">Nombre Z-A</SelectItem>
                  <SelectItem value="email-asc">Email A-Z</SelectItem>
                  <SelectItem value="email-desc">Email Z-A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Acciones de filtros */}
          {hasActiveFilters && (
            <div className="flex justify-end pt-2 border-t border-line">
              <Button
                variant="outline"
                size="sm"
                onClick={clearFilters}
                className="gap-1"
              >
                <X className="w-4 h-4" />
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserTableHeader;
