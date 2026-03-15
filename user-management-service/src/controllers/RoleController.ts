import { Request, Response, NextFunction } from 'express';
import { RoleService } from '../services/role.service';
import { JWTPayload, Role, Permission } from '../types';
import { createError } from '../middleware/error.middleware';

export class RoleController {
  private roleService: RoleService;

  constructor() {
    this.roleService = new RoleService();
  }

  // ================================
  // GET ROLES
  // ================================
  
  getRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as any;
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 10;
      
      const pagination = { page, limit };
      const filters = {
        search: query.search || undefined,
      };

      const result = await this.roleService.getRoles(pagination, filters);
      
      if (!result.success) {
        throw createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // GET ROLE BY ID
  // ================================
  
  getRoleById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      
      if (typeof id !== 'string') {
        throw createError.badRequest('ID de rol es requerido y debe ser un string');
      }

      const result = await this.roleService.getRoleById(id);
      
      if (!result.success) {
        throw result.error === 'ROLE_NOT_FOUND' 
          ? createError.notFound(result.message) 
          : createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // CREATE ROLE
  // ================================
  
  createRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const roleData = req.body;
      const currentUser = req.user as JWTPayload;

      // Validar campos requeridos
      if (!roleData.name || !roleData.description) {
        throw createError.badRequest('Nombre y descripción son requeridos');
      }

      const result = await this.roleService.createRole(
        {
          name: roleData.name,
          description: roleData.description,
          permissions: roleData.permissions || [],
          isDefault: false
        },
        currentUser.userId
      );
      
      if (!result.success) {
        throw createError.badRequest(result.message, result.error);
      }

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // UPDATE ROLE
  // ================================
  
  updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const currentUser = req.user as JWTPayload;

      if (typeof id !== 'string') {
        throw createError.badRequest('ID de rol es requerido y debe ser un string');
      }
      const result = await this.roleService.updateRole(id, updates, currentUser.userId);
      
      if (!result.success) {
        throw result.error === 'ROLE_NOT_FOUND' 
          ? createError.notFound(result.message)
          : createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // PATCH ROLE
  // ================================
  
  patchRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const currentUser = req.user as JWTPayload;
      if (typeof id !== 'string') {
        throw createError.badRequest('ID de rol es requerido y debe ser un string');
      }
      const result = await this.roleService.updateRole(id, updates, currentUser.userId);
      
      if (!result.success) {
        throw result.error === 'ROLE_NOT_FOUND' 
          ? createError.notFound(result.message)
          : createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // DELETE ROLE
  // ================================
  
  deleteRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const currentUser = req.user as JWTPayload;
      if (typeof id !== 'string') {
        throw createError.badRequest('ID de rol es requerido y debe ser un string');
      }
      const result = await this.roleService.deleteRole(id, currentUser.userId);
      
      if (!result.success) {
        throw result.error === 'ROLE_NOT_FOUND' 
          ? createError.notFound(result.message)
          : createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // GET DEFAULT ROLES
  // ================================
  
  getDefaultRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.roleService.getDefaultRoles();
      
      if (!result.success) {
        throw createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // GET CUSTOM ROLES
  // ================================
  
  getCustomRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.roleService.getCustomRoles();
      
      if (!result.success) {
        throw createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // CLONE ROLE
  // ================================
  
  cloneRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { name } = req.body;
      const currentUser = req.user as JWTPayload;

      if (!name) {
        throw createError.badRequest('Nombre para el rol clonado es requerido');
      }
      if (typeof id !== 'string') {
        throw createError.badRequest('ID de rol es requerido y debe ser un string');
      }
      const result = await this.roleService.cloneRole(id, name, currentUser.userId);
      
      if (!result.success) {
        throw createError.badRequest(result.message, result.error);
      }

      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // GET ROLE PERMISSIONS
  // ================================
  
  getRolePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (typeof id !== 'string') {
        throw createError.badRequest('ID de rol es requerido y debe ser un string');
      }
      const result = await this.roleService.getRolePermissions(id);
      
      if (!result.success) {
        throw result.error === 'ROLE_NOT_FOUND' 
          ? createError.notFound(result.message)
          : createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // UPDATE ROLE PERMISSIONS
  // ================================
  
  updateRolePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { permissions } = req.body;
      const currentUser = req.user as JWTPayload;

      if (!Array.isArray(permissions)) {
        throw createError.badRequest('Los permisos deben ser un array');
      }
      if (typeof id !== 'string') {
        throw createError.badRequest('ID de rol es requerido y debe ser un string');
      }
      const result = await this.roleService.assignPermissions(id, permissions, currentUser.userId);
      
      if (!result.success) {
        throw result.error === 'ROLE_NOT_FOUND' 
          ? createError.notFound(result.message)
          : createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // ADD PERMISSION TO ROLE
  // ================================
  
  addPermissionToRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { resource, actions } = req.body;
      const currentUser = req.user as JWTPayload;

      if (!resource || !Array.isArray(actions)) {
        throw createError.badRequest('Recurso y acciones son requeridos');
      }
      if (typeof id !== 'string') {
        throw createError.badRequest('ID de rol es requerido y debe ser un string');
      }
      const result = await this.roleService.addPermissionToRole(id, resource, actions, currentUser.userId);
      
      if (!result.success) {
        throw result.error === 'ROLE_NOT_FOUND' 
          ? createError.notFound(result.message)
          : createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // REMOVE PERMISSION FROM ROLE
  // ================================
  
  removePermissionFromRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { resource, actions } = req.body;
      const currentUser = req.user as JWTPayload;

      if (!resource) {
        throw createError.badRequest('Recurso es requerido');
      }
      if (typeof id !== 'string') {
        throw createError.badRequest('ID de rol es requerido y debe ser un string');
      }
      const result = await this.roleService.removePermissionFromRole(
        id, 
        resource, 
        actions, 
        currentUser.userId
      );
      
      if (!result.success) {
        throw result.error === 'ROLE_NOT_FOUND' 
          ? createError.notFound(result.message)
          : createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // CHECK PERMISSION
  // ================================
  
  checkPermission = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { resource, action } = req.query as { resource: string; action: string };

      if (!resource || !action) {
        throw createError.badRequest('Recurso y acción son requeridos');
      }
      if (typeof id !== 'string') {
        throw createError.badRequest('ID de rol es requerido y debe ser un string');
      }
      const result = await this.roleService.hasPermission(id, resource, action);
      
      if (!result.success) {
        throw createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // GET ROLE STATS
  // ================================
  
  getRoleStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.roleService.getRoleStatistics();
      
      if (!result.success) {
        throw createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // MAKE ROLE DEFAULT
  // ================================
  
  makeDefault = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const currentUser = req.user as JWTPayload;
      if (typeof id !== 'string') {
        throw createError.badRequest('ID de rol es requerido y debe ser un string');
      }
      const result = await this.roleService.makeDefault(id, currentUser.userId);
      
      if (!result.success) {
        throw result.error === 'ROLE_NOT_FOUND' 
          ? createError.notFound(result.message)
          : createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // REMOVE DEFAULT STATUS
  // ================================
  
  removeDefault = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const currentUser = req.user as JWTPayload;
      if (typeof id !== 'string') {
        throw createError.badRequest('ID de rol es requerido y debe ser un string');
      }
      const result = await this.roleService.removeDefault(id, currentUser.userId);
      
      if (!result.success) {
        throw result.error === 'ROLE_NOT_FOUND' 
          ? createError.notFound(result.message)
          : createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // INITIALIZE DEFAULT ROLES
  // ================================
  
  initializeDefaultRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.roleService.initializeDefaultRoles();
      
      if (!result.success) {
        throw createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // EXPORT ROLES
  // ================================
  
  exportRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.roleService.exportRoles();
      
      if (!result.success) {
        throw createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // IMPORT ROLES
  // ================================
  
  importRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { roles } = req.body;

      if (!Array.isArray(roles)) {
        throw createError.badRequest('Los roles deben ser un array');
      }

      const result = await this.roleService.importRoles(roles);
      
      if (!result.success) {
        throw createError.badRequest(result.message, result.error);
      }

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // GET AVAILABLE PERMISSIONS
  // ================================
  
  getAvailablePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const permissions = [
        {
          resource: 'users',
          actions: ['create', 'read', 'update', 'delete', 'manage'],
          description: 'Gestión de usuarios del sistema'
        },
        {
          resource: 'candidates',
          actions: ['create', 'read', 'update', 'delete', 'manage'],
          description: 'Gestión de candidatos a exámenes'
        },
        {
          resource: 'roles',
          actions: ['create', 'read', 'update', 'delete', 'manage'],
          description: 'Gestión de roles y permisos'
        },
        {
          resource: 'exams',
          actions: ['create', 'read', 'update', 'delete', 'execute', 'manage'],
          description: 'Gestión y ejecución de exámenes'
        },
        {
          resource: 'sessions',
          actions: ['create', 'read', 'update', 'delete', 'execute', 'manage'],
          description: 'Gestión de sesiones de examen'
        },
        {
          resource: 'questions',
          actions: ['create', 'read', 'update', 'delete', 'manage'],
          description: 'Gestión de preguntas de examen'
        },
        {
          resource: 'reports',
          actions: ['read', 'create', 'manage'],
          description: 'Generación y acceso a reportes'
        },
        {
          resource: 'results',
          actions: ['read', 'update', 'create', 'manage'],
          description: 'Gestión de resultados de exámenes'
        },
        {
          resource: 'settings',
          actions: ['read', 'update', 'manage'],
          description: 'Configuración del sistema'
        }
      ];

      res.status(200).json({
        success: true,
        message: 'Permisos disponibles obtenidos exitosamente',
        data: {
          permissions,
          total: permissions.length
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // VALIDATE PERMISSIONS
  // ================================
  
  validatePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        throw createError.badRequest('Los permisos deben ser un array');
      }

      const validResources = ['users', 'candidates', 'roles', 'exams', 'sessions', 'questions', 'reports', 'results', 'settings'];
      const validActions = ['create', 'read', 'update', 'delete', 'execute', 'manage'];

      const errors: string[] = [];
      const warnings: string[] = [];

      permissions.forEach((permission: Permission, index: number) => {
        if (!permission.resource || !validResources.includes(permission.resource)) {
          errors.push(`Recurso inválido en permiso ${index + 1}: ${permission.resource}`);
        }

        if (!permission.actions || !Array.isArray(permission.actions) || permission.actions.length === 0) {
          errors.push(`Permiso ${index + 1} debe tener al menos una acción`);
        } else {
          permission.actions.forEach(action => {
            if (!validActions.includes(action)) {
              errors.push(`Acción inválida en permiso ${index + 1}: ${action}`);
            }
          });
        }
      });

      const valid = errors.length === 0;

      res.status(200).json({
        success: true,
        message: 'Validación de permisos completada',
        data: {
          valid,
          permissions,
          errors,
          warnings
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // METHODS REQUIRED BY ROUTES
  // ================================

  getUsersByRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      
      // Por ahora, mock ya que esta funcionalidad sería implementada por UserService
      res.status(200).json({
        success: true,
        message: 'Usuarios con este rol obtenidos exitosamente',
        data: {
          roleId: id,
          users: [],
          total: 0
        }
      });
    } catch (error) {
      next(error);
    }
  };

  searchRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { query } = req.query as { query: string };
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const filters = { search: query };
      const pagination = { page, limit };
      
      const result = await this.roleService.getRoles(pagination, filters);
      
      if (!result.success) {
        throw createError.badRequest(result.message, result.error);
      }

      res.status(200).json({
        ...result,
        message: 'Búsqueda de roles completada exitosamente'
      });
    } catch (error) {
      next(error);
    }
  };

  activateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const currentUser = req.user as JWTPayload;

      // Por ahora mock - esta funcionalidad se implementaría extendiendo el RoleService
      res.status(200).json({
        success: true,
        message: 'Rol activado exitosamente',
        data: {
          roleId: id,
          status: 'active',
          updatedBy: currentUser.userId,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  deactivateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const currentUser = req.user as JWTPayload;

      // Por ahora mock - esta funcionalidad se implementaría extendiendo el RoleService
      res.status(200).json({
        success: true,
        message: 'Rol desactivado exitosamente',
        data: {
          roleId: id,
          status: 'inactive',
          updatedBy: currentUser.userId,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  updateRoleHierarchy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { hierarchy } = req.body;
      const currentUser = req.user as JWTPayload;

      // Por ahora mock - esta funcionalidad se implementaría extendiendo el modelo de Role
      res.status(200).json({
        success: true,
        message: 'Jerarquía del rol actualizada exitosamente',
        data: {
          roleId: id,
          hierarchy: hierarchy || 0,
          updatedBy: currentUser.userId,
          updatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  getRoleHierarchy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Mock hierarchy - se implementaría con datos reales del RoleService
      res.status(200).json({
        success: true,
        message: 'Jerarquía de roles obtenida exitosamente',
        data: {
          hierarchy: [
            { id: 'admin-role-id', name: 'admin', level: 0 },
            { id: 'teacher-role-id', name: 'teacher', level: 1 },
            { id: 'proctor-role-id', name: 'proctor', level: 2 },
            { id: 'student-role-id', name: 'student', level: 3 }
          ]
        }
      });
    } catch (error) {
      next(error);
    }
  };

  createBulkRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { roles } = req.body;
      const currentUser = req.user as JWTPayload;

      if (!Array.isArray(roles)) {
        throw createError.badRequest('Los roles deben ser un array');
      }

      // Mock bulk create - se implementaría con RoleService real
      res.status(200).json({
        success: true,
        message: 'Roles creados en lote exitosamente',
        data: {
          created: 0,
          failed: 0,
          total: roles.length,
          createdBy: currentUser.userId
        }
      });
    } catch (error) {
      next(error);
    }
  };

  updateBulkRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ids, updates } = req.body;
      const currentUser = req.user as JWTPayload;

      if (!Array.isArray(ids)) {
        throw createError.badRequest('Los IDs deben ser un array');
      }

      // Mock bulk update - se implementaría con RoleService real
      res.status(200).json({
        success: true,
        message: 'Roles actualizados en lote exitosamente',
        data: {
          updated: 0,
          failed: 0,
          total: ids.length,
          updatedBy: currentUser.userId
        }
      });
    } catch (error) {
      next(error);
    }
  };

  deleteBulkRoles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ids } = req.body;
      const currentUser = req.user as JWTPayload;

      if (!Array.isArray(ids)) {
        throw createError.badRequest('Los IDs deben ser un array');
      }

      // Mock bulk delete - se implementaría con RoleService real
      res.status(200).json({
        success: true,
        message: 'Roles eliminados en lote exitosamente',
        data: {
          deleted: 0,
          failed: 0,
          total: ids.length,
          deletedBy: currentUser.userId
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
