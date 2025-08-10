import React, { useMemo } from 'react';
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/atoms/badge';
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
  Mail,
  Eye
} from 'lucide-react';
import type { User, UserRole, UserStatus } from '../types/user.types';
import { USER_STATUSES } from '../types/user.types';

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
  onSendEmail: (user: User) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  errorMessage?: string;
  sorting: SortingState;
  setSorting: (sorting: SortingState) => void;
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
  onSendEmail,
  isLoading = false,
  isFetching = false,
  isError = false,
  errorMessage,
  sorting,
  setSorting
}) => {
  
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
        const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
        
        return (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              {user.profile?.avatar ? (
                <img 
                  src={user.profile.avatar} 
                  alt={`${user.firstName} ${user.lastName}`}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <span className="text-blue-600 text-sm font-medium">
                  {initials}
                </span>
              )}
            </div>
            <div>
              <p className="font-medium text-gray-200">
                {user.firstName} {user.lastName}
              </p>
              <p className="text-sm text-gray-500">
                {user.email}
              </p>
            </div>
          </div>
        );
      },
      enableSorting: true,
    }),

    // Rol
    columnHelper.accessor('role', {
      id: 'role',
      size: 120,
      header: 'Rol',
      cell: ({ getValue }) => {
        const role = getValue() as UserRole;
        const roleConfig = {
          admin: { label: 'Administrador', color: 'bg-purple-100 text-purple-800' },
          teacher: { label: 'Profesor', color: 'bg-green-100 text-green-800' },
          proctor: { label: 'Supervisor', color: 'bg-orange-100 text-orange-800' },
          student: { label: 'Estudiante', color: 'bg-blue-100 text-blue-800' },
        };
        
        const config = roleConfig[role];
        return (
          <Badge className={config.color}>
            {config.label}
          </Badge>
        );
      },
      enableSorting: true,
    }),

    // Estado
    columnHelper.accessor('status', {
      id: 'status',
      size: 100,
      header: 'Estado',
      cell: ({ getValue }) => {
        const status = getValue() as UserStatus;
        const statusConfig = USER_STATUSES.find(s => s.value === status);
        
        return (
          <Badge className={`${statusConfig?.color} px-2 py-1 text-xs`}>
            {statusConfig?.label || status}
          </Badge>
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
            <p className="text-gray-200">
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
            <p className="text-gray-200">
              {format(date, 'dd/MM/yyyy', { locale: es })}
            </p>
            <p className="text-gray-500">
              {format(date, 'HH:mm', { locale: es })}
            </p>
          </div>
        );
      },
      enableSorting: true,
    }),

    // Acciones
    columnHelper.display({
      id: 'actions',
      size: 60,
      header: '',
      cell: ({ row }) => {
        const user = row.original;
        
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild className='bg-box border border-line rounded-md p-1 hover:bg-gray-800'>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4 text-white" />
                <span className="sr-only">Abrir menú</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-box border-line text-gray-200">
              {/* Ver detalles */}
              <DropdownMenuItem className='hover:bg-gray-800' onClick={() => onViewUser(user)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver detalles
              </DropdownMenuItem>
              
              {/* Editar */}
              <DropdownMenuItem className='hover:bg-gray-800' onClick={() => onEditUser(user)}>
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>

              {/* Enviar email */}
              <DropdownMenuItem className='hover:bg-gray-800' onClick={() => onSendEmail(user)}>
                <Mail className="mr-2 h-4 w-4" />
                Enviar email
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Asignar rol */}
              <DropdownMenuItem className='hover:bg-gray-800' onClick={() => onAssignRole(user)}>
                <Shield className="mr-2 h-4 w-4" />
                Asignar rol
              </DropdownMenuItem>

              {/* Generar contraseña */}
              <DropdownMenuItem className='hover:bg-gray-800' onClick={() => onGeneratePassword(user)}>
                <Key className="mr-2 h-4 w-4" />
                Nueva contraseña
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* Activar/Desactivar */}
              {user.status === 'active' ? (
                <DropdownMenuItem 
                  onClick={() => onDeactivateUser(user)}
                  className="text-orange-600 hover:bg-gray-800"
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Desactivar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem 
                  onClick={() => onActivateUser(user)}
                  className="text-green-600 hover:bg-gray-800"
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Activar
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {/* Eliminar */}
              <DropdownMenuItem 
                onClick={() => onDeleteUser(user)}
                className="text-red-600 hover:bg-gray-800"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      enableSorting: false,
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
  });

  return (
    <div className="bg-box border border-line rounded-lg shadow-sm">
      <CustomizableTable
        table={table}
        isLoading={isLoading}
        isFetching={isFetching}
        isError={isError}
        errorMessage={errorMessage}
        noDataMessage="No se encontraron usuarios con los filtros aplicados"
        rows={10}
      />
    </div>
  );
};

export default UserTable;
