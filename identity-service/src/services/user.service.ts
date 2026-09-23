import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/user.repository';
import { AuthService } from '../auth/services/auth.service';
import { SessionRepository } from '../auth/repositories/session.repository';
import { AuthCacheRepository } from '../auth/repositories/auth-cache.repository';
import { JwtService } from '../auth/services/jwt.service';
import { OtpService } from '../auth/services/otp.service';
import {
  ApiResponse,
  CreateUserRequest,
  FilterParams,
  PaginationParams,
  UpdateUserRequest,
  UserRole,
  UserStatus
} from '../types';
import { eventService } from './event.service';

export class UserService {
  private userRepository: UserRepository;
  // The credentials side of user management (password hashing, sessions)
  // used to be a separate HTTP call to auth-service. It is now the same
  // in-process AuthService the /auth/* routes use — constructed here rather
  // than imported as a singleton because this class, like AuthService's own
  // dependencies, must only be built after Mongo/Redis are connected (which
  // is guaranteed: UserService is only ever `new`'d from a controller, and
  // controllers are only instantiated via routes/index.ts's dynamic import,
  // which runs after connectDatabases()).
  private authService: AuthService;

  constructor() {
    this.userRepository = new UserRepository();
    const authCacheRepository = new AuthCacheRepository();
    this.authService = new AuthService(
      this.userRepository,
      new SessionRepository(),
      authCacheRepository,
      new JwtService(),
      // UserService never calls AuthService.login() (see the methods it
      // actually uses below) — this OtpService instance only exists to
      // satisfy the constructor signature.
      new OtpService(authCacheRepository, this.userRepository)
    );
    console.log('👤 UserService inicializado');
  }

  // ================================
  // BOOTSTRAP - FIRST ADMIN CREATION
  // ================================

  /**
   * Crear el primer usuario administrador del sistema
   * Solo funciona si no existen usuarios
   */
  async createFirstAdmin(adminData: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role: 'admin';
  }): Promise<ApiResponse<any>> {
    try {
      console.log('🚀 Iniciando creación del primer administrador:', adminData.email);

      // 1. Verificar que no existan usuarios
      const existingUsersCount = await this.userRepository.count();
      if (existingUsersCount > 0) {
        return {
          success: false,
          message: 'El sistema ya tiene usuarios registrados. Bootstrap deshabilitado.',
          error: 'BOOTSTRAP_DISABLED'
        };
      }

      // 2. Verificar que el email no exista (aunque debería ser imposible)
      const existingUser = await this.userRepository.findByEmail(adminData.email);
      if (existingUser) {
        return {
          success: false,
          message: 'Un usuario con este email ya existe',
          error: 'EMAIL_EXISTS'
        };
      }

      // 3. Hash the password and create the user document directly — the
      // "one person, one id" model means there is only ever one insert, and
      // Mongo mints the _id right here (no separate auth-service round trip,
      // no second id to reconcile).
      console.log('🔐 Generando credenciales...');
      const passwordHash = await bcrypt.hash(adminData.password, 12);

      const userProfile = {
        email: adminData.email.toLowerCase(),
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        role: 'admin' as UserRole,
        status: 'active' as UserStatus,
        passwordHash,

        // Permisos completos de administrador
        permissions: [
          { resource: 'users', actions: ['create', 'read', 'update', 'delete', 'manage'] },
          { resource: 'candidates', actions: ['create', 'read', 'update', 'delete', 'manage'] },
          { resource: 'roles', actions: ['create', 'read', 'update', 'delete', 'manage'] },
          { resource: 'exams', actions: ['create', 'read', 'update', 'delete', 'manage'] },
          { resource: 'sessions', actions: ['create', 'read', 'update', 'delete', 'manage'] },
          { resource: 'reports', actions: ['create', 'read', 'update', 'delete', 'manage'] },
          { resource: 'system', actions: ['configure', 'monitor', 'backup'] }
        ],
        
        // Datos específicos
        profile: {
          preferences: {
            language: "es" as "es",
            timezone: 'America/La_Paz',
            notifications: {
              email: true,
              push: true,
              sms: false
            }
          }
        },
        
        // Metadatos
        createdBy: 'BOOTSTRAP',
        lastSync: new Date(),
        isBootstrapAdmin: true // Flag especial
      };

      console.log('💾 Creando registro en user-management...');
      const user = await this.userRepository.create(userProfile);

      // Mirror the freshly-minted _id into authServiceUserId — kept only for
      // exam-service's read-only copy of this collection, see models/User.ts.
      await this.userRepository.update(user._id as ObjectId, {
        authServiceUserId: (user._id as ObjectId).toString(),
      });

      console.log('✅ Primer administrador creado exitosamente');

      // NO publicar eventos Kafka para evitar envío de email (ya tiene las credenciales)

      return {
        success: true,
        message: 'Primer administrador creado exitosamente',
        data: {
          user: user.toJSON(),
          authServiceUserId: (user._id as ObjectId).toString(),
          bootstrapCompleted: true,
          message: '🎉 Sistema inicializado. Ya puedes iniciar sesión con tus credenciales.'
        }
      };
    } catch (error) {
      console.error('❌ Error creando primer administrador:', error);
      
      return {
        success: false,
        message: 'Error interno del servidor durante bootstrap',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ================================
  // CRUD OPERATIONS
  // ================================

  async createUser(userData: CreateUserRequest, createdBy?: string): Promise<ApiResponse<any>> {
    try {
      console.log('🔄 Iniciando creación de usuario:', userData.email);

      // 1. Verificar si el usuario ya existe
      const existingUser = await this.userRepository.findByEmail(userData.email);
      if (existingUser) {
        return {
          success: false,
          message: 'Un usuario con este email ya existe',
          error: 'EMAIL_EXISTS'
        };
      }

      // 2. Generar contraseña temporal y su hash. There is no second
      // service to create this user in anymore — the _id is minted once,
      // right here, by the insertOne() below.
      const password = this.authService.generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(password, 12);

      const userProfile = {
        email: userData.email.toLowerCase(),
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role as UserRole,
        status: userData.status as UserStatus || 'active',
        passwordHash,

        profile: userData.profile || {
          preferences: {
            language: 'es',
            timezone: 'America/La_Paz',
            notifications: {
              email: true,
              push: true,
              sms: false
            }
          }
        },

        permissions: [],
        teacherData: userData.teacherData,
        proctorData: userData.proctorData,

        // Metadatos
        createdBy: createdBy,
        lastSync: new Date(),
      };

      console.log('💾 Creando usuario...');
      const user = await this.userRepository.create(userProfile);

      // Mirror the freshly-minted _id into authServiceUserId — kept only for
      // exam-service's read-only copy of this collection, see models/User.ts.
      await this.userRepository.update(user._id as ObjectId, {
        authServiceUserId: (user._id as ObjectId).toString(),
      });

      // 3. Asignar permisos por defecto basados en el rol
      await this.assignDefaultPermissions(user._id!.toString(), userData.role);

      console.log('✅ Usuario creado exitosamente');

      // 4. 🆕 Auto-crear candidato si es student
      if (userData.role === 'student') {
        try {
          // Importar dinámicamente para evitar dependencias circulares
          const { CandidateService } = await import('./candidate.service');
          const candidateService = new CandidateService();

          await candidateService.createFromUser(user.toJSON());
          console.log(`✅ Auto-created candidate for student user ${user._id}`);
        } catch (error) {
          console.warn(`⚠️ Failed to auto-create candidate for user ${user._id}:`, error);
          // No fallar la creación del usuario si falla el candidato
        }
      }

      // 5. Publicar evento de usuario creado (que triggeará el envío de email con contraseña)
      try {
        await eventService.publishUserCreated(
          user._id!.toString(),
          {
            ...user.toJSON(),
            temporaryPassword: password, // Se incluye en el evento para el notification-service
            isNewUser: true,
            requiresPasswordEmail: true
          },
          createdBy
        );
        console.log('📤 Evento USER_CREATED publicado');
      } catch (eventError) {
        console.warn('⚠️ Error publicando evento de usuario creado:', eventError);
      }

      return {
        success: true,
        message: 'Usuario creado exitosamente',
        data: {
          user: user.toJSON(),
          authServiceUserId: (user._id as ObjectId).toString(),
          emailSent: true,
          message: '📧 Las credenciales de acceso han sido enviadas al email del usuario'
        }
      };
    } catch (error) {
      console.error('❌ Error creando usuario:', error);

      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getUserByAuthServiceId(authServiceUserId: string) {
    return this.userRepository.findByAuthServiceUserId(authServiceUserId);
  }

  async getUserById(id: string): Promise<ApiResponse<any>> {
    try {
      const user = await this.userRepository.findById(id);
      
      if (!user) {
        return {
          success: false,
          message: 'Usuario no encontrado',
          error: 'USER_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Usuario obtenido exitosamente',
        data: {
          user: user.toJSON(),
          lastSync: user.lastSync
        }
      };
    } catch (error) {
      console.error('Error obteniendo usuario por ID:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async updateUser(id: string, updates: UpdateUserRequest): Promise<ApiResponse<any>> {
    try {
      // Verificar si el usuario existe
      const existingUser = await this.userRepository.findById(id);
      if (!existingUser) {
        return {
          success: false,
          message: 'Usuario no encontrado',
          error: 'USER_NOT_FOUND'
        };
      }

      // Si se está actualizando el email, verificar que no exista otro usuario
      if (updates.email && updates.email !== existingUser.email) {
        const emailExists = await this.userRepository.emailExists(updates.email, id);
        if (emailExists) {
          return {
            success: false,
            message: 'Ya existe un usuario con este email',
            error: 'EMAIL_EXISTS'
          };
        }
      }

      // Preparar actualizaciones para user-management
      const userManagementUpdates = {
        ...updates,
        lastSync: new Date(),
        updatedAt: new Date()
      };

      const updatedUser = await this.userRepository.update(id, userManagementUpdates);

      // Privileges must not survive a role/status/permissions change: a
      // stateless JWT keeps carrying the OLD role/permissions until it
      // expires, and the cached "active" snapshot (30 min TTL) would let a
      // just-suspended user keep passing the active-user gate for up to
      // that long. Revoking all sessions (refresh tokens + cached snapshot)
      // forces a full re-login before any new token can be issued, and
      // — for status changes specifically — makes the active-user check in
      // auth.middleware.ts fail on the very next request instead of
      // trusting a stale cache entry.
      const changesPrivileges = Boolean(
        updates.role !== undefined || updates.status !== undefined || updates.permissions !== undefined
      );

      if (updatedUser && changesPrivileges) {
        try {
          await this.authService.revokeAllSessionsForUser(id);
        } catch (sessionError) {
          console.warn('⚠️ Error revocando sesiones tras cambio de rol/estado/permisos:', sessionError);
        }
      } else if (updatedUser && (updates.email || updates.firstName || updates.lastName)) {
        // No cross-service sync needed anymore: email/firstName/lastName
        // just changed on the one document both auth and profile reads use.
        // Invalidate the auth module's cached snapshot so the next
        // authenticated request (and the next token refresh) picks up the
        // change immediately instead of waiting out the cache TTL. These
        // fields are not privileges, so existing sessions may keep running.
        try {
          await this.authService.invalidateUserCache(id);
        } catch (cacheError) {
          console.warn('⚠️ Error invalidando cache de auth tras actualización:', cacheError);
        }
      }

      // Publicar evento de usuario actualizado
      if (updatedUser) {
        try {
          await eventService.publishUserUpdated(existingUser.authServiceUserId!, updates);
        } catch (eventError) {
          console.warn('⚠️ Error publicando evento de usuario actualizado:', eventError);
        }
      }

      return {
        success: true,
        message: 'Usuario actualizado exitosamente',
        data: { user: updatedUser?.toJSON() }
      };
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteUser(id: string): Promise<ApiResponse<any>> {
    try {
      const userExists = await this.userRepository.findById(id);
      if (!userExists) {
        return {
          success: false,
          message: 'Usuario no encontrado',
          error: 'USER_NOT_FOUND'
        };
      }

      // Eliminar el documento del usuario (perfil + credenciales, es el mismo documento)
      const deleted = await this.userRepository.delete(id);

      if (!deleted) {
        return {
          success: false,
          message: 'Error eliminando usuario',
          error: 'DELETE_FAILED'
        };
      }

      // Revocar cualquier sesión/refresh-token y caché que le quedara al
      // usuario eliminado. No HTTP hop anymore — same DB, same call.
      try {
        await this.authService.revokeAllSessionsForUser(id);
      } catch (sessionError) {
        console.warn('⚠️ Error revocando sesiones del usuario eliminado:', sessionError);
      }

      // Publicar evento de usuario eliminado
      try {
        await eventService.publishUserDeleted(id);
      } catch (eventError) {
        console.warn('⚠️ Error publicando evento de usuario eliminado:', eventError);
      }

      return {
        success: true,
        message: 'Usuario eliminado exitosamente',
        data: { deletedId: id }
      };
    } catch (error) {
      console.error('Error eliminando usuario:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getUsers(pagination: PaginationParams, filters: FilterParams): Promise<ApiResponse<any>> {
    try {
      const { users, total } = await this.userRepository.findAll(pagination, filters);
      
      const totalPages = Math.ceil(total / pagination.limit);
      
      return {
        success: true,
        message: 'Lista de usuarios obtenida exitosamente',
        data: {
          users: users.map(user => user.toJSON()),
          total,
          page: pagination.page,
          limit: pagination.limit,
          totalPages,
          hasNext: pagination.page < totalPages,
          hasPrev: pagination.page > 1
        }
      };
    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  async getProctors(pagination: PaginationParams, filters: FilterParams): Promise<ApiResponse<any>> {
    try {
      const { proctors, total } = await this.userRepository.findProctors(pagination, filters);

      const totalPages = Math.ceil(total / pagination.limit);
      
      return {
        success: true,
        message: 'Lista de proctores obtenida exitosamente',
        data: {
          proctors: proctors.map(proctor => proctor.toJSON()),
          total,
          page: pagination.page,
          limit: pagination.limit,
          totalPages,
          hasNext: pagination.page < totalPages,
          hasPrev: pagination.page > 1
        }
      };
    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  // ================================
  // SPECIALIZED OPERATIONS
  // ================================

  async activateUser(id: string) {
    const existing = await this.userRepository.findById(id);
    if (!existing) return { success: false, message: 'Usuario no encontrado', error: 'USER_NOT_FOUND' };
  
    const updatedUser = await this.userRepository.updateStatus(id, 'active');
    if(!updatedUser?.authServiceUserId) {
      return { success: false, message: 'Error al actualizar usuario', error: 'UPDATE_FAILED' };
    }

    // Invalidate the cached "inactive" snapshot so the host authenticate
    // middleware picks up the reactivation immediately (see deactivateUser).
    try {
      await this.authService.invalidateUserCache(id);
    } catch (e) {
      console.warn('⚠️ Error invalidando cache tras activación:', e);
    }

    // Publicar evento
    try {
      await eventService.publishUserStatusChanged(
        updatedUser?.authServiceUserId,
        existing.status || 'inactive',
        'active'
      );
    } catch (e) {
      console.warn('Status event publish failed:', e);
    }
    return { success: true, message: 'Usuario activado exitosamente', data: { user: updatedUser!.toJSON() } };
  }
  
  async deactivateUser(id: string) {
    const existing = await this.userRepository.findById(id);
    if (!existing) return { success: false, message: 'Usuario no encontrado', error: 'USER_NOT_FOUND' };

    const updatedUser = await this.userRepository.updateStatus(id, 'inactive');
    if(!updatedUser?.authServiceUserId) {
      return { success: false, message: 'Error al actualizar usuario', error: 'UPDATE_FAILED' };
    }

    // Revoke live sessions/refresh-tokens and the cached "active" snapshot
    // immediately, in-process. This used to be an async Kafka round trip
    // (USER_STATUS_CHANGED -> auth-service's own consumer, on its own DB) —
    // now it is a direct call against the same database, so deactivation
    // takes effect before this request even returns instead of racing the
    // next Kafka poll.
    try {
      await this.authService.revokeAllSessionsForUser(id);
    } catch (e) {
      console.warn('⚠️ Error revocando sesiones tras desactivación:', e);
    }

    // Publicar evento (notifications-service / session-manager-service still
    // consume USER_STATUS_CHANGED from user-events)
    try {
      await eventService.publishUserStatusChanged(
        updatedUser?.authServiceUserId,
        existing.status || 'active',
        'inactive'
      );
    } catch (e) {
      console.warn('Status event publish failed:', e);
    }
    return { success: true, message: 'Usuario desactivado exitosamente', data: { user: updatedUser!.toJSON() } };
  }

  async searchUsers(searchTerm: string, pagination: PaginationParams): Promise<ApiResponse<any>> {
    try {
      const { users, total } = await this.userRepository.search(searchTerm, pagination);
      
      const totalPages = Math.ceil(total / pagination.limit);
      
      return {
        success: true,
        message: 'Búsqueda completada exitosamente',
        data: {
          results: users.map(user => user.toJSON()),
          total,
          page: pagination.page,
          limit: pagination.limit,
          totalPages,
          hasNext: pagination.page < totalPages,
          hasPrev: pagination.page > 1,
          query: searchTerm
        }
      };
    } catch (error) {
      console.error('Error en búsqueda de usuarios:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getUserStats(): Promise<ApiResponse<any>> {
    try {
      const stats = await this.userRepository.getStatistics();
      
      return {
        success: true,
        message: 'Estadísticas obtenidas exitosamente',
        data: stats
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async bulkDeleteUsers(ids: string[]): Promise<ApiResponse<any>> {
    try {
      let deleted = 0;
      let failed = 0;
      const results = [];

      for (const id of ids) {
        try {
          const result = await this.deleteUser(id);
          if (result.success) {
            deleted++;
            results.push({ userId: id, status: 'deleted' });
          } else {
            failed++;
            results.push({ userId: id, status: 'failed', error: result.message });
          }
        } catch (error) {
          failed++;
          results.push({ userId: id, status: 'failed', error: 'Error interno' });
        }
      }

      return {
        success: true,
        message: 'Eliminación masiva completada',
        data: {
          deleted,
          failed,
          total: ids.length,
          details: results
        }
      };
    } catch (error) {
      console.error('Error en eliminación masiva:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ================================
  // PERMISSION MANAGEMENT
  // ================================

  private async assignDefaultPermissions(userId: string, role: UserRole): Promise<void> {
    const defaultPermissions = this.getDefaultPermissionsByRole(role);
    
    if (defaultPermissions.length > 0) {
      await this.userRepository.update(userId, {
        permissions: defaultPermissions,
        updatedAt: new Date()
      });
    }
  }

  private getDefaultPermissionsByRole(role: UserRole): any[] {
    switch (role) {
      case 'admin':
        return [
          { resource: 'users', actions: ['create', 'read', 'update', 'delete', 'manage'] },
          { resource: 'candidates', actions: ['create', 'read', 'update', 'delete', 'manage'] },
          { resource: 'roles', actions: ['create', 'read', 'update', 'delete', 'manage'] }
        ];
      case 'teacher':
        return [
          { resource: 'candidates', actions: ['create', 'read', 'update'] },
          { resource: 'exams', actions: ['create', 'read', 'update', 'execute'] }
        ];
      case 'proctor':
        return [
          { resource: 'sessions', actions: ['read', 'execute'] },
          { resource: 'candidates', actions: ['read'] }
        ];
      case 'student':
        return [
          { resource: 'exams', actions: ['read', 'execute','delete','manage'] },
          { resource: 'candidates', actions: ['read', 'execute', 'manage','delete','update','create'] }
        ];
      default:
        return [];
    }
  }

  // ================================
  // PASSWORD MANAGEMENT (in-process — see auth/services/auth.service.ts)
  // ================================

  /**
   * Cambiar contraseña de un usuario. `userId` here is the same _id used
   * everywhere else (JWT userId === profile _id === candidate _id).
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<ApiResponse<any>> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'Usuario no encontrado',
          error: 'USER_NOT_FOUND'
        };
      }

      await this.authService.changePassword(userId, oldPassword, newPassword);

      await this.userRepository.update(userId, {
        lastSync: new Date(),
        updatedAt: new Date()
      });

      try {
        await eventService.publishUserPasswordChanged(userId);
      } catch (eventError) {
        console.warn('⚠️ Error publicando evento de cambio de contraseña:', eventError);
      }

      return { success: true, message: 'Contraseña cambiada exitosamente' };
    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Resetear contraseña de un usuario (solo admin)
   */
  async resetPassword(userId: string, newPassword?: string): Promise<ApiResponse<any>> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'Usuario no encontrado',
          error: 'USER_NOT_FOUND'
        };
      }

      // Si no se proporciona nueva contraseña, generar una temporal
      const finalPassword = newPassword || this.authService.generateTemporaryPassword();

      await this.authService.resetPassword(user.email, finalPassword);

      await this.userRepository.update(userId, {
        lastSync: new Date(),
        updatedAt: new Date()
      });

      try {
        await eventService.publishUserPasswordChanged(userId);
      } catch (eventError) {
        console.warn('⚠️ Error publicando evento de reset de contraseña:', eventError);
      }

      return {
        success: true,
        message: 'Contraseña reseteada exitosamente',
        data: {
          temporaryPassword: !newPassword ? finalPassword : undefined,
          mustChangePassword: true
        }
      };
    } catch (error) {
      console.error('Error reseteando contraseña:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generar contraseña temporal para un usuario
   */
  async generateTemporaryPassword(userId: string, sendByEmail: boolean = true): Promise<ApiResponse<any>> {
    try {
      // Verificar que el usuario existe
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'Usuario no encontrado',
          error: 'USER_NOT_FOUND'
        };
      }

      // Generar contraseña temporal
      const temporaryPassword = this.authService.generateTemporaryPassword();

      await this.authService.resetPassword(user.email, temporaryPassword);

      {
        // Actualizar timestamp de sincronización
        await this.userRepository.update(userId, {
          lastSync: new Date(),
          updatedAt: new Date()
        });

        if (sendByEmail) {
          // Publicar evento para enviar contraseña por email
          try {
            await eventService.publishUserEvent({
              eventType: 'USER_CREATED',
              userId,
              userData: {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                temporaryPassword,
                isTemporaryPassword: true,
                requiresPasswordEmail: true
              },
              timestamp: new Date()
            });
            console.log('📤 Evento de contraseña temporal publicado para envio por email');
          } catch (eventError) {
            console.warn('⚠️ Error publicando evento de contraseña temporal:', eventError);
          }

          return {
            success: true,
            message: 'Contraseña temporal generada exitosamente',
            data: {
              email: user.email,
              emailSent: true,
              mustChangePassword: true,
              message: '📧 La nueva contraseña temporal ha sido enviada al email del usuario'
            }
          };
        } else {
          // Solo para casos especiales donde el admin necesita ver la contraseña
          return {
            success: true,
            message: 'Contraseña temporal generada exitosamente',
            data: {
              temporaryPassword,
              email: user.email,
              mustChangePassword: true,
              emailSent: false,
              message: '⚠️ IMPORTANTE: Proporciona esta contraseña al usuario de forma segura'
            }
          };
        }
      }
    } catch (error) {
      console.error('Error generando contraseña temporal:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
