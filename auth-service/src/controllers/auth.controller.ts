import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { OtpService } from '../services/otp.service';
import { LoginRequest, RegisterRequest, RefreshTokenRequest } from '../schemas/auth.schemas';
import { ApiResponse } from '../types';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

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
      
      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: result
      });
    } catch (error: any) {
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
      if (!userId || !oldPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'ID de usuario, contraseña antigua y nueva son requeridos',
          error: 'Missing required fields'
        });
      }
      const result = await this.authService.changePassword({userId, oldPassword, newPassword});
      res.status(200).json({
        success: true,
        message: 'Contraseña cambiada exitosamente',
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message || 'Error cambiando la contraseña',
        error: 'Change password failed'
      });
    }
  };

  login = async (req: Request<{}, ApiResponse, LoginRequest>, res: Response<ApiResponse>) => {
    try {
      const userAgent = req.get('User-Agent');
      const ipAddress = req.ip || req.connection.remoteAddress;
      
      const result = await this.authService.login(req.body, userAgent, ipAddress);
      
      res.status(200).json({
        success: true,
        message: 'Inicio de sesión exitoso',
        data: result
      });
    } catch (error: any) {
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
}
