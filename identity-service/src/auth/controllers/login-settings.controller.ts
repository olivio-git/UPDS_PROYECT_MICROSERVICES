import { Request, Response } from 'express';
import { auditLog } from '../../services/audit.service';
import { AuthService } from '../services/auth.service';
import { LoginSettingsRepository } from '../repositories/login-settings.repository';
import { ApiResponse, JWTPayload } from '../../types';

export class LoginSettingsController {
  constructor(private authService: AuthService, private loginSettingsRepository: LoginSettingsRepository) {}

  /**
   * Public. `otpRequired` is what the login screen follows; `quickLogin` is
   * the admin switch itself (they differ only when OTP is off by env).
   */
  get = async (_req: Request, res: Response<ApiResponse>) => {
    const otpRequired = await this.authService.isOtpRequired();
    let quickLogin = false;
    try {
      quickLogin = (await this.loginSettingsRepository.get()).quickLogin;
    } catch {
      // Same fail-closed reading as isOtpRequired(): unknown means off.
    }
    res.status(200).json({ success: true, message: 'Configuración de inicio de sesión', data: { quickLogin, otpRequired } });
  };

  /** Admin only: turns quick login (no OTP) on or off for every account. */
  update = async (req: Request<{}, ApiResponse, { quickLogin: boolean }>, res: Response<ApiResponse>) => {
    const user = req.user as JWTPayload;
    const settings = await this.loginSettingsRepository.setQuickLogin(req.body.quickLogin, user.email || user.userId);

    auditLog('settings.quick_login.updated', { type: 'settings', id: 'login', name: 'Inicio rápido' }, {
      req,
      details: { quickLogin: settings.quickLogin },
      service: 'identity-service',
    });

    const otpRequired = await this.authService.isOtpRequired();
    res.status(200).json({
      success: true,
      message: settings.quickLogin ? 'Inicio rápido activado' : 'Inicio rápido desactivado',
      data: { quickLogin: settings.quickLogin, otpRequired },
    });
  };
}
