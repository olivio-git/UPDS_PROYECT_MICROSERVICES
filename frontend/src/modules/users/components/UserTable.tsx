import React, { useMemo } from 'react';
import { UserAvatar } from '@/components/atoms/UserAvatar';
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
// import { Badge } from '@/components/atoms/badge';
import { Button } from '@/components/atoms/button';
import { Checkbox } from '@/components/atoms/checkbox';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/atoms/dropdown-menu';
import CustomizableTable from '@/components/common/CustomizableTable';
import { 
  MoreVertical,
  Edit,
  Trash2,
  UserCheck,
  UserX,
  Key,
  Shield,
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import type { User} from '../types/user.types';
// import { USER_STATUSES } from '../types/user.types';

interface UserTableProps {
  users: User[];
  selectedUsers: string[];
  onSelectUser: (userId: string) => void;
  onSelectAllUsers: (userIds: string[]) => void;
  onEditUser: (user: User) => void;
  onDeleteUser: (user: User) => void;
  onViewUser: (user: User) => void;
  onActivateUser: (user: User) => void;
  onDeactivateUser: (user: User) => void;
  onGeneratePassword: (user: User) => void;
  onAssignRole: (user: User) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  errorMessage?: string;
  sorting: SortingState;
  setSorting: (sorting: SortingState) => void;
  // Props para paginación
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
}

const columnHelper = createColumnHelper<User>();

const UserTable: React.FC<UserTableProps> = ({
  users,
  selectedUsers,
  onSelectUser,
  onSelectAllUsers,
  onEditUser,
  onDeleteUser,
  onViewUser,
  onActivateUser,
  onDeactivateUser,
  onGeneratePassword,
  onAssignRole,
  isLoading = false,
  isFetching = false,
  isError = false,
  errorMessage,
  sorting,
  setSorting,
  // Props de paginación
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  itemsPerPage = 10,
  onPageChange
}) => {
  // Debug: ver qué datos de paginación llegan
  console.log('UserTable pagination props:', {
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    onPageChange: !!onPageChange
  });

  // estilos base tipo "Questions"
  const badgeBase =
    "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium border rounded-lg";

  // colores por estado (ajusta a tus estados reales)
  const statusBadgeClasses: Record<string, string> = {
    active:    "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
    pending:   "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30",
    suspended: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",
    inactive:  "bg-muted/50 text-muted-foreground border-border/50",
    blocked:   "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30",
  };

  // colores por rol
  const roleBadgeClasses: Record<string, string> = {
    admin:   "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30",
    teacher: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30",
    proctor: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30",
    student: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30",
  };

  const columns = useMemo(() => [
    // Columna de selección
    columnHelper.display({
      id: 'select',
      size: 50,
      header: ({ table }) => (
        <div className='flex items-center justify-center w-full'>

        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(value) => {
            if (value) {
              onSelectAllUsers(users.map(user => user._id));
            } else {
              onSelectAllUsers([]);
            }
          }}
          aria-label="Seleccionar todos" 
        />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center w-full">

        <Checkbox
          checked={selectedUsers.includes(row.original._id)}
          onCheckedChange={() => onSelectUser(row.original._id)}
          aria-label={`Seleccionar usuario ${row.original.firstName}`}
          />
          </div>
      ),
      enableSorting: false,
    }),

    // Avatar y nombre
    columnHelper.accessor('firstName', {
      id: 'user',
      size: 200,
      header: 'Usuario',
      cell: ({ row }) => {
        const user = row.original;

        return (
          <div className="flex items-center gap-3">
            <UserAvatar
              avatarUrl={user.profile?.avatarUrl}
              firstName={user.firstName}
              lastName={user.lastName}
              size="sm"
            />
            <div>
              <p className="font-medium text-foreground">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-muted-foreground">
                {user.email}
              </p>
            </div>
          </div>
        );
      },
      enableSorting: true,
      enableResizing: true,
    }),

    // Rol
    columnHelper.accessor('role', {
      id: 'role',
      size: 120,
      header: 'Rol',
      cell: ({ getValue }) => {
        const role = String(getValue() ?? '').toLowerCase();
        const cls = roleBadgeClasses[role] ?? "bg-muted/50 text-muted-foreground border-border/50";
        const labelMap: Record<string, string> = {
          admin: 'Administrador',
          teacher: 'Profesor',
          proctor: 'Supervisor',
          student: 'Estudiante',
        };
        const label = labelMap[role] ?? role;

        return (
          <span className={`${badgeBase} ${cls}`}>{label}</span>
        );
      },
      enableSorting: true,
    }),


    // Estado
    columnHelper.accessor('status', {
      id: 'status',
      size: 120,
      header: 'Estado',
      cell: ({ getValue }) => {
        const status = String(getValue() ?? '').toLowerCase();
        const cls = statusBadgeClasses[status] ?? "bg-muted/50 text-muted-foreground border-border/50";

        // Si quieres usar etiquetas de USER_STATUSES:
        // const cfg = USER_STATUSES.find(s => s.value === status);
        // const label = cfg?.label ?? status;

        const labelMap: Record<string, string> = {
          active: 'Activo',
          pending: 'Pendiente',
          suspended: 'Suspendido',
          inactive: 'Inactivo',
          blocked: 'Bloqueado',
        };
        const label = labelMap[status] ?? status;

        return (
          <span className={`${badgeBase} ${cls}`}>{label}</span>
        );
      },
      enableSorting: true,
    }),


    // Información adicional
    columnHelper.display({
      id: 'info',
      size: 150,
      header: 'Información',
      cell: ({ row }) => {
        console.log(row,"row")
        const user = row.original;
        // const lastLogin = user.lastLogin 
        //   ? format(new Date(user.lastLogin), 'dd/MM/yyyy', { locale: es })
        //   : 'Nunca';
        
        return (
          <div className="text-sm">
            <p className="text-foreground">
              Tel: {user.profile?.phone || 'No registrado'}
            </p>
            {/* <p className="text-gray-500">
              Último acceso: {lastLogin}
            </p> */}
          </div>
        );
      },
      enableSorting: false,
    }),

    // Fecha de creación
    columnHelper.accessor('createdAt', {
      id: 'createdAt',
      size: 120,
      header: 'Creado',
      cell: ({ getValue }) => {
        const date = new Date(getValue());
        return (
          <div className="text-sm">
            <p className="text-foreground">
              {format(date, 'dd/MM/yyyy', { locale: es })}
            </p>
            <p className="text-muted-foreground">
              {format(date, 'HH:mm', { locale: es })}
            </p>
          </div>
        );
      },
      enableSorting: true,
      enableResizing: true,
    }),

    // Acciones
    columnHelper.display({
      id: 'actions',
      size: 60,
      header: 'Acciones',
      cell: ({ row }) => {
        const user = row.original;
        
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild className='bg-card border border-border rounded-md p-1 hover:bg-muted'>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4 text-foreground" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-popover border-border text-foreground">
              {/* Ver detalles */}
              <DropdownMenuItem className='hover:bg-muted' onClick={() => onViewUser(user)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver detalles
              </DropdownMenuItem>

              {/* Editar */}
              <DropdownMenuItem className='hover:bg-muted' onClick={() => onEditUser(user)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Asignar rol */}
              <DropdownMenuItem className='hover:bg-muted' onClick={() => onAssignRole(user)}>
                <Shield className="mr-2 h-4 w-4" />
                Asignar rol
              </DropdownMenuItem>

              {/* Generar contraseña */}
              <DropdownMenuItem className='hover:bg-muted' onClick={() => onGeneratePassword(user)}>
                <Key className="mr-2 h-4 w-4" />
                Nueva contraseña
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Activar/Desactivar */}
              {user.status === 'active' ? (
                <DropdownMenuItem
                  onClick={() => onDeactivateUser(user)}
                  className="text-orange-600 hover:bg-muted"
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Desactivar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  onClick={() => onActivateUser(user)}
                  className="text-green-600 hover:bg-muted"
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Activar
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {/* Eliminar */}
              <DropdownMenuItem
                onClick={() => onDeleteUser(user)}
                className="text-red-600 hover:bg-muted"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: true,
      enableResizing: true,
    }),
  ], [users, selectedUsers, onSelectUser, onSelectAllUsers]);

  const table = useReactTable({
    data: users,
    columns,
    state: {
      sorting,
    },
    onSortingChange: (updaterOrValue) => {
      if (typeof updaterOrValue === 'function') {
        setSorting(updaterOrValue(table.getState().sorting));
      } else {
        setSorting(updaterOrValue);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true, // El sorting se maneja en el servidor
    columnResizeMode: "onChange",

  });

  return (
    <div className="overflow-hidden">
      <CustomizableTable
        table={table}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        errorMessage={errorMessage}
        noDataMessage="No se encontraron usuarios con los filtros aplicados"
        rows={10}
      />

      {/* Paginación - Debug: siempre mostrar si hay datos */}
      {totalItems > 0 && onPageChange && (
        <div className="px-6 py-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a{' '}
            {Math.min(currentPage * itemsPerPage, totalItems)} de {totalItems}{' '}
            usuarios
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 bg-muted/50 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>

            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const page = i + 1;
                return (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      page === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'bg-muted/50 border border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 bg-muted/50 border border-border rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserTable;
