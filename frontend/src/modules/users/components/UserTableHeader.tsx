import { Button } from '@/components/atoms/button';
import { Calendar } from '@/components/atoms/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, Search, Trash2, Upload, UserPlus, X } from 'lucide-react';
import React, { useState } from 'react';
import type { DateRange } from 'react-day-picker';
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
  onImportUsers,
  selectedCount = 0,
  totalCount = 0,
  isLoading = false,
}) => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    filters.dateFrom
      ? { from: new Date(filters.dateFrom), to: filters.dateTo ? new Date(filters.dateTo) : undefined }
      : undefined
  );

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value || undefined, page: 1 });
  };

  const handleRoleChange = (value: string) => {
    onFiltersChange({ ...filters, role: value === 'all' ? undefined : (value as UserRole), page: 1 });
  };

  const handleStatusChange = (value: string) => {
    onFiltersChange({ ...filters, status: value === 'all' ? undefined : (value as UserStatus), page: 1 });
  };

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    onFiltersChange({
      ...filters,
      dateFrom: range?.from ? format(range.from, 'yyyy-MM-dd') : undefined,
      dateTo: range?.to ? format(range.to, 'yyyy-MM-dd') : undefined,
      page: 1,
    });
  };

  const handleClear = () => {
    setDateRange(undefined);
    onFiltersChange({ page: 1, limit: filters.limit, sortBy: 'createdAt', sortOrder: 'desc' });
  };

  const hasActiveFilters = filters.search || filters.role || filters.status || filters.dateFrom;

  return (
    <div className="flex flex-col gap-3 shrink-0">

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Usuarios</h1>
          <p className="text-xs text-muted-foreground">
            {totalCount > 0 ? `${totalCount} usuario${totalCount !== 1 ? 's' : ''}` : 'Cargando...'}
            {selectedCount > 0 && (
              <span className="text-blue-400 ml-1.5">· {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 && onDeleteSelected && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDeleteSelected}
              className="h-8 text-xs gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Eliminar ({selectedCount})
            </Button>
          )}
          {onImportUsers && (
            <Button
              variant="outline"
              size="sm"
              onClick={onImportUsers}
              className="h-8 text-xs gap-1 border-border text-foreground hover:bg-muted"
            >
              <Upload className="h-3.5 w-3.5" />
              Importar
            </Button>
          )}
          <Button
            onClick={onCreateUser}
            size="sm"
            disabled={isLoading}
            className="h-8 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Nuevo usuario
          </Button>
        </div>
      </div>

      {/* Filter bar — audit-logs style */}
      <div className="bg-card border border-border rounded-lg px-3 py-2 flex flex-wrap items-center gap-2">

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar nombre, email..."
            value={filters.search || ''}
            onChange={e => handleSearchChange(e.target.value)}
            className="h-7 pl-6 pr-2 text-xs bg-muted/60 border border-border rounded text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring w-48"
          />
        </div>

        <div className="w-px h-5 bg-border shrink-0" />

        {/* Role */}
        <select
          value={filters.role || 'all'}
          onChange={e => handleRoleChange(e.target.value)}
          className="h-7 text-xs bg-muted/60 border border-border rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos los roles</option>
          {USER_ROLES.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>

        {/* Status */}
        <select
          value={filters.status || 'all'}
          onChange={e => handleStatusChange(e.target.value)}
          className="h-7 text-xs bg-muted/60 border border-border rounded px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">Todos los estados</option>
          {USER_STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <div className="w-px h-5 bg-border shrink-0" />

        {/* Date range */}
        <Popover>
          <PopoverTrigger asChild>
            <button className={cn(
              'h-7 flex items-center gap-1.5 px-2 text-xs rounded border border-border bg-muted/60 text-foreground hover:bg-muted transition-colors whitespace-nowrap',
              !dateRange?.from && 'text-muted-foreground'
            )}>
              <CalendarIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
              {dateRange?.from ? (
                dateRange.to
                  ? <>{format(dateRange.from, 'd MMM', { locale: es })} — {format(dateRange.to, 'd MMM yyyy', { locale: es })}</>
                  : format(dateRange.from, 'd MMM yyyy', { locale: es })
              ) : 'Fecha registro'}
              {dateRange?.from && (
                <span
                  role="button"
                  onClick={e => { e.stopPropagation(); handleDateRangeChange(undefined); }}
                  className="ml-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={handleDateRangeChange}
              numberOfMonths={2}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Clear */}
        {hasActiveFilters && (
          <Button
            onClick={handleClear}
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-foreground hover:bg-muted px-2 ml-auto"
          >
            Limpiar
          </Button>
        )}
      </div>
    </div>
  );
};

export default UserTableHeader;
