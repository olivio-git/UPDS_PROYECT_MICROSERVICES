// ================================
// USER TYPES
// ================================

export type UserRole = 'admin' | 'teacher' | 'proctor' | 'student';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending';

export interface UserProfile {
  avatar?: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  nationality?: string;
  bio?: string;
  preferences?: {
    language: 'es' | 'en';
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
  };
}

export interface TeacherData {
  department: string;
  specialization: string[];
  experience: number;
  certifications: Array<{
    name: string;
    institution: string;
    date: string;
    expiryDate?: string;
    verificationUrl?: string;
  }>;
  schedule: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
}

export interface ProctorData {
  availableHours: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  certificationLevel: string;
  languages: string[];
  maxSimultaneousSessions: number;
}

export interface Permission {
  resource: string;
  actions: string[];
}

export interface User {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  profile?: UserProfile;
  permissions: Permission[];
  teacherData?: TeacherData;
  proctorData?: ProctorData;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

// ================================
// REQUEST/RESPONSE TYPES
// ================================

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  profile?: Partial<UserProfile>;
  teacherData?: TeacherData;
  proctorData?: ProctorData;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  status?: UserStatus;
  profile?: Partial<UserProfile>;
  permissions?: Permission[];
  teacherData?: TeacherData;
  proctorData?: ProctorData;
}

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  sortBy?: 'createdAt' | 'updatedAt' | 'firstName' | 'lastName' | 'email';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedUsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// ================================
// UI TYPES
// ================================

export type ViewMode = 'table' | 'create' | 'edit';

export interface UserFormData {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
  // Campos específicos por rol
  department?: string;
  specialization?: string[];
  experience?: number;
  certificationLevel?: string;
  languages?: string[];
  maxSimultaneousSessions?: number;
}

export interface TableColumn {
  id: string;
  header: string;
  accessor: keyof User | string;
  sortable?: boolean;
  filterable?: boolean;
  width?: number;
}

// ================================
// FORM VALIDATION TYPES
// ================================

export interface FormErrors {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  phone?: string;
  department?: string;
  specialization?: string;
  experience?: string;
  certificationLevel?: string;
  languages?: string;
  maxSimultaneousSessions?: string;
}

// ================================
// UTILITY TYPES
// ================================

export const USER_ROLES: { value: UserRole; label: string; description: string }[] = [
  {
    value: 'admin',
    label: 'Administrador',
    description: 'Acceso completo al sistema'
  },
  {
    value: 'teacher',
    label: 'Profesor',
    description: 'Gestión de exámenes y evaluación'
  },
  {
    value: 'proctor',
    label: 'Supervisor',
    description: 'Supervisión de exámenes'
  },
  {
    value: 'student',
    label: 'Estudiante',
    description: 'Participación en exámenes'
  }
];

export const USER_STATUSES: { value: UserStatus; label: string; color: string }[] = [
  {
    value: 'active',
    label: 'Activo',
    color: 'text-green-600 bg-green-100'
  },
  {
    value: 'inactive',
    label: 'Inactivo',
    color: 'text-gray-600 bg-gray-100'
  },
  {
    value: 'suspended',
    label: 'Suspendido',
    color: 'text-red-600 bg-red-100'
  },
  {
    value: 'pending',
    label: 'Pendiente',
    color: 'text-yellow-600 bg-yellow-100'
  }
];

export const DEPARTMENTS = [
  'Inglés General',
  'Inglés Académico',
  'Inglés de Negocios',
  'Preparación TOEFL',
  'Preparación IELTS',
  'Conversación',
  'Gramática',
  'Comprensión Auditiva'
];

export const SPECIALIZATIONS = [
  'Grammar',
  'Conversation',
  'Listening',
  'Reading',
  'Writing',
  'Business English',
  'Academic English',
  'TOEFL Preparation',
  'IELTS Preparation',
  'Pronunciation'
];

export const LANGUAGES = [
  'Español',
  'English',
  'Português',
  'Français'
];
