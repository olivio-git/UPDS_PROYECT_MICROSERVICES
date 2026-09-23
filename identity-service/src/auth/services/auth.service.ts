// src/auth/services/auth.service.ts
//
// Core auth logic, merged in-process from the old auth-service. Everything
// that used to be an HTTP call to a separate service (user creation,
// password change/reset, sync) is now a direct call into UserRepository —
// the "_id" is generated exactly once, by MongoDB, when the user document is
// inserted; there is no second id to reconcile.

import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import config from '../../config';
import { UserModel } from '../../models/User';
import { UserRepository } from '../../repositories/user.repository';
import { User, UserRole } from '../../types';
import { AuthCacheRepository } from '../repositories/auth-cache.repository';
import { SessionRepository } from '../repositories/session.repository';
import { AuthTokenPayload, JwtService } from './jwt.service';
import { legacyEventService } from './legacy-event.service';
import { OtpService } from './otp.service';

/**
 * Thrown by login() when the password is correct but the caller skipped (or
 * let expire) the required login OTP step. Carries a machine-readable `code`
 * so the controller can surface `OTP_REQUIRED` to the frontend instead of a
 * generic invalid-credentials message — see auth.controller.ts login().
 */
export class OtpRequiredError extends Error {
  readonly code = 'OTP_REQUIRED' as const;

  constructor(message: string) {
    super(message);
    this.name = 'OtpRequiredError';
  }
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: ReturnType<UserModel['toJSON']>;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Must stay in sync with JwtService.generateAccessToken's expiresIn ('1h').
// Not derived from it programmatically because jsonwebtoken only accepts the
// string form; this is the number of seconds the frontend (see
// frontend/src/services/sdk-simple-auth.ts) uses to schedule its proactive
// refresh.
const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 3600;

const DEFAULT_PROFILE = {
  preferences: {
    language: 'es' as const,
    timezone: 'America/La_Paz',
    notifications: { email: true, push: true, sms: false },
  },
};

export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private sessionRepository: SessionRepository,
    private cacheRepository: AuthCacheRepository,
    private jwtService: JwtService,
    private otpService: OtpService
  ) {}

  // ================================
  // REGISTRATION (public self-service, default role student)
  // ================================

  async register(data: RegisterInput): Promise<AuthResponse> {
    const { email, password, firstName, lastName } = data;
    const role: UserRole = data.role || 'student';

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new Error('El usuario ya existe con este email');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.userRepository.create({
      email: email.toLowerCase(),
      firstName,
      lastName,
      role,
      status: 'active',
      passwordHash,
      profile: DEFAULT_PROFILE,
      permissions: UserModel.getDefaultPermissionsByRole(role),
    } as Omit<User, '_id' | 'createdAt' | 'updatedAt'>);

    // The id is minted once, by Mongo, right above. Mirror it into
    // authServiceUserId for exam-service's read-only copy of this collection
    // (see models/User.ts comment) — this is NOT a second identity.
    await this.userRepository.update(user._id as ObjectId, {
      authServiceUserId: (user._id as ObjectId).toString(),
    });

    const tokens = await this.generateTokensForUser(user);

    await legacyEventService.publishUserEvent('user.registered', {
      userId: user._id!.toString(),
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    await this.cacheRepository.cacheUser(user._id!.toString(), user.toJSON());

    return { user: user.toJSON(), ...tokens, expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS };
  }

  // ================================
  // LOGIN
  // ================================

  async login(data: LoginInput, userAgent?: string, ipAddress?: string): Promise<AuthResponse> {
    const { email, password } = data;

    const user = await this.userRepository.findByEmail(email);
    if (!user || user.status !== 'active' || !user.passwordHash) {
      // Server-side log keeps the precise reason for audit/debugging; the
      // thrown message is intentionally identical to the wrong-password
      // branch below so the client-facing response never reveals whether
      // an account exists (or is merely inactive/suspended).
      console.warn(`Login failed (account not found or inactive): ${email}`);
      throw new Error('Credenciales inválidas');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      // Password checked FIRST, deliberately: we return here before ever
      // touching the login-OTP marker, so a wrong password never reveals
      // (by consuming or not consuming it) whether the OTP step was done.
      // Consequence: the marker survives a wrong-password attempt — a
      // deliberate choice, not an oversight. The marker is redeemable only
      // once and /auth/login is already rate-limited (10/15min), so leaving
      // it intact does not widen the attack surface (an attacker still needs
      // the correct password), while it spares a legitimate user who simply
      // mistypes their password from having to repeat the OTP round trip.
      console.warn(`Login failed (wrong password): ${email}`);
      throw new Error('Credenciales inválidas');
    }

    // OTP-before-password enforcement: the UI always runs OTP first, then
    // password — this requires that order server-side too, instead of
    // trusting the client to have followed it. See otp.controller.ts
    // markLoginOtpVerified (written on a successful purpose='login' verify)
    // and config.otpLoginRequired for the enable/disable flag.
    if (config.otpLoginRequired) {
      const otpVerified = await this.otpService.consumeLoginOtpVerification(email);
      if (!otpVerified) {
        throw new OtpRequiredError('Verifica el código enviado a tu correo antes de iniciar sesión.');
      }
    }

    await this.userRepository.updateLastLogin(user._id as ObjectId);

    const tokens = await this.generateTokensForUser(user, userAgent, ipAddress);

    await legacyEventService.publishUserEvent('user.logged_in', {
      userId: user._id!.toString(),
      email: user.email,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    });

    await this.cacheRepository.cacheUser(user._id!.toString(), user.toJSON());

    return { user: user.toJSON(), ...tokens, expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS };
  }

  // ================================
  // TOKEN LIFECYCLE
  // ================================

  async refreshToken(refreshTokenString: string): Promise<AuthResponse> {
    this.jwtService.verifyRefreshToken(refreshTokenString);

    const session = await this.sessionRepository.findByRefreshToken(refreshTokenString);
    if (!session || session.expiresAt < new Date()) {
      throw new Error('Refresh token inválido o expirado');
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user || user.status !== 'active') {
      throw new Error('Usuario no encontrado o inactivo');
    }

    await this.sessionRepository.deleteByRefreshToken(refreshTokenString);

    const tokens = await this.generateTokensForUser(user);

    await legacyEventService.publishUserEvent('user.token_refreshed', {
      userId: user._id!.toString(),
      email: user.email,
      timestamp: new Date(),
    });

    return { user: user.toJSON(), ...tokens, expiresIn: ACCESS_TOKEN_EXPIRES_IN_SECONDS };
  }

  async logout(refreshToken: string, userId: string): Promise<void> {
    await this.sessionRepository.deleteByRefreshToken(refreshToken);
    await this.cacheRepository.deleteSession(userId);
    await this.cacheRepository.invalidateUserCache(userId);

    await legacyEventService.publishUserEvent('user.logged_out', {
      userId,
      timestamp: new Date(),
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionRepository.deleteAllForUser(userId);
    await this.cacheRepository.deleteSession(userId);
    await this.cacheRepository.invalidateUserCache(userId);

    await legacyEventService.publishUserEvent('user.logged_out_all', {
      userId,
      timestamp: new Date(),
    });
  }

  // ================================
  // ACTIVE-USER GATE (used by the host authenticate middleware on every
  // authenticated request — this, not token blacklisting, is what actually
  // stops a deactivated user from continuing to use an already-issued token)
  // ================================

  async validateUser(userId: string): Promise<UserModel | null> {
    const cached = await this.cacheRepository.getCachedUser(userId);
    if (cached) {
      return cached.status === 'active' ? UserModel.fromDatabase(cached) : null;
    }

    const user = await this.userRepository.findById(userId);
    if (!user) return null;

    await this.cacheRepository.cacheUser(userId, user.toJSON());
    return user.status === 'active' ? user : null;
  }

  // ================================
  // PASSWORD MANAGEMENT (in-process — no more HTTP hop to a separate
  // auth-service)
  // ================================

  /**
   * Confirms the signed-in user's current password without issuing tokens.
   * The password-change screen used to do this by calling login(), which no
   * longer works now that login requires an OTP marker.
   */
  async verifyCurrentPassword(userId: string, password: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.status !== 'active' || !user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.passwordHash) {
      throw new Error('Usuario no encontrado');
    }

    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Contraseña antigua inválida');
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.userRepository.updatePasswordHash(user._id as ObjectId, newHash);

    // A password change is often a reaction to a suspected compromise — it
    // must end every other session, not just refresh the cached snapshot.
    // Same treatment as resetPassword() below (which already revokes all
    // sessions); the caller's own client will simply need to log in again
    // on its next refresh, same as after any other revocation.
    await this.revokeAllSessionsForUser(userId);

    await legacyEventService.publishUserEvent('user.password_changed', {
      userId,
      email: user.email,
    });

    return true;
  }

  /**
   * Admin-triggered reset. `newPassword` may be a caller-supplied value or a
   * generated temporary one — either way this only ever touches the local
   * users collection now.
   */
  async resetPassword(email: string, newPassword: string): Promise<boolean> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await this.userRepository.updatePasswordHash(user._id as ObjectId, newHash);

    await legacyEventService.publishUserEvent('user.password_reset', {
      userId: user._id!.toString(),
      email: user.email,
      timestamp: new Date(),
    });

    // Invalidate all existing sessions for this user, same as auth-service did.
    await this.revokeAllSessionsForUser(user._id!.toString());

    return true;
  }

  generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '!@#$%'[Math.floor(Math.random() * 5)];
    for (let i = 4; i < 12; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * Deactivation must revoke live sessions immediately — this used to be an
   * async Kafka round trip (UMS -> USER_STATUS_CHANGED -> auth-service's own
   * consumer deleting its own copy of the sessions). Now it is the same
   * database, so UserService.deactivateUser calls this directly, synchronously.
   */
  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await this.sessionRepository.deleteAllForUser(userId);
    await this.cacheRepository.deleteSession(userId);
    await this.cacheRepository.invalidateUserCache(userId);
  }

  /**
   * Invalidate only the cached user snapshot (used by the host authenticate
   * middleware's active-status check and by getMe/token-refresh) — does NOT
   * revoke refresh-token sessions. Used after a profile edit (name/email/
   * role) so the change is visible on the very next request, without forcing
   * a full re-login the way revokeAllSessionsForUser does.
   */
  async invalidateUserCache(userId: string): Promise<void> {
    await this.cacheRepository.invalidateUserCache(userId);
  }

  // ================================
  // PRIVATE
  // ================================

  /**
   * Flat permission strings placed on the JWT — identical list to what
   * auth-service's AuthService.getDefaultPermissions() issued before the
   * merge. Not the same shape as UserModel's own Permission[] (resource +
   * actions); kept separate on purpose so the token contract with other
   * services never moves.
   */
  private getFlatDefaultPermissions(role: string): string[] {
    const permissions: Record<string, string[]> = {
      admin: ['*'],
      teacher: ['exam.create', 'exam.manage', 'student.view', 'result.view'],
      proctor: ['session.monitor', 'exam.proctor', 'student.verify'],
      student: ['exam.take', 'result.view'],
    };

    return permissions[role] || permissions.student!;
  }

  private async generateTokensForUser(
    user: UserModel,
    userAgent?: string,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: AuthTokenPayload = {
      userId: user._id!.toString(),
      email: user.email,
      role: user.role,
      // Flat permission strings, exactly like auth-service issued — see the
      // JWTPayload note in types/index.ts.
      permissions: this.getFlatDefaultPermissions(user.role),
    };

    const accessToken = this.jwtService.generateAccessToken(payload);
    const refreshToken = this.jwtService.generateRefreshToken(user._id!.toString());

    const expiresAt = this.jwtService.getTokenExpiration('7d');
    await this.sessionRepository.createSession({
      userId: user._id!.toString(),
      refreshToken,
      userAgent,
      ipAddress,
      expiresAt,
    });

    await this.cacheRepository.setSession(user._id!.toString(), {
      accessToken,
      refreshToken,
      user: user.toJSON(),
    }, 3600);

    return { accessToken, refreshToken };
  }
}
