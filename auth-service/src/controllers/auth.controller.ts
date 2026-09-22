import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { LoginRequest, RefreshTokenRequest, RegisterRequest } from '../schemas/auth.schemas';
import { auditLog } from '../services/audit-client.service';
import { AuthService } from '../services/auth.service';
import { OtpService } from '../services/otp.service';
import { ApiResponse } from '../types';

export class AuthController {
  constructor(
    private authService: AuthService,
    private otpService: OtpService
  ) {}

  register = async (req: Request<{}, ApiResponse, RegisterRequest>, res: Response<ApiResponse>) => {
    try {
      // Agregar rol por defecto si no se especifica
      const userData = {
        ...req.body,
        role: req.body.role || 'student' // Default a student para registro público
      };

      const result = await this.authService.register(userData);

      auditLog({
        action: 'user.registered',
        target: { type: 'user', name: req.body.email },
        actor: { email: req.body.email, role: userData.role, ip: req.ip || req.connection.remoteAddress },
        status: 'success',
      });

      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: result
      });
    } catch (error: any) {
      auditLog({
        action: 'user.registered',
        target: { type: 'user', name: req.body.email },
        actor: { email: req.body.email, ip: req.ip || req.connection.remoteAddress },
        status: 'failure',
        details: { reason: error.message },
      });
      res.status(400).json({
        success: false,
        message: error.message || 'Error en el registro',
        error: 'Registration failed'
      });
    }
  };

  changePassword = async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    try {
      const { userId, oldPassword, newPassword } = req.body;
      console.log(req.body);
      if (!userId || !oldPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario, contraseña antigua y nueva son requeridos',
          error: 'Missing required fields'
        });
      }
      const result = await this.authService.changePassword({userId, oldPassword, newPassword});

      auditLog({
        action: 'user.password_changed',
        target: { type: 'user', id: userId },
        actor: { userId: req.user?.userId, email: req.user?.email, role: req.user?.role, ip: req.ip || req.connection.remoteAddress },
        status: 'success',
      });

      res.status(200).json({
        success: true,
        message: 'Contraseña cambiada exitosamente',
        data: result
      });
    } catch (error: any) {
      auditLog({
        action: 'user.password_changed',
        target: { type: 'user', id: req.body?.userId },
        actor: { userId: req.user?.userId, email: req.user?.email, role: req.user?.role, ip: req.ip || req.connection.remoteAddress },
        status: 'failure',
        details: { reason: error.message },
      });
      res.status(400).json({
        success: false,
        message: error.message || 'Error cambiando la contraseña',
        error: 'Change password failed'
      });
    }
  };

  login = async (req: Request<{}, ApiResponse, LoginRequest>, res: Response<ApiResponse>) => {
    const ip = req.ip || req.connection.remoteAddress;
    try {
      const userAgent = req.get('User-Agent');
      const result = await this.authService.login(req.body, userAgent, ip);

      auditLog({
        action: 'user.login',
        target: { type: 'user', name: req.body.email },
        actor: { email: req.body.email, ip },
        status: 'success',
      });

      res.status(200).json({
        success: true,
        message: 'Inicio de sesión exitoso',
        data: result
      });
    } catch (error: any) {
      auditLog({
        action: 'user.login',
        target: { type: 'user', name: req.body.email },
        actor: { email: req.body.email, ip },
        status: 'failure',
        details: { reason: error.message },
      });
      res.status(401).json({
        success: false,
        message: error.message || 'Error en el inicio de sesión',
        error: 'Login failed'
      });
    }
  };

  refreshToken = async (req: Request<{}, ApiResponse, RefreshTokenRequest>, res: Response<ApiResponse>) => {
    try {
      const result = await this.authService.refreshToken(req.body.refreshToken);
      
      res.status(200).json({
        success: true,
        message: 'Token renovado exitosamente',
        data: result
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || 'Error renovando el token',
        error: 'Token refresh failed'
      });
    }
  };

  logout = async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken || !req.user) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token requerido',
          error: 'Missing refresh token'
        });
      }

      await this.authService.logout(refreshToken, req.user.userId);

      auditLog({
        action: 'user.logout',
        target: { type: 'user', id: req.user.userId },
        actor: { userId: req.user.userId, email: req.user.email, role: req.user.role, ip: req.ip || req.connection.remoteAddress },
        status: 'success',
      });

      res.status(200).json({
        success: true,
        message: 'Sesión cerrada exitosamente'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error cerrando sesión',
        error: 'Logout failed'
      });
    }
  };

  logoutAll = async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
          error: 'Not authenticated'
        });
      }

      await this.authService.logoutAll(req.user.userId);
      
      res.status(200).json({
        success: true,
        message: 'Todas las sesiones cerradas exitosamente'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error cerrando todas las sesiones',
        error: 'Logout all failed'
      });
    }
  };

  getProfile = async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuario no autenticado',
          error: 'Not authenticated'
        });
      }

      const user = await this.authService.validateUser(req.user.userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado',
          error: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Perfil obtenido exitosamente',
        data: { user }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error obteniendo el perfil',
        error: 'Profile fetch failed'
      });
    }
  };

  validateToken = async (req: AuthenticatedRequest, res: Response<ApiResponse>) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Token inválido',
          error: 'Invalid token'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Token válido',
        data: {
          user: req.user,
          isValid: true
        }
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: 'Token inválido',
        error: 'Token validation failed'
      });
    }
  };

  resetPassword = async (req: Request<{}, ApiResponse>, res: Response<ApiResponse>) => {
    try {
      const { email, newPassword } = req.body;

      if (!email || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Email y nueva contraseña son requeridos',
          error: 'Missing required fields'
        });
      }

      const result = await this.authService.resetPassword(email, newPassword);

      auditLog({
        action: 'user.password_reset',
        target: { type: 'user', name: email },
        actor: { email, ip: req.ip || req.connection.remoteAddress },
        status: 'success',
      });

      res.status(200).json({
        success: true,
        message: 'Contraseña restablecida exitosamente',
        data: { success: result }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error restableciendo la contraseña',
        error: 'Password reset failed'
      });
    }
  };

  // Internal endpoint — called by user-management-service to sync user fields (role, name, email)
  syncUser = async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { userId } = req.params as { userId: string };
      const { role, firstName, lastName, email } = req.body;

      const allowed: Record<string, any> = {};
      if (role) allowed.role = role;
      if (firstName) allowed.firstName = firstName;
      if (lastName) allowed.lastName = lastName;
      if (email) allowed.email = email;

      if (Object.keys(allowed).length === 0) {
        return res.status(400).json({ success: false, message: 'No hay campos para actualizar', error: 'Missing fields' });
      }

      const updated = await this.authService.syncUserFields(userId, allowed);
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Usuario no encontrado en auth-service', error: 'USER_NOT_FOUND' });
      }

      res.status(200).json({ success: true, message: 'Usuario sincronizado', data: { userId } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Error sincronizando usuario', error: 'Sync failed' });
    }
  };
}
