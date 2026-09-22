// src/auth/services/otp.service.ts
//
// Ported from auth-service/src/services/otp.service.ts. Same OTP length,
// expiry, attempt limits and rate-limit window; same Redis key shape
// (otp:<email>:<purpose>) so nothing else needs to change.

import crypto from 'crypto';
import { AuthCacheRepository } from '../repositories/auth-cache.repository';
import { legacyEventService } from './legacy-event.service';
import { UserRepository } from '../../repositories/user.repository';

export interface OtpData {
  code: string;
  email: string;
  purpose: 'login' | 'password_reset' | 'email_verification';
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
}

export class OtpService {
  private readonly OTP_LENGTH = 6;
  private readonly OTP_EXPIRY_MINUTES = 10;
  private readonly MAX_ATTEMPTS = 3;
  private readonly RATE_LIMIT_WINDOW = 300; // 5 minutos

  private readonly RESET_TOKEN_TTL_SECONDS = 600; // 10 minutos

  constructor(
    private cacheRepository: AuthCacheRepository,
    private userRepository: UserRepository
  ) {}

  /**
   * Issues a single-use token proving the holder verified a password_reset OTP
   * for this email. /auth/reset-password accepts only this token, never a bare
   * email, so knowing someone's email is not enough to take over the account.
   */
  async issuePasswordResetToken(email: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    await this.cacheRepository.set(this.getResetTokenKey(token), email.toLowerCase(), this.RESET_TOKEN_TTL_SECONDS);
    return token;
  }

  /** Returns the email bound to the token and invalidates it, or null if unknown/expired. */
  async consumePasswordResetToken(token: string): Promise<string | null> {
    return this.cacheRepository.consume(this.getResetTokenKey(token));
  }

  private getResetTokenKey(token: string): string {
    return `pwreset:${token}`;
  }

  async generateOtp(email: string, purpose: OtpData['purpose']): Promise<{ success: boolean; message: string; expiresIn?: number }> {
    // Normalize once at the entry point: the rate-limit key, the OTP key and
    // the persisted email must all agree, or "Test@x.com" and "test@x.com"
    // get separate rate-limit budgets and separate OTP slots for the same
    // account.
    email = this.normalizeEmail(email);

    const user = await this.userRepository.findByEmail(email);
    if (purpose === 'login' && !user) {
      return { success: false, message: 'Usuario no encontrado' };
    }

    const rateLimitKey = `otp_rate_limit:${email}`;
    const rateLimit = await this.cacheRepository.checkRateLimit(rateLimitKey, 3, this.RATE_LIMIT_WINDOW);

    if (!rateLimit.allowed) {
      await legacyEventService.publishSecurityEvent('otp.rate_limit_exceeded', {
        email,
        purpose,
        timestamp: new Date(),
      });

      return {
        success: false,
        message: 'Demasiados intentos. Espera antes de solicitar otro código.',
      };
    }

    const code = this.generateRandomCode();
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

    const otpData: OtpData = {
      code,
      email,
      purpose,
      expiresAt,
      attempts: 0,
      maxAttempts: this.MAX_ATTEMPTS,
    };

    const otpKey = this.getOtpKey(email, purpose);
    await this.cacheRepository.set(otpKey, otpData, this.OTP_EXPIRY_MINUTES * 60);

    await legacyEventService.publishOtpEvent('otp.generated', {
      email,
      code,
      purpose,
      expiresAt,
      templateData: {
        purpose: this.getPurposeDisplayName(purpose),
        expiryMinutes: this.OTP_EXPIRY_MINUTES,
      },
    });

    console.log(`OTP generated for ${email} (${purpose})`);

    return {
      success: true,
      message: 'Código OTP enviado exitosamente',
      expiresIn: this.OTP_EXPIRY_MINUTES * 60,
    };
  }

  async verifyOtp(email: string, code: string, purpose: OtpData['purpose']): Promise<{ success: boolean; message: string }> {
    email = this.normalizeEmail(email);
    const otpKey = this.getOtpKey(email, purpose);
    const otpData = (await this.cacheRepository.get(otpKey)) as OtpData | null;

    if (!otpData) {
      await legacyEventService.publishSecurityEvent('otp.not_found', { email, purpose, timestamp: new Date() });
      return { success: false, message: 'Código OTP no encontrado o expirado' };
    }

    if (new Date() > new Date(otpData.expiresAt)) {
      await this.cacheRepository.delete(otpKey);
      await legacyEventService.publishOtpEvent('otp.expired', { email, purpose, timestamp: new Date() });
      return { success: false, message: 'Código OTP expirado' };
    }

    if (otpData.attempts >= otpData.maxAttempts) {
      await this.cacheRepository.delete(otpKey);
      await legacyEventService.publishSecurityEvent('otp.max_attempts_exceeded', {
        email,
        purpose,
        attempts: otpData.attempts,
        timestamp: new Date(),
      });
      return { success: false, message: 'Máximo número de intentos excedido' };
    }

    if (otpData.code !== code) {
      otpData.attempts += 1;
      await this.cacheRepository.set(otpKey, otpData, this.OTP_EXPIRY_MINUTES * 60);

      await legacyEventService.publishSecurityEvent('otp.invalid_attempt', {
        email,
        purpose,
        attempts: otpData.attempts,
        maxAttempts: otpData.maxAttempts,
        timestamp: new Date(),
      });

      return {
        success: false,
        message: `Código incorrecto. Intentos restantes: ${otpData.maxAttempts - otpData.attempts}`,
      };
    }

    await this.cacheRepository.delete(otpKey);
    await legacyEventService.publishOtpEvent('otp.verified', { email, purpose, timestamp: new Date() });

    return { success: true, message: 'Código OTP verificado exitosamente' };
  }

  async revokeOtp(email: string, purpose: OtpData['purpose']): Promise<void> {
    email = this.normalizeEmail(email);
    const otpKey = this.getOtpKey(email, purpose);
    await this.cacheRepository.delete(otpKey);
    await legacyEventService.publishOtpEvent('otp.revoked', { email, purpose, timestamp: new Date() });
  }

  async getOtpStatus(email: string, purpose: OtpData['purpose']): Promise<{
    exists: boolean;
    expiresAt?: Date;
    attemptsRemaining?: number;
  }> {
    email = this.normalizeEmail(email);
    const otpKey = this.getOtpKey(email, purpose);
    const otpData = (await this.cacheRepository.get(otpKey)) as OtpData | null;

    if (!otpData) {
      return { exists: false };
    }

    return {
      exists: true,
      expiresAt: otpData.expiresAt,
      attemptsRemaining: otpData.maxAttempts - otpData.attempts,
    };
  }

  private generateRandomCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  private getOtpKey(email: string, purpose: string): string {
    return `otp:${email}:${purpose}`;
  }

  /**
   * Lowercases and trims an email so the rate-limit key and the OTP key
   * agree for every case variant of the same address — otherwise
   * "Test@x.com" and "test@x.com" get separate rate-limit budgets and
   * separate OTP slots for what is really one account.
   */
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getPurposeDisplayName(purpose: OtpData['purpose']): string {
    const displayNames: Record<OtpData['purpose'], string> = {
      login: 'inicio de sesión',
      password_reset: 'restablecimiento de contraseña',
      email_verification: 'verificación de email',
    };

    return displayNames[purpose] || purpose;
  }
}
