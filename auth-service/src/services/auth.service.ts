import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/user.repository';
import { CacheRepository } from '../repositories/cache.repository';
import { JwtService } from './jwt.service';
import { EventService } from './event.service';
import { User, AuthResponse, JWTPayload } from '../types';
import { ChangePasswordRequest, LoginRequest, RegisterRequest } from '../schemas/auth.schemas';

export class AuthService {
  constructor(
    private userRepository: UserRepository,
    private cacheRepository: CacheRepository,
    private jwtService: JwtService,
    private eventService: EventService
  ) {}

  async register(registerData: RegisterRequest): Promise<AuthResponse> {
    const { email, password, firstName, lastName, role } = registerData;

    // Verificar si el usuario ya existe
    const existingUser = await this.userRepository.findUserByEmail(email);
    if (existingUser) {
      throw new Error('El usuario ya existe con este email');
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(password, 12);

    // Crear usuario
    const userData: Omit<User, '_id' | 'createdAt' | 'updatedAt'> = {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role,
      isActive: true,
      permissions: this.getDefaultPermissions(role),
      profile: {}
    };

    const user = await this.userRepository.createUser(userData);

    // Generar tokens
    const tokens = await this.generateTokensForUser(user);

    // Emitir evento
    await this.eventService.publishUserEvent('user.registered', {
      userId: user._id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    });

    // Cachear usuario
    await this.cacheRepository.cacheUser(user._id!, this.sanitizeUser(user));

    return {
      user: this.sanitizeUser(user),
      ...tokens,
      expiresIn: 3600 // 1 hora
    };
  }

  async changePassword(changePassword:ChangePasswordRequest):Promise<boolean> {
    const { userId, oldPassword, newPassword } = changePassword;
    console.log(changePassword," Change password request received");
    // Buscar usuario
    const user = await this.userRepository.findUserById(userId);
    console.log(user," User found for password change");
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    // Verificar contraseña antigua
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new Error('Contraseña antigua inválida');
    }

    // Hash de la nueva contraseña
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Actualizar contraseña
    await this.userRepository.updateUserPassword(user._id as string, hashedNewPassword);

    return true;
  }

  async login(loginData: LoginRequest, userAgent?: string, ipAddress?: string): Promise<AuthResponse> {
    const { email, password } = loginData;

    // Buscar usuario
    const user = await this.userRepository.findUserByEmail(email);
    if (!user || !user.isActive) {
      throw new Error('Usuario no encontrado o inactivo');
    }

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Credenciales inválidas');
    }

    // Actualizar último login
    await this.userRepository.updateLastLogin(user._id!);

    // Generar tokens
    const tokens = await this.generateTokensForUser(user, userAgent, ipAddress);

    // Emitir evento
    await this.eventService.publishUserEvent('user.logged_in', {
      userId: user._id?.toString(),
      email: user.email,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });

    // Cachear usuario
    await this.cacheRepository.cacheUser(user._id!, this.sanitizeUser(user));

    return {
      user: this.sanitizeUser(user),
      ...tokens,
      expiresIn: 3600
    };
  }

  async refreshToken(refreshTokenString: string): Promise<AuthResponse> {
    // Verificar refresh token
    const decoded = this.jwtService.verifyRefreshToken(refreshTokenString);
    
    // Buscar sesión
    const session = await this.userRepository.findSessionByRefreshToken(refreshTokenString);
    if (!session || session.expiresAt < new Date()) {
      throw new Error('Refresh token inválido o expirado');
    }

    // Buscar usuario
    const user = await this.userRepository.findUserById(session.userId);
    if (!user || !user.isActive) {
      throw new Error('Usuario no encontrado o inactivo');
    }

    // Eliminar sesión anterior
    await this.userRepository.deleteSession(refreshTokenString);

    // Generar nuevos tokens
    const tokens = await this.generateTokensForUser(user);

    // Emitir evento
    await this.eventService.publishUserEvent('user.token_refreshed', {
      userId: user._id?.toString(),
      email: user.email,
      timestamp: new Date()
    });

    return {
      user: this.sanitizeUser(user),
      ...tokens,
      expiresIn: 3600
    };
  }

  async logout(refreshToken: string, userId: string): Promise<void> {
    // Eliminar sesión
    await this.userRepository.deleteSession(refreshToken);

    // Eliminar caché del usuario
    await this.cacheRepository.deleteSession(userId);
    await this.cacheRepository.invalidateUserCache(userId);

    // Emitir evento
    await this.eventService.publishUserEvent('user.logged_out', {
      userId,
      timestamp: new Date()
    });
  }

  async logoutAll(userId: string): Promise<void> {
    // Eliminar todas las sesiones del usuario
    await this.userRepository.deleteUserSessions(userId);

    // Limpiar caché
    await this.cacheRepository.deleteSession(userId);
    await this.cacheRepository.invalidateUserCache(userId);

    // Emitir evento
    await this.eventService.publishUserEvent('user.logged_out_all', {
      userId:userId.toString(),
      timestamp: new Date()
    });
  }

  async validateUser(userId: string): Promise<User | null> {
    // Intentar obtener del caché primero
    let user = await this.cacheRepository.getCachedUser(userId);
    
    if (!user) {
      // Si no está en caché, buscar en la base de datos
      user = await this.userRepository.findUserById(userId);
      if (user) {
        // Cachear para futuras consultas
        await this.cacheRepository.cacheUser(userId, this.sanitizeUser(user));
      }
    }

    return user && user.isActive ? user : null;
  }

  private async generateTokensForUser(
    user: User, 
    userAgent?: string, 
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Payload para el access token
    const tokenPayload: JWTPayload = {
      userId: user._id!.toString(),
      email: user.email,
      role: user.role,
      permissions: user.permissions
    };

    // Generar tokens
    const accessToken = this.jwtService.generateAccessToken(tokenPayload);
    const refreshToken = this.jwtService.generateRefreshToken(user._id!);

    // Crear sesión en la base de datos
    const expiresAt = this.jwtService.getTokenExpiration('7d');
    await this.userRepository.createSession({
      userId: user._id!.toString(),
      refreshToken,
      userAgent,
      ipAddress,
      expiresAt
    });

    // Cachear sesión en Redis
    await this.cacheRepository.setSession(user._id!, {
      accessToken,
      refreshToken,
      user: this.sanitizeUser(user)
    }, 3600); // 1 hora

    return { accessToken, refreshToken };
  }

  private getDefaultPermissions(role: string): string[] {
    const permissions: Record<string, string[]> = {
      admin: ['*'],
      teacher: ['exam.create', 'exam.manage', 'student.view', 'result.view'],
      proctor: ['session.monitor', 'exam.proctor', 'student.verify'],
      student: ['exam.take', 'result.view']
    };

    return permissions[role] || permissions.student;
  }

  private sanitizeUser(user: User): Omit<User, 'password'> {
    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }
}
