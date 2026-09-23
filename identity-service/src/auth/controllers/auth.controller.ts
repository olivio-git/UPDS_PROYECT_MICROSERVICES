import { Request, Response } from 'express';
import { auditLog } from '../../services/audit.service';
import { AuthService, OtpRequiredError } from '../services/auth.service';
import { OtpService } from '../services/otp.service';
import { ChangePasswordRequest, LoginRequest, RefreshTokenRequest, RegisterRequest, ResetPasswordRequest } from '../schemas/auth.schemas';
import { ApiResponse, JWTPayload } from '../../types';

export class AuthController {
  constructor(private authService: AuthService, private otpService: OtpService) {}

  register = async (req: Request<{}, ApiResponse, RegisterRequest>, res: Response<ApiResponse>) => {
    try {
      // Public endpoint: never trust a client-supplied role. Staff accounts are
      // created by an admin through /api/v1/users.
      const result = await this.authService.register({ ...req.body, role: 'student' });

      auditLog('user.registered', { type: 'user', name: req.body.email }, {
        actor: { email: req.body.email, role: result.user.role },
        req,
        status: 'success',
        service: 'identity-service',
      });

      res.status(201).json({
        success: true,
        message: 'Usuario registrado exitosamente',
        data: result,
      });
    } catch (error: any) {
      auditLog('user.registered', { type: 'user', name: req.body.email }, {
        actor: { email: req.body.email },
        req,
        status: 'failure',
        details: { reason: error.message },
        service: 'identity-service',
      });
      res.status(400).json({
        success: false,
        message: error.message || 'Error en el registro',
        error: 'Registration failed',
      });
    }
  };

  login = async (req: Request<{}, ApiResponse, LoginRequest>, res: Response<ApiResponse>) => {
    try {
      const userAgent = req.get('User-Agent');
      const ip = req.ip || req.socket.remoteAddress;
      const result = await this.authService.login(req.body, userAgent, ip);

      auditLog('user.login', { type: 'user', name: req.body.email }, {
        actor: { email: req.body.email, ip },
        status: 'success',
        service: 'identity-service',
      });

      res.status(200).json({
        success: true,
        message: 'Inicio de sesión exitoso',
        data: result,
      });
    } catch (error: any) {
      const isOtpRequired = error instanceof OtpRequiredError;

      auditLog('user.login', { type: 'user', name: req.body.email }, {
        actor: { email: req.body.email, ip: req.ip },
        status: 'failure',
        details: { reason: error.message, otpRequired: isOtpRequired },
        service: 'identity-service',
      });
      res.status(401).json({
        success: false,
        message: error.message || 'Error en el inicio de sesión',
        // Machine-readable code so the frontend can distinguish "go verify
        // the OTP" from any other login failure. See OtpRequiredError.
        error: isOtpRequired ? 'OTP_REQUIRED' : 'Login failed',
      });
    }
  };

  refreshToken = async (req: Request<{}, ApiResponse, RefreshTokenRequest>, res: Response<ApiResponse>) => {
    try {
      const result = await this.authService.refreshToken(req.body.refreshToken);
      res.status(200).json({ success: true, message: 'Token renovado exitosamente', data: result });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        message: error.message || 'Error renovando el token',
        error: 'Token refresh failed',
      });
    }
  };

  logout = async (req: Request, res: Response<ApiResponse>) => {
    try {
      const { refreshToken } = req.body;
      const user = req.user as JWTPayload | undefined;

      if (!refreshToken || !user) {
        res.status(400).json({ success: false, message: 'Refresh token requerido', error: 'Missing refresh token' });
        return;
      }

      await this.authService.logout(refreshToken, user.userId);

      auditLog('user.logout', { type: 'user', id: user.userId }, {
        actor: { userId: user.userId, email: user.email, role: user.role },
        req,
        status: 'success',
        service: 'identity-service',
      });

      res.status(200).json({ success: true, message: 'Sesión cerrada exitosamente' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Error cerrando sesión', error: 'Logout failed' });
    }
  };

  logoutAll = async (req: Request, res: Response<ApiResponse>) => {
    try {
      const user = req.user as JWTPayload | undefined;
      if (!user) {
        res.status(401).json({ success: false, message: 'Usuario no autenticado', error: 'Not authenticated' });
        return;
      }

      await this.authService.logoutAll(user.userId);
      res.status(200).json({ success: true, message: 'Todas las sesiones cerradas exitosamente' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Error cerrando todas las sesiones', error: 'Logout all failed' });
    }
  };

  getProfile = async (req: Request, res: Response<ApiResponse>) => {
    try {
      const user = req.user as JWTPayload | undefined;
      if (!user) {
        res.status(401).json({ success: false, message: 'Usuario no autenticado', error: 'Not authenticated' });
        return;
      }

      const fullUser = await this.authService.validateUser(user.userId);
      if (!fullUser) {
        res.status(404).json({ success: false, message: 'Usuario no encontrado', error: 'User not found' });
        return;
      }

      res.status(200).json({ success: true, message: 'Perfil obtenido exitosamente', data: { user: fullUser.toJSON() } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Error obteniendo el perfil', error: 'Profile fetch failed' });
    }
  };

  validateToken = async (req: Request, res: Response<ApiResponse>) => {
    const user = req.user as JWTPayload | undefined;
    if (!user) {
      res.status(401).json({ success: false, message: 'Token inválido', error: 'Invalid token' });
      return;
    }
    res.status(200).json({ success: true, message: 'Token válido', data: { user, isValid: true } });
  };

  verifyPassword = async (req: Request, res: Response<ApiResponse>) => {
    const user = req.user as JWTPayload | undefined;
    if (!user) {
      res.status(401).json({ success: false, message: 'Usuario no autenticado', error: 'Not authenticated' });
      return;
    }

    const { password } = req.body as { password: string };
    const valid = await this.authService.verifyCurrentPassword(user.userId, password);

    res.status(valid ? 200 : 401).json({
      success: valid,
      message: valid ? 'Contraseña verificada' : 'Contraseña actual incorrecta',
      data: { valid },
    });
  };

  changePassword = async (req: Request<{}, ApiResponse, ChangePasswordRequest>, res: Response<ApiResponse>) => {
    const user = req.user as JWTPayload | undefined;
    try {
      if (!user) {
        res.status(401).json({ success: false, message: 'Usuario no autenticado', error: 'Not authenticated' });
        return;
      }

      const { oldPassword, newPassword } = req.body;
      await this.authService.changePassword(user.userId, oldPassword, newPassword);

      auditLog('user.password_changed', { type: 'user', id: user.userId }, {
        actor: { userId: user.userId, email: user.email, role: user.role },
        req,
        status: 'success',
        service: 'identity-service',
      });

      res.status(200).json({ success: true, message: 'Contraseña cambiada exitosamente', data: { success: true } });
    } catch (error: any) {
      auditLog('user.password_changed', { type: 'user', id: user?.userId }, {
        actor: { userId: user?.userId, email: user?.email, role: user?.role },
        req,
        status: 'failure',
        details: { reason: error.message },
        service: 'identity-service',
      });
      res.status(400).json({ success: false, message: error.message || 'Error cambiando la contraseña', error: 'Change password failed' });
    }
  };

  resetPassword = async (req: Request<{}, ApiResponse, ResetPasswordRequest>, res: Response<ApiResponse>) => {
    try {
      const { resetToken, newPassword } = req.body;
      const email = await this.otpService.consumePasswordResetToken(resetToken);
      if (!email) {
        res.status(400).json({ success: false, message: 'El enlace de restablecimiento es inválido o expiró. Solicita un nuevo código.', error: 'Invalid reset token' });
        return;
      }
      const result = await this.authService.resetPassword(email, newPassword);

      auditLog('user.password_reset', { type: 'user', name: email }, {
        actor: { email },
        req,
        status: 'success',
        service: 'identity-service',
      });

      res.status(200).json({ success: true, message: 'Contraseña restablecida exitosamente', data: { success: result } });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Error restableciendo la contraseña', error: 'Password reset failed' });
    }
  };
}
