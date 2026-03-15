// Componentes principales
export { default as UserTableHeader } from './UserTableHeader';
export { default as UserTable } from './UserTable';
export { default as UserForm } from './UserForm';
export { default as Pagination } from './Pagination';

// Re-exportar tipos comunes que puedan necesitar los componentes
export type {
  User,
  UserRole,
  UserStatus,
  CreateUserRequest,
  UpdateUserRequest,
  UserFilters,
  ViewMode
} from '../types/user.types';
