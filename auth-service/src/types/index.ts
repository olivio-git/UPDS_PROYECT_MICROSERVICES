export interface User {
  _id?: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'teacher' | 'proctor' | 'student';
  isActive: boolean;
  permissions: string[];
  profile: {
    avatar?: string;
    phone?: string;
    address?: string;
  };
  teacherData?: {
    specialization: string[];
    experience: number;
  };
  proctorData?: {
    certifications: string[];
    availableHours: string[];
  };
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
}

export interface Session {
  _id?: string;
  userId: string;
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
}

export interface AuthResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
  expiresIn: string | number; // Puede ser un número de segundos o una cadena como '1h'
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}
