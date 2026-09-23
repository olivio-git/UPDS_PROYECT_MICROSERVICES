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

  // How long a completed login OTP verification stays redeemable by
  // /auth/login before it must be repeated. See markLoginOtpVerified /
  // consumeLoginOtpVerification below and auth.service.ts login().
  private readonly LOGIN_OTP_VERIFIED_TTL_SECONDS = 600; // 10 minutos

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

  /**
   * Marks that `email` just completed a purpose='login' OTP verification, so
   * the /auth/login call that (per the UI flow) follows immediately can bind
   * to it. A random nonce is stored, not a boolean — the value itself is
   * never inspected, only its presence, but a nonce keeps the key from ever
   * being confused with a cached boolean/flag written by unrelated code.
   */
  async markLoginOtpVerified(email: string): Promise<void> {
    const normalized = this.normalizeEmail(email);
    const nonce = crypto.randomBytes(16).toString('hex');
    await this.cacheRepository.set(this.getLoginVerifiedKey(normalized), nonce, this.LOGIN_OTP_VERIFIED_TTL_SECONDS);
  }

  /**
   * Atomically reads-and-deletes the login OTP marker for `email` (GETDEL
   * pattern, same as consumePasswordResetToken) so it can be redeemed exactly
   * once. Returns true only if a still-valid marker was present.
   */
  async consumeLoginOtpVerification(email: string): Promise<boolean> {
    const normalized = this.normalizeEmail(email);
    const value = await this.cacheRepository.consume(this.getLoginVerifiedKey(normalized));
    return value !== null;
  }

  private getLoginVerifiedKey(email: string): string {
    return `login_otp_verified:${email}`;
  }

  async generateOtp(email: string, purpose: OtpData['purpose']): Promise<{ success: boolean; message: string; expiresIn?: number }> {
    // Normalize once at the entry point: the rate-limit key, the OTP key and
    // the persisted email must all agree, or "Test@x.com" and "test@x.com"
    // get separate rate-limit budgets and separate OTP slots for the same
    // account.
    email = this.normalizeEmail(email);

    // Rate limit is checked (and counted) BEFORE the account-existence
    // lookup, and unconditionally of it, so an unknown email cannot be used
    // to bypass the quota — the counter must advance identically whether or
    // not the account exists, otherwise the quota itself becomes an
    // enumeration oracle (a known email would eventually hit "too many
    // attempts" while an unknown one never would).
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

    const user = await this.userRepository.findByEmail(email);
    const successResponse = {
      success: true as const,
      message: 'Código OTP enviado exitosamente',
      expiresIn: this.OTP_EXPIRY_MINUTES * 60,
    };

    // Do not leak account existence through OTP generation: for purpose
    // 'login' (the only purpose that used to reveal this — see the removed
    // early-return this replaces), an unknown email gets the exact same
    // success-shaped response as a real one, but no code is generated and no
    // mail is sent. The precise reason is only ever logged server-side.
    if (purpose === 'login' && !user) {
      console.log(`OTP generate skipped for ${email} (login, no such account)`);
      return successResponse;
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

    return successResponse;
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

  // revokeOtp/getOtpStatus were removed with the unauthenticated
  // /otp/revoke and /otp/status routes (see auth.routes.ts) — nothing
  // called them, and taking a bare email with no proof of ownership let
  // anyone cancel or probe someone else's in-flight OTP.

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
