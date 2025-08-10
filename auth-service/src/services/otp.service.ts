import crypto from 'crypto';
import { CacheRepository } from '../repositories/cache.repository';
import { EventService } from './event.service';
import { UserRepository } from '../repositories/user.repository';

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

  constructor(
    private cacheRepository: CacheRepository,
    private eventService: EventService,
    private userRepository: UserRepository
  ) {}

  async generateOtp(email: string, purpose: OtpData['purpose']): Promise<{ success: boolean; message: string; expiresIn?: number }> {
    // Verificar rate limiting
    const user = await this.userRepository.findUserByEmail(email);
    if (purpose === 'login' && !user) {
      return {
        success: false,
        message: 'Usuario no encontrado'
      };
    };

    // RateLimiting
    const rateLimitKey = `otp_rate_limit:${email}`;
    const rateLimit = await this.cacheRepository.checkRateLimit(rateLimitKey, 3, this.RATE_LIMIT_WINDOW);
    
    if (!rateLimit.allowed) {
      await this.eventService.publishSecurityEvent('otp.rate_limit_exceeded', {
        email,
        purpose,
        timestamp: new Date()
      });
      
      return {
        success: false,
        message: 'Demasiados intentos. Espera antes de solicitar otro código.'
      };
    }

    // Generar código OTP
    const code = this.generateRandomCode();
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MINUTES * 60 * 1000);

    const otpData: OtpData = {
      code,
      email,
      purpose,
      expiresAt,
      attempts: 0,
      maxAttempts: this.MAX_ATTEMPTS
    };

    // Guardar en caché
    const otpKey = this.getOtpKey(email, purpose);
    await this.cacheRepository.set(otpKey, otpData, this.OTP_EXPIRY_MINUTES * 60);

    // Publicar evento para envío de email
    await this.eventService.publishOtpEvent('otp.generated', {
      email,
      code,
      purpose,
      expiresAt,
      templateData: {
        purpose: this.getPurposeDisplayName(purpose),
        expiryMinutes: this.OTP_EXPIRY_MINUTES
      }
    });

    console.log(`📱 OTP generado para ${email}: ${code} (${purpose})`);

    return {
      success: true,
      message: 'Código OTP enviado exitosamente',
      expiresIn: this.OTP_EXPIRY_MINUTES * 60 // en segundos
    };
  }

  async verifyOtp(email: string, code: string, purpose: OtpData['purpose']): Promise<{ success: boolean; message: string }> {
    const otpKey = this.getOtpKey(email, purpose);
    const otpData = await this.cacheRepository.get(otpKey) as OtpData | null;

    if (!otpData) {
      await this.eventService.publishSecurityEvent('otp.not_found', {
        email,
        purpose,
        timestamp: new Date()
      });
      
      return {
        success: false,
        message: 'Código OTP no encontrado o expirado'
      };
    }

    // Verificar expiración
    if (new Date() > otpData.expiresAt) {
      await this.cacheRepository.delete(otpKey);
      
      await this.eventService.publishOtpEvent('otp.expired', {
        email,
        purpose,
        timestamp: new Date()
      });
      
      return {
        success: false,
        message: 'Código OTP expirado'
      };
    }

    // Verificar intentos máximos
    if (otpData.attempts >= otpData.maxAttempts) {
      await this.cacheRepository.delete(otpKey);
      
      await this.eventService.publishSecurityEvent('otp.max_attempts_exceeded', {
        email,
        purpose,
        attempts: otpData.attempts,
        timestamp: new Date()
      });
      
      return {
        success: false,
        message: 'Máximo número de intentos excedido'
      };
    }

    // Verificar código
    if (otpData.code !== code) {
      // Incrementar contador de intentos
      otpData.attempts += 1;
      await this.cacheRepository.set(otpKey, otpData, this.OTP_EXPIRY_MINUTES * 60);
      
      await this.eventService.publishSecurityEvent('otp.invalid_attempt', {
        email,
        purpose,
        attempts: otpData.attempts,
        maxAttempts: otpData.maxAttempts,
        timestamp: new Date()
      });
      
      return {
        success: false,
        message: `Código incorrecto. Intentos restantes: ${otpData.maxAttempts - otpData.attempts}`
      };
    }

    // Código válido - eliminar de caché
    await this.cacheRepository.delete(otpKey);
    
    await this.eventService.publishOtpEvent('otp.verified', {
      email,
      purpose,
      timestamp: new Date()
    });

    return {
      success: true,
      message: 'Código OTP verificado exitosamente'
    };
  }

  async revokeOtp(email: string, purpose: OtpData['purpose']): Promise<void> {
    const otpKey = this.getOtpKey(email, purpose);
    await this.cacheRepository.delete(otpKey);
    
    await this.eventService.publishOtpEvent('otp.revoked', {
      email,
      purpose,
      timestamp: new Date()
    });
  }

  async getOtpStatus(email: string, purpose: OtpData['purpose']): Promise<{
    exists: boolean;
    expiresAt?: Date;
    attemptsRemaining?: number;
  }> {
    const otpKey = this.getOtpKey(email, purpose);
    const otpData = await this.cacheRepository.get(otpKey) as OtpData | null;

    if (!otpData) {
      return { exists: false };
    }

    return {
      exists: true,
      expiresAt: otpData.expiresAt,
      attemptsRemaining: otpData.maxAttempts - otpData.attempts
    };
  }

  private generateRandomCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  private getOtpKey(email: string, purpose: string): string {
    return `otp:${email}:${purpose}`;
  }

  private getPurposeDisplayName(purpose: OtpData['purpose']): string {
    const displayNames: Record<OtpData['purpose'], string> = {
      login: 'inicio de sesión',
      password_reset: 'restablecimiento de contraseña',
      email_verification: 'verificación de email'
    };

    return displayNames[purpose] || purpose;
  }
}
