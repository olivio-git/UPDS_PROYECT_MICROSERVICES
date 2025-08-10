import { ObjectId } from 'mongodb';
import { 
  User, 
  UserRole, 
  UserStatus, 
  UserProfile,
  TeacherData,
  ProctorData,
  Permission
} from '@/types';

export class UserModel implements User {
  _id?: ObjectId;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  profile: UserProfile;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  teacherData?: TeacherData;
  proctorData?: ProctorData;
  
  // Campos para integración con auth-service
  authServiceUserId?: string;  // ID del usuario en auth-service
  lastSync?: Date;             // Última sincronización con auth-service
  createdBy?: string;          // Usuario que creó este registro

  constructor(data: Partial<User & { authServiceUserId?: string; lastSync?: Date; createdBy?: string }>) {
    this._id = data._id ?? undefined;
    this.email = data.email || '';
    this.firstName = data.firstName || '';
    this.lastName = data.lastName || '';
    this.role = data.role || 'student';
    this.status = data.status || 'active';
    this.profile = data.profile || {
      preferences: {
        language: 'es',
        timezone: 'America/La_Paz',
        notifications: {
          email: true,
          push: true,
          sms: false,
        }
      }
    };
    this.permissions = data.permissions || [];
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
    this.lastLogin = data.lastLogin ?? undefined;
    this.teacherData = data.teacherData ?? undefined;
    this.proctorData = data.proctorData ?? undefined;
    
    // Nuevos campos
    this.authServiceUserId = data.authServiceUserId ?? undefined;
    this.lastSync = data.lastSync ?? undefined;
    this.createdBy = data.createdBy ?? undefined;
  }

  // Métodos de utilidad
  public getFullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  public isActive(): boolean {
    return this.status === 'active';
  }

  public hasPermission(resource: string, action: string): boolean {
    return this.permissions.some(permission => 
      permission.resource === resource && 
      permission.actions.includes(action)
    );
  }

  public isTeacher(): boolean {
    return this.role === 'teacher';
  }

  public isProctor(): boolean {
    return this.role === 'proctor';
  }

  public isAdmin(): boolean {
    return this.role === 'admin';
  }

  public updateLastLogin(): void {
    this.lastLogin = new Date();
    this.updatedAt = new Date();
  }

  public updateProfile(profileData: Partial<UserProfile>): void {
    this.profile = { ...this.profile, ...profileData };
    this.updatedAt = new Date();
  }

  public addPermission(resource: string, actions: string[]): void {
    const existingPermission = this.permissions.find(p => p.resource === resource);
    
    if (existingPermission) {
      // Agregar acciones que no existen
      const newActions = actions.filter(action => 
        !existingPermission.actions.includes(action)
      );
      existingPermission.actions.push(...newActions);
    } else {
      // Crear nuevo permiso
      this.permissions.push({ resource, actions });
    }
    
    this.updatedAt = new Date();
  }

  public removePermission(resource: string, actions?: string[]): void {
    if (!actions) {
      // Remover todo el permiso del recurso
      this.permissions = this.permissions.filter(p => p.resource !== resource);
    } else {
      // Remover acciones específicas
      const permission = this.permissions.find(p => p.resource === resource);
      if (permission) {
        permission.actions = permission.actions.filter(action => 
          !actions.includes(action)
        );
        
        // Si no quedan acciones, remover el permiso completo
        if (permission.actions.length === 0) {
          this.permissions = this.permissions.filter(p => p.resource !== resource);
        }
      }
    }
    
    this.updatedAt = new Date();
  }

  public toJSON(): Omit<User, 'password'> & { authServiceUserId?: string; lastSync?: Date; createdBy?: string } {
    const result: Omit<User, 'password'> & { authServiceUserId?: string; lastSync?: Date; createdBy?: string } = {
      _id: this._id,
      email: this.email,
      firstName: this.firstName,
      lastName: this.lastName,
      role: this.role,
      status: this.status,
      profile: this.profile,
      permissions: this.permissions,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
    
    if (this.lastLogin !== undefined) {
      result.lastLogin = this.lastLogin;
    }
    if (this.teacherData !== undefined) {
      result.teacherData = this.teacherData;
    }
    if (this.proctorData !== undefined) {
      result.proctorData = this.proctorData;
    }
    if (this.authServiceUserId !== undefined) {
      result.authServiceUserId = this.authServiceUserId;
    }
    if (this.lastSync !== undefined) {
      result.lastSync = this.lastSync;
    }
    if (this.createdBy !== undefined) {
      result.createdBy = this.createdBy;
    }
    
    return result;
  }

  // Validaciones
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Email validation
    if (!this.email || !this.isValidEmail(this.email)) {
      errors.push('Email inválido');
    }

    // Name validation
    if (!this.firstName || this.firstName.trim().length < 2) {
      errors.push('Nombre debe tener al menos 2 caracteres');
    }

    if (!this.lastName || this.lastName.trim().length < 2) {
      errors.push('Apellido debe tener al menos 2 caracteres');
    }

    // Role validation
    const validRoles: UserRole[] = ['admin', 'teacher', 'proctor', 'student'];
    if (!validRoles.includes(this.role)) {
      errors.push('Rol inválido');
    }

    // Status validation
    const validStatuses: UserStatus[] = ['active', 'inactive', 'suspended', 'pending'];
    if (!validStatuses.includes(this.status)) {
      errors.push('Estado inválido');
    }

    // Role-specific validation
    if (this.role === 'teacher' && this.teacherData) {
      const teacherErrors = this.validateTeacherData(this.teacherData);
      errors.push(...teacherErrors);
    }

    if (this.role === 'proctor' && this.proctorData) {
      const proctorErrors = this.validateProctorData(this.proctorData);
      errors.push(...proctorErrors);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private validateTeacherData(data: TeacherData): string[] {
    const errors: string[] = [];

    if (!data.department || data.department.trim().length < 2) {
      errors.push('Departamento del profesor es requerido');
    }

    if (!data.specialization || data.specialization.length === 0) {
      errors.push('Al menos una especialización es requerida');
    }

    if (data.experience < 0) {
      errors.push('Experiencia no puede ser negativa');
    }

    return errors;
  }

  private validateProctorData(data: ProctorData): string[] {
    const errors: string[] = [];

    if (!data.certificationLevel || data.certificationLevel.trim().length === 0) {
      errors.push('Nivel de certificación es requerido');
    }

    if (!data.languages || data.languages.length === 0) {
      errors.push('Al menos un idioma es requerido');
    }

    if (data.maxSimultaneousSessions < 1) {
      errors.push('Máximo de sesiones simultáneas debe ser al menos 1');
    }

    return errors;
  }

  // Factory method para crear desde datos de base de datos
  public static fromDatabase(data: any): UserModel {
    return new UserModel({
      _id: data._id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      status: data.status,
      profile: data.profile,
      permissions: data.permissions || [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      lastLogin: data.lastLogin,
      teacherData: data.teacherData,
      proctorData: data.proctorData,
      authServiceUserId: data.authServiceUserId,
      lastSync: data.lastSync,
      createdBy: data.createdBy,
    });
  }

  // Factory method para crear usuario por defecto según rol
  public static createDefaultByRole(
    email: string, 
    firstName: string, 
    lastName: string, 
    role: UserRole
  ): UserModel {
    const baseUser = {
      email,
      firstName,
      lastName,
      role,
      status: 'active' as UserStatus,
      profile: {
        preferences: {
          language: 'es' as const,
          timezone: 'America/La_Paz',
          notifications: {
            email: true,
            push: true,
            sms: false,
          }
        }
      },
      permissions: UserModel.getDefaultPermissionsByRole(role),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return new UserModel(baseUser);
  }

  // Obtener permisos por defecto según el rol
  public static getDefaultPermissionsByRole(role: UserRole): Permission[] {
    const permissions: Record<UserRole, Permission[]> = {
      admin: [
        { resource: 'users', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'candidates', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'exams', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'sessions', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'reports', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'settings', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'roles', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      ],
      teacher: [
        { resource: 'candidates', actions: ['create', 'read', 'update'] },
        { resource: 'exams', actions: ['create', 'read', 'update'] },
        { resource: 'sessions', actions: ['read', 'execute'] },
        { resource: 'reports', actions: ['read'] },
        { resource: 'questions', actions: ['create', 'read', 'update'] },
        { resource: 'results', actions: ['read', 'update'] },
      ],
      proctor: [
        { resource: 'sessions', actions: ['read', 'execute'] },
        { resource: 'candidates', actions: ['read'] },
        { resource: 'exams', actions: ['read'] },
        { resource: 'reports', actions: ['read'] },
      ],
      student: [
        { resource: 'exams', actions: ['read', 'execute'] },
        { resource: 'results', actions: ['read'] },
      ],
    };

    return permissions[role] || [];
  }
}
