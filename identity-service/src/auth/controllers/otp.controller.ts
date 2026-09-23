import { Request, Response } from 'express';
import { OtpData, OtpService } from '../services/otp.service';
import { ApiResponse } from '../../types';

interface OtpGenerateRequest {
  email: string;
  purpose: OtpData['purpose'];
}

interface OtpVerifyRequest {
  email: string;
  code: string;
  purpose: OtpData['purpose'];
}

export class OtpController {
  constructor(private otpService: OtpService) {}

  generateOtp = async (req: Request<{}, ApiResponse, OtpGenerateRequest>, res: Response<ApiResponse>) => {
    try {
      const { email, purpose } = req.body;

      if (!email || !purpose) {
        res.status(400).json({ success: false, message: 'Email y propósito son requeridos', error: 'Missing required fields' });
        return;
      }

      const result = await this.otpService.generateOtp(email, purpose);

      if (!result.success) {
        res.status(429).json({ success: false, message: result.message, error: 'OTP generation failed' });
        return;
      }

      res.status(200).json({ success: true, message: result.message, data: { expiresIn: result.expiresIn, purpose } });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Error generando OTP', error: 'OTP generation error' });
    }
  };

  verifyOtp = async (req: Request<{}, ApiResponse, OtpVerifyRequest>, res: Response<ApiResponse>) => {
    try {
      const { email, code, purpose } = req.body;

      if (!email || !code || !purpose) {
        res.status(400).json({ success: false, message: 'Email, código y propósito son requeridos', error: 'Missing required fields' });
        return;
      }

      const result = await this.otpService.verifyOtp(email, code, purpose);

      if (!result.success) {
        res.status(400).json({ success: false, message: result.message, error: 'OTP verification failed' });
        return;
      }

      const data: Record<string, unknown> = { verified: true, purpose };
      if (purpose === 'password_reset') {
        data.resetToken = await this.otpService.issuePasswordResetToken(email);
      }
      if (purpose === 'login') {
        // Binds this verification to the /auth/login call the UI makes right
        // after — see otp.service.ts markLoginOtpVerified and
        // auth.service.ts login().
        await this.otpService.markLoginOtpVerified(email);
      }

      res.status(200).json({ success: true, message: result.message, data });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Error verificando OTP', error: 'OTP verification error' });
    }
  };

  // getOtpStatus/revokeOtp were removed along with their unauthenticated
  // GET /auth/otp/status and DELETE /auth/otp/revoke routes — neither had
  // any caller (frontend or otherwise) and both let anyone probe or cancel
  // an arbitrary email's in-flight OTP. See auth.routes.ts.
}
