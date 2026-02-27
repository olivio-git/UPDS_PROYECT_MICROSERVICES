import { Request, Response, NextFunction } from 'express';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions?: string[];
  };
}

/**
 * Authorization middleware to check if user has required roles
 */
export const authorizeRoles = (requiredRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const userRole = req.user.role;
    
    // Check if user has any of the required roles
    if (!requiredRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions. Required roles: ' + requiredRoles.join(', '),
        userRole,
        requiredRoles
      });
      return;
    }

    next();
  };
};

/**
 * Authorization middleware to check if user has required permissions
 */
export const authorizePermissions = (requiredPermissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const userPermissions = req.user.permissions || [];
    
    // Check if user has all required permissions
    const hasAllPermissions = requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );

    if (!hasAllPermissions) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        userPermissions,
        requiredPermissions
      });
      return;
    }

    next();
  };
};

/**
 * Authorization middleware that allows access if user has either required roles OR permissions
 */
export const authorizeRolesOrPermissions = (requiredRoles: string[], requiredPermissions: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const userRole = req.user.role;
    const userPermissions = req.user.permissions || [];

    // Check if user has any of the required roles
    const hasRequiredRole = requiredRoles.includes(userRole);

    // Check if user has any of the required permissions
    const hasRequiredPermission = requiredPermissions.some(permission => 
      userPermissions.includes(permission)
    );

    if (!hasRequiredRole && !hasRequiredPermission) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        userRole,
        userPermissions,
        requiredRoles,
        requiredPermissions
      });
      return;
    }

    next();
  };
};

/**
 * Authorization middleware for resource ownership
 * Checks if user owns the resource or has admin privileges
 */
export const authorizeResourceOwner = (resourceUserIdField: string = 'userId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Admin can access any resource
    if (userRole === 'admin') {
      return next();
    }

    // Get resource user ID from request params, body, or query
    const resourceUserId = req.params[resourceUserIdField] || 
                          req.body[resourceUserIdField] || 
                          req.query[resourceUserIdField];

    if (!resourceUserId) {
      return res.status(400).json({
        success: false,
        message: `Resource ${resourceUserIdField} not found in request`
      });
    }

    // Check if user owns the resource
    if (userId !== resourceUserId) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You can only access your own resources.'
      });
    }

    next();
  };
};