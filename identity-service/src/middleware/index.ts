// ================================
// MIDDLEWARE EXPORTS
// ================================

export * from './auth.middleware';
export * from './error.middleware';
export * from './validation.middleware';
export * from './permission.middleware';

// ================================
// COMMON MIDDLEWARE COMBINATIONS
// ================================

import { RequestHandler } from 'express';
import { authMiddleware, authPresets } from './auth.middleware';
import { permissionMiddleware, permissionPresets } from './permission.middleware';
import { validateBody, validateQuery, validateParams, validationPresets } from './validation.middleware';
import { errorHandler } from './error.middleware';

// ================================
// MIDDLEWARE STACKS
// ================================

export const middlewareStacks = {
  // Autenticación básica
  basicAuth: [authMiddleware.authenticate],
  
  // Autenticación opcional
  optionalAuth: [authMiddleware.optionalAuth],
  
  // Admin only
  adminOnly: [
    authMiddleware.authenticate,
    authMiddleware.requireAdmin
  ],
  
  // Teacher o Admin
  teacherOrAdmin: [
    authMiddleware.authenticate,
    authMiddleware.requireRole(['teacher', 'admin'])
  ],
  
  // Proctor o Admin
  proctorOrAdmin: [
    authMiddleware.authenticate,
    authMiddleware.requireRole(['proctor', 'admin'])
  ],
  
  // User management completo
  userManagement: [
    authMiddleware.authenticate,
    permissionPresets.manageUsers
  ],
  
  // Candidate management completo
  candidateManagement: [
    authMiddleware.authenticate,
    permissionPresets.manageCandidates
  ],
  
  // Role management completo
  roleManagement: [
    authMiddleware.authenticate,
    permissionPresets.manageRoles
  ],
  
  // Validación y sanitización común
  commonValidation: [
    validationPresets.commonForm
  ],
  
  // Rate limiting básico
  basicRateLimit: [
    authMiddleware.rateLimiter(100, 15 * 60 * 1000) // 100 requests per 15 minutes
  ],
  
  // Rate limiting estricto
  strictRateLimit: [
    authMiddleware.rateLimiter(10, 60 * 1000) // 10 requests per minute
  ]
};

// ================================
// FACTORY FUNCTIONS
// ================================

/**
 * Crea un stack de middleware para operaciones CRUD
 */
export const createCRUDMiddleware = (resource: string) => {
  return {
    create: [
      authMiddleware.authenticate,
      permissionMiddleware.requirePermission(resource, 'create')
    ],
    read: [
      authMiddleware.authenticate,
      permissionMiddleware.requirePermission(resource, 'read')
    ],
    update: [
      authMiddleware.authenticate,
      permissionMiddleware.requirePermission(resource, 'update')
    ],
    delete: [
      authMiddleware.authenticate,
      permissionMiddleware.requirePermission(resource, 'delete')
    ],
    manage: [
      authMiddleware.authenticate,
      permissionMiddleware.requirePermission(resource, 'manage')
    ]
  };
};

/**
 * Crea un stack de middleware con validación
 */
export const createValidatedMiddleware = (
  authStack: RequestHandler[],
  validationSchema?: any,
  validationType: 'body' | 'query' | 'params' = 'body'
) => {
  const middleware = [...authStack];
  
  if (validationSchema) {
    if (validationType === 'body') {
      middleware.push(validateBody(validationSchema));
    } else if (validationType === 'query') {
      middleware.push(validateQuery(validationSchema));
    } else if (validationType === 'params') {
      middleware.push(validateParams(validationSchema));
    }
  }
  
  return middleware;
};

/**
 * Crea un stack de middleware con ownership
 */
export const createOwnershipMiddleware = (
  resource: string,
  action: string,
  ownerField: string = 'userId'
) => {
  return [
    authMiddleware.authenticate,
    permissionMiddleware.requireOwnershipOrPermission(resource, action, ownerField)
  ];
};

// ================================
// PRESET COMBINATIONS
// ================================

export const presetStacks = {
  // CRUD operations for different resources
  userCRUD: createCRUDMiddleware('users'),
  candidateCRUD: createCRUDMiddleware('candidates'),
  roleCRUD: createCRUDMiddleware('roles'),
  levelCRUD: createCRUDMiddleware('levels'),
  
  // Common authenticated operations
  authenticatedRead: [
    authMiddleware.authenticate,
    permissionMiddleware.requireAnyPermission([
      { resource: 'users', action: 'read' },
      { resource: 'candidates', action: 'read' },
      { resource: 'roles', action: 'read' }
    ])
  ],
  
  // File operations
  fileUpload: [
    authMiddleware.authenticate,
    validationPresets.imageFile
  ],
  
  documentUpload: [
    authMiddleware.authenticate,
    validationPresets.documentFile
  ],
  
  // API versioning and rate limiting
  apiV1: [
    middlewareStacks.basicRateLimit[0],
    authMiddleware.authenticate
  ],
  
  // Public endpoints with optional auth
  publicWithOptionalAuth: [
    authMiddleware.optionalAuth,
    middlewareStacks.basicRateLimit[0]
  ],
  
  // Administrative operations
  systemAdmin: [
    authMiddleware.authenticate,
    authMiddleware.requireAdmin,
    permissionMiddleware.requirePermission('system', 'manage')
  ]
};

// ================================
// CONDITIONAL MIDDLEWARE
// ================================

/**
 * Aplica middleware condicionalmente basado en una función
 */
export const conditionalMiddleware = (
  condition: (req: any) => boolean,
  middleware: RequestHandler[]
) => {
  return (req: any, res: any, next: any) => {
    if (condition(req)) {
      // Aplicar middleware stack
      let index = 0;
      
      const runNext = () => {
        if (index >= middleware.length) {
          return next();
        }
        
        const currentMiddleware = middleware[index++];
        if (typeof currentMiddleware === 'function') {
          currentMiddleware(req, res, runNext);
        } else {
          runNext();
        }
      };
      
      runNext();
    } else {
      next();
    }
  };
};

/**
 * Middleware que aplica diferentes stacks basado en el método HTTP
 */
export const methodBasedMiddleware = (stacks: {
  GET?: RequestHandler[];
  POST?: RequestHandler[];
  PUT?: RequestHandler[];
  PATCH?: RequestHandler[];
  DELETE?: RequestHandler[];
}) => {
  return (req: any, res: any, next: any) => {
    const stack = stacks[req.method as keyof typeof stacks];
    
    if (!stack) {
      return next();
    }
    
    let index = 0;
    
    const runNext = () => {
      if (index >= stack.length) {
        return next();
      }
      
      const currentMiddleware = stack[index++];
      if (typeof currentMiddleware === 'function') {
        currentMiddleware(req, res, runNext);
      } else {
        runNext();
      }
    };
    
    runNext();
  };
};

// ================================
// ERROR HANDLING
// ================================

/**
 * Middleware que envuelve async handlers para manejo de errores
 */
export const asyncHandler = (fn: RequestHandler) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Middleware de logging para desarrollo
 */
export const requestLogger = (req: any, res: any, next: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`, {
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
      headers: {
        authorization: req.headers.authorization ? 'Bearer ***' : undefined,
        'content-type': req.headers['content-type']
      }
    });
  }
  next();
};

/**
 * Middleware de respuesta estándar
 */
export const responseFormatter = (req: any, res: any, next: any) => {
  // Añadir método de respuesta estándar
  res.success = (data: any, message: string = 'Operación exitosa', statusCode: number = 200) => {
    res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  };

  res.error = (message: string, error: string = 'ERROR', statusCode: number = 400, details?: any) => {
    res.status(statusCode).json({
      success: false,
      message,
      error,
      details,
      timestamp: new Date().toISOString()
    });
  };

  next();
};

// ================================
// COMBINED MIDDLEWARE EXPORTS
// ================================

/**
 * Middleware completo para endpoints públicos
 */
export const publicEndpoint = [
  requestLogger,
  responseFormatter,
  ...middlewareStacks.basicRateLimit
];

/**
 * Middleware completo para endpoints autenticados
 */
export const authenticatedEndpoint = [
  requestLogger,
  responseFormatter,
  ...middlewareStacks.basicAuth,
  ...middlewareStacks.basicRateLimit
];

/**
 * Middleware completo para endpoints de administración
 */
export const adminEndpoint = [
  requestLogger,
  responseFormatter,
  ...middlewareStacks.adminOnly,
  ...middlewareStacks.strictRateLimit
];

/**
 * Middleware de error handling (debe ir al final)
 */
export const errorMiddleware = [errorHandler];

// ================================
// TYPES
// ================================

declare global {
  namespace Express {
    interface Response {
      success(data: any, message?: string, statusCode?: number): void;
      error(message: string, error?: string, statusCode?: number, details?: any): void;
    }
  }
}
