// src/auth/services/jwt.service.ts
//
// Ported from auth-service/src/services/jwt.service.ts verbatim: same
// secrets, same issuer/audience, same expirations. Other services (exam,
// session-manager, notifications, grading) verify tokens issued here with
// JWT_SECRET and read claims userId/email/role — the shape and signing
// parameters below MUST stay identical to what auth-service issued before
// this merge.

import jwt from 'jsonwebtoken';
import config from '../../config';

// Flat payload shape actually placed on the wire (see types/index.ts note on
// JWTPayload — the shared type says permissions: Permission[], but the real
// token always carries permissions: string[], exactly like auth-service did).
export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
}

export class JwtService {
  generateAccessToken(payload: AuthTokenPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: '2d',
      issuer: 'cba-auth-service',
      audience: 'cba-platform',
    });
  }

  generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'refresh' },
      config.jwt.refreshSecret,
      {
        expiresIn: '7d',
        issuer: 'cba-auth-service',
        audience: 'cba-platform',
      }
    );
  }

  verifyAccessToken(token: string): AuthTokenPayload {
    try {
      return jwt.verify(token, config.jwt.secret, {
        issuer: 'cba-auth-service',
        audience: 'cba-platform',
      }) as AuthTokenPayload;
    } catch (error) {
      throw new Error('Token inválido o expirado');
    }
  }

  verifyRefreshToken(token: string): { userId: string; type: string } {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret, {
        issuer: 'cba-auth-service',
        audience: 'cba-platform',
      }) as { userId: string; type: string };

      if (decoded.type !== 'refresh') {
        throw new Error('Tipo de token inválido');
      }

      return decoded;
    } catch (error) {
      throw new Error('Refresh token inválido o expirado');
    }
  }

  getTokenExpiration(expiresIn: string): Date {
    const now = new Date();
    const match = expiresIn.match(/^(\d+)([hdwmy])$/);

    if (!match) {
      throw new Error('Formato de expiración inválido');
    }

    const value = parseInt(match[1] as string, 10);
    const unit = match[2];

    switch (unit) {
      case 'h':
        return new Date(now.getTime() + value * 60 * 60 * 1000);
      case 'd':
        return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
      case 'w':
        return new Date(now.getTime() + value * 7 * 24 * 60 * 60 * 1000);
      case 'm':
        return new Date(now.getTime() + value * 30 * 24 * 60 * 60 * 1000);
      case 'y':
        return new Date(now.getTime() + value * 365 * 24 * 60 * 60 * 1000);
      default:
        throw new Error('Unidad de tiempo no soportada');
    }
  }

  decodeTokenPayload(token: string): any {
    try {
      return jwt.decode(token);
    } catch (error) {
      throw new Error('Error decodificando el token');
    }
  }

  getTokenJti(token: string): string | null {
    const decoded = this.decodeTokenPayload(token);
    return decoded?.jti || null;
  }
}

export const jwtService = new JwtService();
