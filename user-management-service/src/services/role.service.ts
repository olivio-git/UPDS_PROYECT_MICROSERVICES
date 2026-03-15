// src/services/role.service.ts - Implementación completa

import { 
  Role,
  Permission,
  ApiResponse,
  PaginationParams,
  FilterParams,
  UserRole
} from '../types';
import { RoleRepository } from '../repositories/role.repository';
import { RoleModel } from '../models/Role';
import { eventService } from './event.service';

export class RoleService {
  private roleRepository: RoleRepository;

  constructor() {
    this.roleRepository = new RoleRepository();
    console.log('🔒 RoleService inicializado');
  }

  // ================================
  // CRUD OPERATIONS
  // ================================

  async createRole(roleData: Omit<Role, '_id' | 'createdAt' | 'updatedAt'>, createdBy?: string): Promise<ApiResponse<any>> {
    try {
      // Verificar si ya existe un rol con el mismo nombre
      const existingRole = await this.roleRepository.findByName(roleData.name);
      if (existingRole) {
        return {
          success: false,
          message: 'Ya existe un rol con este nombre',
          error: 'ROLE_NAME_EXISTS'
        };
      }

      // Validar datos del rol
      const roleModel = new RoleModel(roleData);
      const validation = roleModel.validate();
      if (!validation.isValid) {
        return {
          success: false,
          message: `Datos del rol inválidos: ${validation.errors.join(', ')}`,
          error: 'VALIDATION_ERROR'
        };
      }

      // Crear rol
      const role = await this.roleRepository.create(roleData);

      // Publicar evento de rol creado
      try {
        await eventService.publishUserEvent({
          eventType: 'USER_UPDATED',
          userId: createdBy || 'system',
          userData: { action: 'role_created', roleId: role._id!.toString(), roleName: role.name },
          updatedBy: createdBy,
          timestamp: new Date()
        });
      } catch (eventError) {
        console.warn('⚠️ Error publicando evento de rol creado:', eventError);
      }

      return {
        success: true,
        message: 'Rol creado exitosamente',
        data: { role: role.toJSON() }
      };
    } catch (error) {
      console.error('Error creando rol:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getRoleById(id: string): Promise<ApiResponse<any>> {
    try {
      const role = await this.roleRepository.findById(id);
      
      if (!role) {
        return {
          success: false,
          message: 'Rol no encontrado',
          error: 'ROLE_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Rol obtenido exitosamente',
        data: { role: role.toJSON() }
      };
    } catch (error) {
      console.error('Error obteniendo rol por ID:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getRoleByName(name: string): Promise<ApiResponse<any>> {
    try {
      const role = await this.roleRepository.findByName(name);
      
      if (!role) {
        return {
          success: false,
          message: 'Rol no encontrado',
          error: 'ROLE_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Rol obtenido exitosamente',
        data: { role: role.toJSON() }
      };
    } catch (error) {
      console.error('Error obteniendo rol por nombre:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async updateRole(id: string, updates: Partial<Role>, updatedBy?: string): Promise<ApiResponse<any>> {
    try {
      // Verificar si el rol existe
      const existingRole = await this.roleRepository.findById(id);
      if (!existingRole) {
        return {
          success: false,
          message: 'Rol no encontrado',
          error: 'ROLE_NOT_FOUND'
        };
      }

      // Si se está actualizando el nombre, verificar que no exista otro rol con ese nombre
      if (updates.name && updates.name !== existingRole.name) {
        const nameExists = await this.roleRepository.nameExists(updates.name, id);
        if (nameExists) {
          return {
            success: false,
            message: 'Ya existe un rol con este nombre',
            error: 'ROLE_NAME_EXISTS'
          };
        }
      }

      // Validar si se están actualizando permisos
      if (updates.permissions) {
        const tempRole = new RoleModel({ ...existingRole.toJSON(), ...updates });
        const validation = tempRole.validate();
        if (!validation.isValid) {
          return {
            success: false,
            message: `Datos del rol inválidos: ${validation.errors.join(', ')}`,
            error: 'VALIDATION_ERROR'
          };
        }
      }

      const updatedRole = await this.roleRepository.update(id, updates);
      
      // Publicar evento de rol actualizado
      if (updatedRole) {
        try {
          await eventService.publishUserEvent({
            eventType: 'USER_UPDATED',
            userId: updatedBy || 'system',
            userData: { 
              action: 'role_updated', 
              roleId: id, 
              roleName: updatedRole.name,
              updates 
            },
            updatedBy,
            timestamp: new Date()
          });
        } catch (eventError) {
          console.warn('⚠️ Error publicando evento de rol actualizado:', eventError);
        }
      }
      
      return {
        success: true,
        message: 'Rol actualizado exitosamente',
        data: { role: updatedRole?.toJSON() }
      };
    } catch (error) {
      console.error('Error actualizando rol:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteRole(id: string, deletedBy?: string): Promise<ApiResponse<any>> {
    try {
      const roleExists = await this.roleRepository.findById(id);
      if (!roleExists) {
        return {
          success: false,
          message: 'Rol no encontrado',
          error: 'ROLE_NOT_FOUND'
        };
      }

      // Verificar si es un rol por defecto
      if (roleExists.isDefault) {
        return {
          success: false,
          message: 'No se puede eliminar un rol por defecto',
          error: 'CANNOT_DELETE_DEFAULT_ROLE'
        };
      }

      const deleted = await this.roleRepository.delete(id);
      
      if (!deleted) {
        return {
          success: false,
          message: 'Error eliminando rol',
          error: 'DELETE_FAILED'
        };
      }

      // Publicar evento de rol eliminado
      try {
        await eventService.publishUserEvent({
          eventType: 'USER_UPDATED',
          userId: deletedBy || 'system',
          userData: { 
            action: 'role_deleted', 
            roleId: id, 
            roleName: roleExists.name 
          },
          updatedBy: deletedBy,
          timestamp: new Date()
        });
      } catch (eventError) {
        console.warn('⚠️ Error publicando evento de rol eliminado:', eventError);
      }

      return {
        success: true,
        message: 'Rol eliminado exitosamente',
        data: { deletedId: id }
      };
    } catch (error) {
      console.error('Error eliminando rol:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getRoles(pagination?: PaginationParams, filters?: FilterParams): Promise<ApiResponse<any>> {
    try {
      const roles = await this.roleRepository.findAll();
      
      // Aplicar filtros si se proporcionan
      let filteredRoles = roles;
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        filteredRoles = roles.filter(role => 
          role.name.toLowerCase().includes(searchTerm) ||
          role.description.toLowerCase().includes(searchTerm)
        );
      }

      // Aplicar paginación si se proporciona
      let paginatedRoles = filteredRoles;
      let totalPages = 1;
      let hasNext = false;
      let hasPrev = false;

      if (pagination) {
        const { page, limit } = pagination;
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        
        paginatedRoles = filteredRoles.slice(startIndex, endIndex);
        totalPages = Math.ceil(filteredRoles.length / limit);
        hasNext = page < totalPages;
        hasPrev = page > 1;
      }
      
      return {
        success: true,
        message: 'Lista de roles obtenida exitosamente',
        data: {
          roles: paginatedRoles.map(role => role.toJSON()),
          total: filteredRoles.length,
          page: pagination?.page || 1,
          limit: pagination?.limit || filteredRoles.length,
          totalPages,
          hasNext,
          hasPrev
        }
      };
    } catch (error) {
      console.error('Error obteniendo roles:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ================================
  // SPECIALIZED OPERATIONS
  // ================================

  async getDefaultRoles(): Promise<ApiResponse<any>> {
    try {
      const defaultRoles = await this.roleRepository.findDefaultRoles();
      
      return {
        success: true,
        message: 'Roles por defecto obtenidos exitosamente',
        data: {
          roles: defaultRoles.map(role => role.toJSON()),
          total: defaultRoles.length
        }
      };
    } catch (error) {
      console.error('Error obteniendo roles por defecto:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getCustomRoles(): Promise<ApiResponse<any>> {
    try {
      const customRoles = await this.roleRepository.findCustomRoles();
      
      return {
        success: true,
        message: 'Roles personalizados obtenidos exitosamente',
        data: {
          roles: customRoles.map(role => role.toJSON()),
          total: customRoles.length
        }
      };
    } catch (error) {
      console.error('Error obteniendo roles personalizados:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async assignPermissions(roleId: string, permissions: Permission[], updatedBy?: string): Promise<ApiResponse<any>> {
    try {
      const role = await this.roleRepository.findById(roleId);
      if (!role) {
        return {
          success: false,
          message: 'Rol no encontrado',
          error: 'ROLE_NOT_FOUND'
        };
      }

      // Validar permisos
      const tempRole = new RoleModel({ ...role.toJSON(), permissions });
      const validation = tempRole.validate();
      if (!validation.isValid) {
        return {
          success: false,
          message: `Permisos inválidos: ${validation.errors.join(', ')}`,
          error: 'VALIDATION_ERROR'
        };
      }

      const updatedRole = await this.roleRepository.update(roleId, { permissions });

      return {
        success: true,
        message: 'Permisos asignados exitosamente',
        data: { 
          roleId, 
          permissions: updatedRole?.permissions || permissions,
          role: updatedRole?.toJSON()
        }
      };
    } catch (error) {
      console.error('Error asignando permisos:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async addPermissionToRole(roleId: string, resource: string, actions: string[], updatedBy?: string): Promise<ApiResponse<any>> {
    try {
      const updatedRole = await this.roleRepository.addPermissionToRole(roleId, resource, actions);
      
      if (!updatedRole) {
        return {
          success: false,
          message: 'Rol no encontrado',
          error: 'ROLE_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Permiso agregado exitosamente',
        data: { 
          roleId, 
          resource, 
          actions,
          role: updatedRole.toJSON()
        }
      };
    } catch (error) {
      console.error('Error agregando permiso:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async removePermissionFromRole(roleId: string, resource: string, actions?: string[], updatedBy?: string): Promise<ApiResponse<any>> {
    try {
      const updatedRole = await this.roleRepository.removePermissionFromRole(roleId, resource, actions);
      
      if (!updatedRole) {
        return {
          success: false,
          message: 'Rol no encontrado',
          error: 'ROLE_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Permiso removido exitosamente',
        data: { 
          roleId, 
          resource, 
          actions: actions || 'all',
          role: updatedRole.toJSON()
        }
      };
    } catch (error) {
      console.error('Error removiendo permiso:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getRolePermissions(roleId: string): Promise<ApiResponse<any>> {
    try {
      const role = await this.roleRepository.findById(roleId);
      
      if (!role) {
        return {
          success: false,
          message: 'Rol no encontrado',
          error: 'ROLE_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Permisos del rol obtenidos exitosamente',
        data: { 
          roleId, 
          roleName: role.name,
          permissions: role.permissions,
          resources: role.getAllResources()
        }
      };
    } catch (error) {
      console.error('Error obteniendo permisos del rol:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async hasPermission(roleId: string, resource: string, action: string): Promise<ApiResponse<any>> {
    try {
      const hasPermission = await this.roleRepository.hasPermission(roleId, resource, action);
      
      return {
        success: true,
        message: 'Verificación de permiso completada',
        data: { 
          roleId, 
          resource, 
          action, 
          hasPermission 
        }
      };
    } catch (error) {
      console.error('Error verificando permiso:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ================================
  // ROLE MANAGEMENT
  // ================================

  async cloneRole(roleId: string, newName: string, createdBy?: string): Promise<ApiResponse<any>> {
    try {
      const clonedRole = await this.roleRepository.cloneRole(roleId, newName);
      
      if (!clonedRole) {
        return {
          success: false,
          message: 'Rol original no encontrado o nombre ya existe',
          error: 'CLONE_FAILED'
        };
      }

      return {
        success: true,
        message: 'Rol clonado exitosamente',
        data: { 
          originalRoleId: roleId,
          clonedRole: clonedRole.toJSON()
        }
      };
    } catch (error) {
      console.error('Error clonando rol:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async makeDefault(roleId: string, updatedBy?: string): Promise<ApiResponse<any>> {
    try {
      const updatedRole = await this.roleRepository.makeDefault(roleId);
      
      if (!updatedRole) {
        return {
          success: false,
          message: 'Rol no encontrado',
          error: 'ROLE_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Rol marcado como por defecto',
        data: { role: updatedRole.toJSON() }
      };
    } catch (error) {
      console.error('Error marcando rol como defecto:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async removeDefault(roleId: string, updatedBy?: string): Promise<ApiResponse<any>> {
    try {
      const updatedRole = await this.roleRepository.removeDefault(roleId);
      
      if (!updatedRole) {
        return {
          success: false,
          message: 'Rol no encontrado',
          error: 'ROLE_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Rol desmarcado como por defecto',
        data: { role: updatedRole.toJSON() }
      };
    } catch (error) {
      console.error('Error desmarcando rol como defecto:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ================================
  // USER ROLE OPERATIONS
  // ================================

  async getRoleByUserRole(userRole: UserRole): Promise<ApiResponse<any>> {
    try {
      const role = await this.roleRepository.getRoleByUserRole(userRole);
      
      if (!role) {
        return {
          success: false,
          message: 'Rol no encontrado para este tipo de usuario',
          error: 'ROLE_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Rol obtenido exitosamente',
        data: { role: role.toJSON() }
      };
    } catch (error) {
      console.error('Error obteniendo rol por tipo de usuario:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async canUserPerformAction(userRole: UserRole, resource: string, action: string): Promise<ApiResponse<any>> {
    try {
      const canPerform = await this.roleRepository.canUserPerformAction(userRole, resource, action);
      
      return {
        success: true,
        message: 'Verificación de acción completada',
        data: { 
          userRole, 
          resource, 
          action, 
          canPerform 
        }
      };
    } catch (error) {
      console.error('Error verificando acción de usuario:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ================================
  // INITIALIZATION
  // ================================

  async initializeDefaultRoles(): Promise<ApiResponse<any>> {
    try {
      await this.roleRepository.initializeDefaultRoles();
      
      return {
        success: true,
        message: 'Roles por defecto inicializados exitosamente',
        data: { initialized: true }
      };
    } catch (error) {
      console.error('Error inicializando roles por defecto:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ================================
  // STATISTICS
  // ================================

  async getRoleStatistics(): Promise<ApiResponse<any>> {
    try {
      const stats = await this.roleRepository.getStatistics();
      
      return {
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ================================
  // EXPORT/IMPORT OPERATIONS
  // ================================

  async exportRoles(): Promise<ApiResponse<any>> {
    try {
      const roles = await this.roleRepository.exportRoles();
      
      return {
        success: true,
        message: 'Roles exportados exitosamente',
        data: {
          roles: roles.map(role => role.toJSON()),
          total: roles.length,
          exportedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Error exportando roles:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async importRoles(roles: Partial<Role>[]): Promise<ApiResponse<any>> {
    try {
      const result = await this.roleRepository.importRoles(roles);
      
      return {
        success: true,
        message: 'Importación completada',
        data: result
      };
    } catch (error) {
      console.error('Error importando roles:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
