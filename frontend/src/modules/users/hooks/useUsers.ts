import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { userService } from '../services/userService';
import type { 
  User, 
  UserFilters, 
  PaginatedUsersResponse, 
  CreateUserRequest, 
  UpdateUserRequest 
} from '../types/user.types';

interface UseUsersReturn {
  // Estado de datos
  users: User[];
  totalUsers: number;
  pagination: PaginatedUsersResponse['pagination'] | null;
  
  // Estado de UI
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage: string;
  
  // Filtros y paginación
  filters: UserFilters;
  setFilters: (filters: UserFilters) => void;
  
  // Selección múltiple
  selectedUsers: string[];
  setSelectedUsers: (users: string[]) => void;
  selectUser: (userId: string) => void;
  selectAllUsers: (userIds: string[]) => void;
  clearSelection: () => void;
  
  // Acciones CRUD
  refreshUsers: () => Promise<void>;
  createUser: (userData: CreateUserRequest) => Promise<boolean>;
  updateUser: (id: string, userData: UpdateUserRequest) => Promise<boolean>;
  deleteUser: (id: string) => Promise<boolean>;
  deleteSelectedUsers: () => Promise<boolean>;
  
  // Acciones específicas
  activateUser: (id: string) => Promise<boolean>;
  deactivateUser: (id: string) => Promise<boolean>;
  generateTemporaryPassword: (id: string, sendByEmail?: boolean) => Promise<boolean>;
  
  // Utilidades
  getUserById: (id: string) => User | undefined;
  resetState: () => void;
}

const initialFilters: UserFilters = {
  page: 1,
  limit: 10,
  sortBy: 'createdAt',
  sortOrder: 'desc'
};

export const useUsers = (): UseUsersReturn => {
  // Estado de datos
  const [users, setUsers] = useState<User[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [pagination, setPagination] = useState<PaginatedUsersResponse['pagination'] | null>(null);
  
  // Estado de UI
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Filtros y paginación
  const [filters, setFilters] = useState<UserFilters>(initialFilters);
  
  // Selección múltiple
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Función para obtener usuarios
  const fetchUsers = useCallback(async (showLoading = true) => {
    try {
      if (showLoading && users.length === 0) {
        setIsLoading(true);
      } else {
        setIsFetching(true);
      }
      
      setIsError(false);
      setErrorMessage('');

      const response = await userService.getUsers(filters);  
      if (response.success && response.data) {
        setUsers(response.data.users);
        setTotalUsers(response.data.pagination.total);
        setPagination(response.data.pagination);
      } else {
        throw new Error(response.message || 'Error obteniendo usuarios');
      }
    } catch (error: any) {
      console.error('Error fetching users:', error);
      setIsError(true);
      setErrorMessage(error.message || 'Error al cargar usuarios');
      setUsers([]);
      setTotalUsers(0);
      setPagination(null);
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [filters, users.length]);

  // Cargar usuarios cuando cambien los filtros
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Función para refrescar usuarios
  const refreshUsers = useCallback(async () => {
    await fetchUsers(false);
  }, [fetchUsers]);

  // Crear usuario
  const createUser = useCallback(async (userData: CreateUserRequest): Promise<boolean> => {
    try {
      const response = await userService.createUser(userData);
      
      if (response.success) {
        await refreshUsers();
        return true;
      } else {
        throw new Error(response.message);
      }
    } catch (error: any) {
      console.error('Error creating user:', error);
      return false;
    }
  }, [refreshUsers]);

  // Actualizar usuario
  const updateUser = useCallback(async (id: string, userData: UpdateUserRequest): Promise<boolean> => {
    try {
      const response = await userService.updateUser(id, userData);
      
      if (response.success) {
        // Actualizar el usuario en el estado local
        setUsers(prev => prev.map(user => 
          user._id === id ? { ...user, ...response.data } : user
        ));
        return true;
      } else {
        throw new Error(response.message);
      }
    } catch (error: any) {
      console.error('Error updating user:', error);
      return false;
    }
  }, []);

  // Eliminar usuario
  const deleteUser = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await userService.deleteUser(id);
      
      if (response.success) {
        await refreshUsers();
        // Remover de selección si estaba seleccionado
        setSelectedUsers(prev => prev.filter(userId => userId !== id));
        return true;
      } else {
        throw new Error(response.message);
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      return false;
    }
  }, [refreshUsers]);

  // Eliminar usuarios seleccionados
  const deleteSelectedUsers = useCallback(async (): Promise<boolean> => {
    if (selectedUsers.length === 0) {
      toast.warning('No hay usuarios seleccionados');
      return false;
    }

    try {
      let successCount = 0;
      let errorCount = 0;

      // Eliminar uno por uno (se podría optimizar con eliminación en lote)
      for (const userId of selectedUsers) {
        const success = await deleteUser(userId);
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(`${successCount} usuario(s) eliminado(s) exitosamente`);
        clearSelection();
      }

      if (errorCount > 0) {
        toast.error(`Error eliminando ${errorCount} usuario(s)`);
      }

      return successCount > 0;
    } catch (error) {
      console.error('Error deleting selected users:', error);
      toast.error('Error eliminando usuarios seleccionados');
      return false;
    }
  }, [selectedUsers, deleteUser]);

  // Activar usuario
  const activateUser = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await userService.activateUser(id);
      
      if (response.success) {
        // Actualizar el estado en el usuario local
        setUsers(prev => prev.map(user => 
          user._id === id ? { ...user, status: 'active' } : user
        ));
        return true;
      } else {
        throw new Error(response.message);
      }
    } catch (error: any) {
      console.error('Error activating user:', error);
      return false;
    }
  }, []);

  // Desactivar usuario
  const deactivateUser = useCallback(async (id: string): Promise<boolean> => {
    try {
      const response = await userService.deactivateUser(id);
      
      if (response.success) {
        // Actualizar el estado en el usuario local
        setUsers(prev => prev.map(user => 
          user._id === id ? { ...user, status: 'inactive' } : user
        ));
        return true;
      } else {
        throw new Error(response.message);
      }
    } catch (error: any) {
      console.error('Error deactivating user:', error);
      return false;
    }
  }, []);

  // Generar contraseña temporal
  const generateTemporaryPassword = useCallback(async (id: string, sendByEmail = true): Promise<boolean> => {
    try {
      const response = await userService.generateTemporaryPassword(id, sendByEmail);
      
      if (response.success) {
        // Si no se envía por email, mostrar la contraseña
        if (!sendByEmail && response.data?.temporaryPassword) {
          toast.success(
            `Contraseña temporal: ${response.data.temporaryPassword}`,
            {
              duration: 10000, // 10 segundos
              action: {
                label: 'Copiar',
                onClick: () => navigator.clipboard.writeText(response.data.temporaryPassword)
              }
            }
          );
        }
        return true;
      } else {
        throw new Error(response.message);
      }
    } catch (error: any) {
      console.error('Error generating temporary password:', error);
      return false;
    }
  }, []);

  // Funciones de selección
  const selectUser = useCallback((userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  }, []);

  const selectAllUsers = useCallback((userIds: string[]) => {
    setSelectedUsers(userIds);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedUsers([]);
  }, []);

  // Función para obtener usuario por ID
  const getUserById = useCallback((id: string): User | undefined => {
    return users.find(user => user._id === id);
  }, [users]);

  // Reset del estado
  const resetState = useCallback(() => {
    setUsers([]);
    setTotalUsers(0);
    setPagination(null);
    setSelectedUsers([]);
    setFilters(initialFilters);
    setIsLoading(false);
    setIsFetching(false);
    setIsError(false);
    setErrorMessage('');
  }, []);

  return {
    // Estado de datos
    users,
    totalUsers,
    pagination,
    
    // Estado de UI
    isLoading,
    isFetching,
    isError,
    errorMessage,
    
    // Filtros y paginación
    filters,
    setFilters,
    
    // Selección múltiple
    selectedUsers,
    setSelectedUsers,
    selectUser,
    selectAllUsers,
    clearSelection,
    
    // Acciones CRUD
    refreshUsers,
    createUser,
    updateUser,
    deleteUser,
    deleteSelectedUsers,
    
    // Acciones específicas
    activateUser,
    deactivateUser,
    generateTemporaryPassword,
    
    // Utilidades
    getUserById,
    resetState
  };
};
