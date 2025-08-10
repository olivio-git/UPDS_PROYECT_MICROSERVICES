import { 
  CreateUserRequest, 
  UpdateUserRequest,
  PaginationParams,
  FilterParams,
  ApiResponse,
  User,
  UserRole,
  UserStatus
} from '../types';
import { UserRepository } from '../repositories/user.repository';
import { UserModel } from '../models/User';
import { ObjectId } from 'mongodb';
import { eventService } from './event.service';
import { authServiceIntegration } from '../integrations/auth-service.integration';

export class UserService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
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

      // 3. Crear usuario DIRECTAMENTE en auth-service (bypass user-management)
      console.log('🔐 Creando credenciales en auth-service...');
      const authResult = await authServiceIntegration.createUserInAuthService({
        email: adminData.email,
        password: adminData.password,
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        role: adminData.role
      });

      if (!authResult.success) {
        console.error('❌ Error creando usuario en auth-service:', authResult.message);
        return {
          success: false,
          message: `Error creando credenciales: ${authResult.message}`,
          error: 'AUTH_SERVICE_ERROR'
        };
      }

      console.log('✅ Usuario creado en auth-service:', authResult.data);

      // 4. Crear registro en user-management
      const userProfile = {
        email: adminData.email.toLowerCase(),
        firstName: adminData.firstName,
        lastName: adminData.lastName,
        role: 'admin' as UserRole,
        status: 'active' as UserStatus,
        
        // Referencia al usuario en auth-service
        authServiceUserId: authResult.data?.user?._id || authResult.data?.userId,
        
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

      console.log('✅ Primer administrador creado exitosamente');

      // 5. NO publicar eventos Kafka para evitar envío de email (ya tiene las credenciales)
      
      return {
        success: true,
        message: 'Primer administrador creado exitosamente',
        data: { 
          user: user.toJSON(),
          authServiceUserId: authResult.data?.user?._id || authResult.data?.userId,
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

      // 1. Verificar si el usuario ya existe en user-management
      const existingUser = await this.userRepository.findByEmail(userData.email);
      if (existingUser) {
        return {
          success: false,
          message: 'Un usuario con este email ya existe en user-management',
          error: 'EMAIL_EXISTS'
        };
      }

      // 2. Verificar si existe en auth-service
      const authUserExists = await authServiceIntegration.validateUserExists(userData.email);
      if (authUserExists.data) {
        return {
          success: false,
          message: 'Un usuario con este email ya existe en auth-service',
          error: 'EMAIL_EXISTS_AUTH'
        };
      }

      // 3. Generar credenciales para auth-service
      const { password, credentials } = await authServiceIntegration.generateUserCredentials({
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role
      });

      console.log('🔐 Credenciales generadas para auth-service');

      // 4. Crear usuario en auth-service PRIMERO
      const authResult = await authServiceIntegration.createUserInAuthService(credentials);
      if (!authResult.success) {
        console.error('❌ Error creando usuario en auth-service:', authResult.message);
        return {
          success: false,
          message: `Error creando credenciales: ${authResult.message}`,
          error: 'AUTH_SERVICE_ERROR'
        };
      }

      console.log('✅ Usuario creado en auth-service:', authResult.data);

      // 5. Crear registro en user-management con referencia al auth-service
      const userProfile = {
        // Datos básicos (solo metadatos, no credenciales)
        email: userData.email.toLowerCase(),
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role as UserRole,
        status: userData.status as UserStatus || 'active',
        
        // Referencia al usuario en auth-service
        authServiceUserId: authResult.data?.user?._id || authResult.data?.userId,
        
        // Datos específicos de user-management
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

      console.log('💾 Creando registro en user-management...');
      const user = await this.userRepository.create(userProfile);

      // 6. Asignar permisos por defecto basados en el rol
      await this.assignDefaultPermissions(user._id!.toString(), userData.role);

      console.log('✅ Usuario creado exitosamente en user-management');

      // 7. Publicar evento de usuario creado (que triggeará el envío de email con contraseña)
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
          authServiceUserId: authResult.data?.user?._id || authResult.data?.userId,
          emailSent: true,
          message: '📧 Las credenciales de acceso han sido enviadas al email del usuario'
        }
      };
    } catch (error) {
      console.error('❌ Error creando usuario:', error);
      
      // Si hubo error después de crear en auth-service, intentar limpiar
      if (error instanceof Error && error.message.includes('E11000')) {
        console.warn('⚠️ Error de duplicado en user-management, pero usuario ya existe en auth-service');
        console.warn('🧹 Considera limpiar el usuario en auth-service si es necesario');
      }
      
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
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

      // Intentar obtener datos actualizados de auth-service
      let authServiceData = null;
      try {
        if (user.authServiceUserId) {
          // Aquí podrías hacer una llamada a auth-service para obtener datos actualizados
          // const authData = await authServiceIntegration.getUserById(user.authServiceUserId);
          // authServiceData = authData.data;
        }
      } catch (authError) {
        console.warn('⚠️ No se pudieron obtener datos de auth-service:', authError);
      }

      return {
        success: true,
        message: 'Usuario obtenido exitosamente',
        data: { 
          user: user.toJSON(),
          authServiceData,
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

      // Sincronizar cambios relevantes con auth-service
      if (updates.email || updates.firstName || updates.lastName || updates.role) {
        try {
          const syncData: any = {};
          if (updates.email) syncData.email = updates.email;
          if (updates.firstName) syncData.firstName = updates.firstName;
          if (updates.lastName) syncData.lastName = updates.lastName;
          if (updates.role) syncData.role = updates.role;

          await authServiceIntegration.syncUserData(existingUser.authServiceUserId || id, syncData);
          console.log('🔄 Datos sincronizados con auth-service');
        } catch (syncError) {
          console.warn('⚠️ Error sincronizando con auth-service:', syncError);
          // No fallar la operación por error de sincronización
        }
      }

      // Publicar evento de usuario actualizado
      if (updatedUser) {
        try {
          await eventService.publishUserUpdated(id, updates);
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

      // Eliminar registro de user-management PRIMERO
      const deleted = await this.userRepository.delete(id);

      if (!deleted) {
        return {
          success: false,
          message: 'Error eliminando usuario de user-management',
          error: 'DELETE_FAILED'
        };
      }

      // Intentar eliminar de auth-service (puede fallar sin afectar el resultado)
      try {
        await authServiceIntegration.deleteUserFromAuthService(userExists.authServiceUserId || id);
        console.log('🗑️ Usuario eliminado de auth-service');
      } catch (authError) {
        console.warn('⚠️ Error eliminando usuario de auth-service (continuando):', authError);
        // No detener la eliminación si falla auth-service
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
 
  // ================================
  // SPECIALIZED OPERATIONS
  // ================================

  async activateUser(id: string): Promise<ApiResponse<any>> {
    try {
      const updatedUser = await this.userRepository.updateStatus(id, 'active');
      
      if (!updatedUser) {
        return {
          success: false,
          message: 'Usuario no encontrado',
          error: 'USER_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Usuario activado exitosamente',
        data: { user: updatedUser.toJSON() }
      };
    } catch (error) {
      console.error('Error activando usuario:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deactivateUser(id: string): Promise<ApiResponse<any>> {
    try {
      const updatedUser = await this.userRepository.updateStatus(id, 'inactive');
      
      if (!updatedUser) {
        return {
          success: false,
          message: 'Usuario no encontrado',
          error: 'USER_NOT_FOUND'
        };
      }

      return {
        success: true,
        message: 'Usuario desactivado exitosamente',
        data: { user: updatedUser.toJSON() }
      };
    } catch (error) {
      console.error('Error desactivando usuario:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
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
          { resource: 'exams', actions: ['read', 'execute'] }
        ];
      default:
        return [];
    }
  }

  // ================================
  // AUTH SERVICE INTEGRATION HELPERS
  // ================================

  /**
   * Verifica la conectividad con auth-service
   */
  async checkAuthServiceConnection(): Promise<ApiResponse<any>> {
    try {
      const isConnected = await authServiceIntegration.healthCheck();
      
      return {
        success: true,
        message: 'Estado de auth-service verificado',
        data: {
          connected: isConnected,
          connectionInfo: authServiceIntegration.getConnectionInfo()
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error verificando auth-service',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ================================
  // PASSWORD MANAGEMENT
  // ================================

  /**
   * Cambiar contraseña de un usuario (delegado a auth-service)
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string,jwt:string): Promise<ApiResponse<any>> {
    try {
      // Verificar que el usuario existe en user-management
      const user = await this.userRepository.findOne({
        authServiceUserId:userId
      });
      if (!user) {
        return {
          success: false,
          message: 'Usuario no encontrado',
          error: 'USER_NOT_FOUND'
        };
      }

      // Delegar el cambio de contraseña al auth-service
      const result = await authServiceIntegration.changePassword({
        userId: user.authServiceUserId || userId,
        oldPassword,
        newPassword,
        jwt
      });

      if (result.success) {
        // Actualizar timestamp de sincronización
        await this.userRepository.update(userId, {
          lastSync: new Date(),
          updatedAt: new Date()
        });

        // Publicar evento de cambio de contraseña
        try {
          await eventService.publishUserPasswordChanged(user.authServiceUserId || userId);
        } catch (eventError) {
          console.warn('⚠️ Error publicando evento de cambio de contraseña:', eventError);
        }
      }

      return result;
    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Resetear contraseña de un usuario (solo admin, delegado a auth-service)
   */
  async resetPassword(userId: string, newPassword?: string): Promise<ApiResponse<any>> {
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

      // Si no se proporciona nueva contraseña, generar una temporal
      const finalPassword = newPassword || authServiceIntegration.generateTemporaryPassword();

      // Resetear contraseña en auth-service
      const result = await authServiceIntegration.resetPassword({
        email: user.email,
        newPassword: finalPassword
      });

      if (result.success) {
        // Actualizar timestamp de sincronización
        await this.userRepository.update(userId, {
          lastSync: new Date(),
          updatedAt: new Date()
        });

        // Publicar evento de reset de contraseña
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
      }

      return result;
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
      const temporaryPassword = authServiceIntegration.generateTemporaryPassword();

      // Actualizar contraseña en auth-service
      const result = await authServiceIntegration.resetPassword({
        email: user.email,
        newPassword: temporaryPassword
      });

      if (result.success) {
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

      return result;
    } catch (error) {
      console.error('Error generando contraseña temporal:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Sincroniza un usuario específico con auth-service
   */
  async syncUserWithAuthService(userId: string): Promise<ApiResponse<any>> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        return {
          success: false,
          message: 'Usuario no encontrado',
          error: 'USER_NOT_FOUND'
        };
      }

      const result = await authServiceIntegration.syncUserData(user.authServiceUserId || userId, {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      });

      if (result.success) {
        // Actualizar timestamp de sincronización
        await this.userRepository.update(userId, {
          lastSync: new Date(),
          updatedAt: new Date()
        });
      }

      return {
        success: result.success,
        message: result.message,
        data: result.data
      };
    } catch (error) {
      console.error('Error sincronizando usuario:', error);
      return {
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
