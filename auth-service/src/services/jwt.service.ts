import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JWTPayload } from '../types';

export class JwtService {
  
  generateAccessToken(payload: JWTPayload): string {
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: '1h',
      issuer: 'cba-auth-service',
      audience: 'cba-platform'
    });
  }

  generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'refresh' },
      config.jwt.refreshSecret,
      {
        expiresIn: '1h',
        issuer: 'cba-auth-service',
        audience: 'cba-platform'
      }
    );
  }

  verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.secret, {
        issuer: 'cba-auth-service',
        audience: 'cba-platform'
      }) as JWTPayload;
      
      return decoded;
    } catch (error) {
      throw new Error('Token inválido o expirado');
    }
  }

  verifyRefreshToken(token: string): { userId: string; type: string } {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret, {
        issuer: 'cba-auth-service',
        audience: 'cba-platform'
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
    
    const value = parseInt(match[1]);
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
