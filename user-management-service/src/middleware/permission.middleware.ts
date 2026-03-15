import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from '@/types';

// ================================
// PERMISSION DEFINITIONS
// ================================

export interface Permission {
  resource: string;
  actions: string[];
}

export interface ResourceAction {
  resource: string;
  action: string;
}

// Definiciones de recursos y acciones del sistema
export const RESOURCES = {
  USERS: 'users',
  CANDIDATES: 'candidates',
  ROLES: 'roles',
  LEVELS: 'levels',
  QUESTIONS: 'questions',
  EXAMS: 'exams',
  SESSIONS: 'sessions',
  RESULTS: 'results',
  REPORTS: 'reports',
  SYSTEM: 'system'
} as const;

export const ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE: 'manage', // Incluye todas las acciones
  IMPORT: 'import',
  EXPORT: 'export',
  ASSIGN: 'assign',
  MONITOR: 'monitor',
  EVALUATE: 'evaluate'
} as const;

// Permisos por defecto por rol
export const DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    {
      resource: RESOURCES.USERS,
      actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE, ACTIONS.MANAGE]
    },
    {
      resource: RESOURCES.CANDIDATES,
      actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE, ACTIONS.MANAGE, ACTIONS.IMPORT, ACTIONS.EXPORT]
    },
    {
      resource: RESOURCES.ROLES,
      actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE, ACTIONS.MANAGE]
    },
    {
      resource: RESOURCES.LEVELS,
      actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE, ACTIONS.MANAGE]
    },
    {
      resource: RESOURCES.QUESTIONS,
      actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE, ACTIONS.MANAGE]
    },
    {
      resource: RESOURCES.EXAMS,
      actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE, ACTIONS.MANAGE]
    },
    {
      resource: RESOURCES.SESSIONS,
      actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.DELETE, ACTIONS.MANAGE, ACTIONS.ASSIGN, ACTIONS.MONITOR]
    },
    {
      resource: RESOURCES.RESULTS,
      actions: [ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.EVALUATE, ACTIONS.EXPORT]
    },
    {
      resource: RESOURCES.REPORTS,
      actions: [ACTIONS.READ, ACTIONS.CREATE, ACTIONS.EXPORT]
    },
    {
      resource: RESOURCES.SYSTEM,
      actions: [ACTIONS.MANAGE, ACTIONS.READ, ACTIONS.UPDATE]
    }
  ],
  
  teacher: [
    {
      resource: RESOURCES.CANDIDATES,
      actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE, ACTIONS.IMPORT]
    },
    {
      resource: RESOURCES.LEVELS,
      actions: [ACTIONS.READ]
    },
    {
      resource: RESOURCES.QUESTIONS,
      actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE]
    },
    {
      resource: RESOURCES.EXAMS,
      actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.UPDATE]
    },
    {
      resource: RESOURCES.SESSIONS,
      actions: [ACTIONS.CREATE, ACTIONS.READ, ACTIONS.ASSIGN]
    },
    {
      resource: RESOURCES.RESULTS,
      actions: [ACTIONS.READ, ACTIONS.EVALUATE]
    },
    {
      resource: RESOURCES.REPORTS,
      actions: [ACTIONS.READ, ACTIONS.CREATE]
    }
  ],
  
  proctor: [
    {
      resource: RESOURCES.CANDIDATES,
      actions: [ACTIONS.READ]
    },
    {
      resource: RESOURCES.SESSIONS,
      actions: [ACTIONS.READ, ACTIONS.MONITOR]
    },
    {
      resource: RESOURCES.RESULTS,
      actions: [ACTIONS.READ]
    }
  ],
  
  student: [
    {
      resource: RESOURCES.RESULTS,
      actions: [ACTIONS.READ] // Solo sus propios resultados
    },
    {
      resource: RESOURCES.SESSIONS,
      actions: [ACTIONS.READ] // Solo sesiones asignadas
    },
    {
      resource: RESOURCES.USERS,
      actions: [ACTIONS.READ,ACTIONS.UPDATE]
    }
  ]
};

// ================================
// PERMISSION MIDDLEWARE CLASS
// ================================

export class PermissionMiddleware {
  
  // ================================
  // VERIFICAR PERMISO ESPECÍFICO
  // ================================
  
  requirePermission = (resource: string, action: string) => {
    console.log('Verificando permiso:', resource, action);
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const user = req.user as JWTPayload;
        console.log(user,"User permission middleware!")
        if (!user) {
          res.status(401).json({
            success: false,
            message: 'Usuario no autenticado',
            error: 'NOT_AUTHENTICATED'
          });
          return;
        }

        if (this.hasPermission(user, resource, action)) {
          next();
          return;
        }

        res.status(403).json({
          success: false,
          message: `Acceso denegado. Permiso requerido: ${action} en ${resource}`,
          error: 'INSUFFICIENT_PERMISSIONS',
          details: {
            required: { resource, action },
            userRole: user.role
          }
        });
      } catch (error) {
        console.error('Error en middleware de permisos:', error);
        res.status(500).json({
          success: false,
          message: 'Error interno del servidor',
          error: 'PERMISSION_CHECK_ERROR'
        });
      }
    };
  };

  // ================================
  // VERIFICAR MÚLTIPLES PERMISOS
  // ================================
  
  requireAnyPermission = (permissions: ResourceAction[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const user = req.user as JWTPayload;

        if (!user) {
          res.status(401).json({
            success: false,
            message: 'Usuario no autenticado',
            error: 'NOT_AUTHENTICATED'
          });
          return;
        }

        const hasAnyPermission = permissions.some(({ resource, action }) => 
          this.hasPermission(user, resource, action)
        );

        if (hasAnyPermission) {
          next();
          return;
        }

        res.status(403).json({
          success: false,
          message: 'Acceso denegado. Se requiere al menos uno de los permisos especificados',
          error: 'INSUFFICIENT_PERMISSIONS',
          details: {
            required: permissions,
            userRole: user.role
          }
        });
      } catch (error) {
        console.error('Error en middleware de permisos múltiples:', error);
        res.status(500).json({
          success: false,
          message: 'Error interno del servidor',
          error: 'PERMISSION_CHECK_ERROR'
        });
      }
    };
  };

  // ================================
  // VERIFICAR TODOS LOS PERMISOS
  // ================================
  
  requireAllPermissions = (permissions: ResourceAction[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const user = req.user as JWTPayload;

        if (!user) {
          res.status(401).json({
            success: false,
            message: 'Usuario no autenticado',
            error: 'NOT_AUTHENTICATED'
          });
          return;
        }

        const hasAllPermissions = permissions.every(({ resource, action }) => 
          this.hasPermission(user, resource, action)
        );

        if (hasAllPermissions) {
          next();
          return;
        }

        const missingPermissions = permissions.filter(({ resource, action }) => 
          !this.hasPermission(user, resource, action)
        );

        res.status(403).json({
          success: false,
          message: 'Acceso denegado. Se requieren todos los permisos especificados',
          error: 'INSUFFICIENT_PERMISSIONS',
          details: {
            required: permissions,
            missing: missingPermissions,
            userRole: user.role
          }
        });
      } catch (error) {
        console.error('Error en middleware de permisos múltiples:', error);
        res.status(500).json({
          success: false,
          message: 'Error interno del servidor',
          error: 'PERMISSION_CHECK_ERROR'
        });
      }
    };
  };

  // ================================
  // VERIFICAR OWNERSHIP CON PERMISOS
  // ================================
  
  requireOwnershipOrPermission = (
    resource: string, 
    action: string, 
    ownerField: string = 'userId'
  ) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const user = req.user as JWTPayload;

        if (!user) {
          res.status(401).json({
            success: false,
            message: 'Usuario no autenticado',
            error: 'NOT_AUTHENTICATED'
          });
          return;
        }

        // Verificar si tiene el permiso general
        if (this.hasPermission(user, resource, action)) {
          next();
          return;
        }

        // Verificar ownership
        const resourceId = req.params.id || req.params[ownerField] || req.body[ownerField];
        
        if (resourceId === user.userId) {
          // Solo permitir lectura para recursos propios si no tiene permisos generales
          if (action === ACTIONS.READ) {
            next();
            return;
          }
        }

        res.status(403).json({
          success: false,
          message: 'Acceso denegado. Permiso insuficiente o recurso no es propio',
          error: 'OWNERSHIP_OR_PERMISSION_REQUIRED',
          details: {
            required: { resource, action },
            userRole: user.role
          }
        });
      } catch (error) {
        console.error('Error en middleware de ownership/permisos:', error);
        res.status(500).json({
          success: false,
          message: 'Error interno del servidor',
          error: 'OWNERSHIP_CHECK_ERROR'
        });
      }
    };
  };

  // ================================
  // VERIFICAR CONTEXTO ESPECÍFICO
  // ================================
  
  requireContextualPermission = (
    getContext: (req: Request) => { resource: string; action: string }
  ) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const user = req.user as JWTPayload;

        if (!user) {
          res.status(401).json({
            success: false,
            message: 'Usuario no autenticado',
            error: 'NOT_AUTHENTICATED'
          });
          return;
        }

        const { resource, action } = getContext(req);

        if (this.hasPermission(user, resource, action)) {
          next();
          return;
        }

        res.status(403).json({
          success: false,
          message: `Acceso denegado. Permiso requerido: ${action} en ${resource}`,
          error: 'INSUFFICIENT_PERMISSIONS',
          details: {
            required: { resource, action },
            userRole: user.role
          }
        });
      } catch (error) {
        console.error('Error en middleware de permisos contextuales:', error);
        res.status(500).json({
          success: false,
          message: 'Error interno del servidor',
          error: 'CONTEXTUAL_PERMISSION_ERROR'
        });
      }
    };
  };

  // ================================
  // MÉTODOS AUXILIARES
  // ================================
  
  private hasPermission(user: JWTPayload, resource: string, action: string): boolean {
    // Admin siempre tiene acceso
    if (user.role === 'admin') {
      return true;
    }

    // Verificar permisos específicos del usuario
    if (user.permissions) {
      const hasSpecificPermission = user.permissions.some(permission => 
        permission.resource === resource && 
        (permission.actions.includes(action) || permission.actions.includes(ACTIONS.MANAGE))
      );
      
      if (hasSpecificPermission) {
        return true;
      }
    }

    // Verificar permisos por defecto del rol
    const rolePermissions = DEFAULT_PERMISSIONS[user.role] || [];
    
    return rolePermissions.some(permission => 
      permission.resource === resource && 
      (permission.actions.includes(action) || permission.actions.includes(ACTIONS.MANAGE))
    );
  }

  // ================================
  // OBTENER PERMISOS DE USUARIO
  // ================================
  
  getUserPermissions = (req: Request, res: Response, next: NextFunction): void => {
    try {
      const user = req.user as JWTPayload;

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
          error: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const rolePermissions = DEFAULT_PERMISSIONS[user.role] || [];
      const userSpecificPermissions = user.permissions || [];

      // Combinar permisos de rol y específicos del usuario
      const allPermissions = this.mergePermissions(rolePermissions, userSpecificPermissions);

      res.status(200).json({
        success: true,
        message: 'Permisos obtenidos exitosamente',
        data: {
          role: user.role,
          permissions: allPermissions,
          rolePermissions,
          userSpecificPermissions
        }
      });
    } catch (error) {
      console.error('Error obteniendo permisos:', error);
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: 'GET_PERMISSIONS_ERROR'
      });
    }
  };

  // ================================
  // COMBINAR PERMISOS
  // ================================
  
  private mergePermissions(rolePermissions: Permission[], userPermissions: Permission[]): Permission[] {
    const permissionMap = new Map<string, Set<string>>();

    // Agregar permisos de rol
    rolePermissions.forEach(permission => {
      if (!permissionMap.has(permission.resource)) {
        permissionMap.set(permission.resource, new Set());
      }
      permission.actions.forEach(action => {
        permissionMap.get(permission.resource)!.add(action);
      });
    });

    // Agregar permisos específicos del usuario
    userPermissions.forEach(permission => {
      if (!permissionMap.has(permission.resource)) {
        permissionMap.set(permission.resource, new Set());
      }
      permission.actions.forEach(action => {
        permissionMap.get(permission.resource)!.add(action);
      });
    });

    // Convertir de vuelta a array
    return Array.from(permissionMap.entries()).map(([resource, actions]) => ({
      resource,
      actions: Array.from(actions)
    }));
  }
}

// ================================
// INSTANCIA Y PRESETS
// ================================

export const permissionMiddleware = new PermissionMiddleware();

// Presets de permisos comunes
export const permissionPresets = {
  // Gestión de usuarios
  manageUsers: permissionMiddleware.requirePermission(RESOURCES.USERS, ACTIONS.MANAGE),
  createUser: permissionMiddleware.requirePermission(RESOURCES.USERS, ACTIONS.CREATE),
  readUsers: permissionMiddleware.requirePermission(RESOURCES.USERS, ACTIONS.READ),
  updateUser: permissionMiddleware.requirePermission(RESOURCES.USERS, ACTIONS.UPDATE),
  deleteUser: permissionMiddleware.requirePermission(RESOURCES.USERS, ACTIONS.DELETE),

  // Gestión de candidatos
  manageCandidates: permissionMiddleware.requirePermission(RESOURCES.CANDIDATES, ACTIONS.MANAGE),
  createCandidate: permissionMiddleware.requirePermission(RESOURCES.CANDIDATES, ACTIONS.CREATE),
  readCandidates: permissionMiddleware.requirePermission(RESOURCES.CANDIDATES, ACTIONS.READ),
  updateCandidate: permissionMiddleware.requirePermission(RESOURCES.CANDIDATES, ACTIONS.UPDATE),
  deleteCandidate: permissionMiddleware.requirePermission(RESOURCES.CANDIDATES, ACTIONS.DELETE),
  importCandidates: permissionMiddleware.requirePermission(RESOURCES.CANDIDATES, ACTIONS.IMPORT),

  // Gestión de roles
  manageRoles: permissionMiddleware.requirePermission(RESOURCES.ROLES, ACTIONS.MANAGE),
  createRole: permissionMiddleware.requirePermission(RESOURCES.ROLES, ACTIONS.CREATE),
  readRoles: permissionMiddleware.requirePermission(RESOURCES.ROLES, ACTIONS.READ),
  updateRole: permissionMiddleware.requirePermission(RESOURCES.ROLES, ACTIONS.UPDATE),
  deleteRole: permissionMiddleware.requirePermission(RESOURCES.ROLES, ACTIONS.DELETE),

  // Gestión de niveles
  manageLevels: permissionMiddleware.requirePermission(RESOURCES.LEVELS, ACTIONS.MANAGE),
  readLevels: permissionMiddleware.requirePermission(RESOURCES.LEVELS, ACTIONS.READ),

  // Ownership con permisos de respaldo
  ownUserOrManage: permissionMiddleware.requireOwnershipOrPermission(RESOURCES.USERS, ACTIONS.READ),
  ownCandidateOrManage: permissionMiddleware.requireOwnershipOrPermission(RESOURCES.CANDIDATES, ACTIONS.READ),

  // Permisos contextuales
  sessionContext: permissionMiddleware.requireContextualPermission((req) => {
    const action = req.method === 'GET' ? ACTIONS.READ : 
                   req.method === 'POST' ? ACTIONS.CREATE : 
                   req.method === 'PUT' || req.method === 'PATCH' ? ACTIONS.UPDATE : 
                   ACTIONS.DELETE;
    
    return { resource: RESOURCES.SESSIONS, action };
  }),

  // Permisos múltiples
  teacherOrAdmin: permissionMiddleware.requireAnyPermission([
    { resource: RESOURCES.USERS, action: ACTIONS.MANAGE },
    { resource: RESOURCES.CANDIDATES, action: ACTIONS.CREATE }
  ])
};

// ================================
// HELPER FUNCTIONS
// ================================

export const createPermissionFactory = (resource: string) => ({
  manage: permissionMiddleware.requirePermission(resource, ACTIONS.MANAGE),
  create: permissionMiddleware.requirePermission(resource, ACTIONS.CREATE),
  read: permissionMiddleware.requirePermission(resource, ACTIONS.READ),
  update: permissionMiddleware.requirePermission(resource, ACTIONS.UPDATE),
  delete: permissionMiddleware.requirePermission(resource, ACTIONS.DELETE),
  any: (actions: string[]) => permissionMiddleware.requireAnyPermission(
    actions.map(action => ({ resource, action }))
  ),
  all: (actions: string[]) => permissionMiddleware.requireAllPermissions(
    actions.map(action => ({ resource, action }))
  )
});

// Factories para cada recurso
export const userPermissions = createPermissionFactory(RESOURCES.USERS);
export const candidatePermissions = createPermissionFactory(RESOURCES.CANDIDATES);
export const rolePermissions = createPermissionFactory(RESOURCES.ROLES);
export const levelPermissions = createPermissionFactory(RESOURCES.LEVELS);
export const questionPermissions = createPermissionFactory(RESOURCES.QUESTIONS);
export const examPermissions = createPermissionFactory(RESOURCES.EXAMS);
export const sessionPermissions = createPermissionFactory(RESOURCES.SESSIONS);
export const resultPermissions = createPermissionFactory(RESOURCES.RESULTS);
export const reportPermissions = createPermissionFactory(RESOURCES.REPORTS);
export const systemPermissions = createPermissionFactory(RESOURCES.SYSTEM);
