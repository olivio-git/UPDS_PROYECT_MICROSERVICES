import { ObjectId } from 'mongodb';
import { Role, Permission, UserRole, Resource, Action } from '@/types';

export class RoleModel implements Role {
  _id?: ObjectId;
  name: string;
  description: string;
  permissions: Permission[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;

  constructor(data: Partial<Role>) {
    this._id = data._id ?? undefined;
    this.name = data.name || '';
    this.description = data.description || '';
    this.permissions = data.permissions || [];
    this.isDefault = data.isDefault || false;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Métodos de utilidad
  public hasPermission(resource: string, action: string): boolean {
    return this.permissions.some(permission => 
      permission.resource === resource && 
      permission.actions.includes(action)
    );
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

  public updateDescription(description: string): void {
    this.description = description;
    this.updatedAt = new Date();
  }

  public makeDefault(): void {
    this.isDefault = true;
    this.updatedAt = new Date();
  }

  public removeDefault(): void {
    this.isDefault = false;
    this.updatedAt = new Date();
  }

  public getPermissionsByResource(resource: string): string[] {
    const permission = this.permissions.find(p => p.resource === resource);
    return permission ? permission.actions : [];
  }

  public getAllResources(): string[] {
    return [...new Set(this.permissions.map(p => p.resource))];
  }

  public clone(newName: string): RoleModel {
    return new RoleModel({
      name: newName,
      description: `Copia de ${this.description}`,
      permissions: JSON.parse(JSON.stringify(this.permissions)), // Deep clone
      isDefault: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Validaciones
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validar nombre
    if (!this.name || this.name.trim().length < 2) {
      errors.push('Nombre del rol debe tener al menos 2 caracteres');
    }

    // Validar que el nombre no contenga caracteres especiales
    if (!/^[a-zA-Z0-9_\-\s]+$/.test(this.name)) {
      errors.push('Nombre del rol contiene caracteres inválidos');
    }

    // Validar descripción
    if (!this.description || this.description.trim().length < 10) {
      errors.push('Descripción debe tener al menos 10 caracteres');
    }

    // Validar permisos
    const permissionErrors = this.validatePermissions();
    errors.push(...permissionErrors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private validatePermissions(): string[] {
    const errors: string[] = [];
    const validResources: Resource[] = [
      'users', 'candidates', 'exams', 'sessions', 'reports', 
      'settings', 'roles', 'questions', 'results'
    ];
    const validActions: Action[] = ['create', 'read', 'update', 'delete', 'execute', 'manage'];

    this.permissions.forEach((permission, index) => {
      // Validar recurso
      if (!validResources.includes(permission.resource as Resource)) {
        errors.push(`Recurso inválido en permiso ${index + 1}: ${permission.resource}`);
      }

      // Validar acciones
      if (!permission.actions || permission.actions.length === 0) {
        errors.push(`Permiso ${index + 1} debe tener al menos una acción`);
      }

      permission.actions.forEach(action => {
        if (!validActions.includes(action as Action)) {
          errors.push(`Acción inválida en permiso ${index + 1}: ${action}`);
        }
      });

      // Validar duplicados de acciones
      const duplicateActions = permission.actions.filter(
        (action, i) => permission.actions.indexOf(action) !== i
      );
      if (duplicateActions.length > 0) {
        errors.push(`Acciones duplicadas en permiso ${index + 1}: ${duplicateActions.join(', ')}`);
      }
    });

    // Validar duplicados de recursos
    const resources = this.permissions.map(p => p.resource);
    const duplicateResources = resources.filter((resource, i) => resources.indexOf(resource) !== i);
    if (duplicateResources.length > 0) {
      errors.push(`Recursos duplicados: ${duplicateResources.join(', ')}`);
    }

    return errors;
  }

  public toJSON(): Role {
    const result: Role = {
      _id: this._id,
      name: this.name,
      description: this.description,
      permissions: this.permissions,
      isDefault: this.isDefault,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
    
    return result;
  }

  // Factory method para crear desde datos de base de datos
  public static fromDatabase(data: any): RoleModel {
    return new RoleModel({
      _id: data._id,
      name: data.name,
      description: data.description,
      permissions: data.permissions || [],
      isDefault: data.isDefault || false,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }

  // Factory methods para crear roles por defecto
  public static createAdminRole(): RoleModel {
    return new RoleModel({
      name: 'Administrador',
      description: 'Acceso completo a todas las funcionalidades del sistema',
      permissions: [
        { resource: 'users', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'candidates', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'exams', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'sessions', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'reports', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'settings', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'roles', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'questions', actions: ['create', 'read', 'update', 'delete', 'manage'] },
        { resource: 'results', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      ],
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public static createTeacherRole(): RoleModel {
    return new RoleModel({
      name: 'Profesor',
      description: 'Puede crear y gestionar exámenes, ver resultados y administrar candidatos',
      permissions: [
        { resource: 'candidates', actions: ['create', 'read', 'update'] },
        { resource: 'exams', actions: ['create', 'read', 'update'] },
        { resource: 'sessions', actions: ['read', 'execute'] },
        { resource: 'reports', actions: ['read'] },
        { resource: 'questions', actions: ['create', 'read', 'update'] },
        { resource: 'results', actions: ['read', 'update'] },
      ],
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public static createProctorRole(): RoleModel {
    return new RoleModel({
      name: 'Supervisor',
      description: 'Puede supervisar sesiones de examen y monitorear candidatos',
      permissions: [
        { resource: 'sessions', actions: ['read', 'execute'] },
        { resource: 'candidates', actions: ['read'] },
        { resource: 'exams', actions: ['read'] },
        { resource: 'reports', actions: ['read'] },
      ],
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  public static createStudentRole(): RoleModel {
    return new RoleModel({
      name: 'Estudiante',
      description: 'Puede tomar exámenes y ver sus resultados',
      permissions: [
        { resource: 'exams', actions: ['read', 'execute'] },
        { resource: 'results', actions: ['read'] },
      ],
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  // Método para obtener todos los roles por defecto
  public static getDefaultRoles(): RoleModel[] {
    return [
      this.createAdminRole(),
      this.createTeacherRole(),
      this.createProctorRole(),
      this.createStudentRole(),
    ];
  }

  // Método para buscar rol por nombre de UserRole
  public static getRoleByUserRole(userRole: UserRole): RoleModel {
    const roleMap: Record<UserRole, () => RoleModel> = {
      admin: this.createAdminRole,
      teacher: this.createTeacherRole,
      proctor: this.createProctorRole,
      student: this.createStudentRole,
    };

    return roleMap[userRole]();
  }

  // Método para verificar si un rol puede realizar una acción específica
  public static canPerformAction(
    userRole: UserRole, 
    resource: string, 
    action: string
  ): boolean {
    const role = this.getRoleByUserRole(userRole);
    return role.hasPermission(resource, action);
  }

  // Método de utilidad para comparar permisos
  public isMorePermissiveThan(otherRole: RoleModel): boolean {
    // Un rol es más permisivo si tiene todos los permisos del otro y más
    for (const otherPermission of otherRole.permissions) {
      const myPermission = this.permissions.find(p => p.resource === otherPermission.resource);
      
      if (!myPermission) return false;
      
      for (const action of otherPermission.actions) {
        if (!myPermission.actions.includes(action)) return false;
      }
    }
    
    // Verificar si tengo más permisos
    const myPermissionCount = this.permissions.reduce((sum, p) => sum + p.actions.length, 0);
    const otherPermissionCount = otherRole.permissions.reduce((sum, p) => sum + p.actions.length, 0);
    
    return myPermissionCount > otherPermissionCount;
  }
}
