// // src/utils/initialization.ts - Inicialización del sistema

// import { UserRepository } from '../repositories/user.repository';
// import { RoleRepository } from '../repositories/role.repository';
// import { authServiceIntegration } from '../integrations/auth-service.integration';
// import { eventService } from '../services/event.service';
// import config from '../config';

// interface SystemInitResult {
//   rolesCreated: number;
//   adminUserExists: boolean;
//   authServiceConnected: boolean;
//   kafkaConnected: boolean;
//   errors: string[];
//   warnings: string[];
// }

// export class SystemInitializer {
//   private userRepository: UserRepository;
//   private roleRepository: RoleRepository;

//   constructor() {
//     this.userRepository = new UserRepository();
//     this.roleRepository = new RoleRepository();
//   }

//   async initializeSystem(): Promise<SystemInitResult> {
//     const result: SystemInitResult = {
//       rolesCreated: 0,
//       adminUserExists: false,
//       authServiceConnected: false,
//       kafkaConnected: false,
//       errors: [],
//       warnings: []
//     };

//     console.log('🔧 Iniciando inicialización del sistema...');

//     try {
//       // 1. Verificar conexiones externas
//       await this.checkExternalConnections(result);

//       // 2. Crear roles por defecto
//       await this.createDefaultRoles(result);

//       // 3. Verificar usuario administrador
//       await this.checkAdminUser(result);

//       // 4. Crear datos de ejemplo (solo en desarrollo)
//       if (config.nodeEnv === 'development') {
//         await this.createSampleData(result);
//       }

//       console.log('✅ Inicialización del sistema completada');
//       this.logInitializationSummary(result);

//       return result;
//     } catch (error) {
//       console.error('❌ Error durante la inicialización:', error);
//       result.errors.push(error instanceof Error ? error.message : 'Unknown error');
//       return result;
//     }
//   }

//   private async checkExternalConnections(result: SystemInitResult): Promise<void> {
//     console.log('🔗 Verificando conexiones externas...');

//     // Check Auth Service
//     try {
//       result.authServiceConnected = await authServiceIntegration.healthCheck();
//       if (result.authServiceConnected) {
//         console.log('✅ Auth Service conectado');
//       } else {
//         result.warnings.push('Auth Service no disponible');
//         console.warn('⚠️ Auth Service no disponible');
//       }
//     } catch (error) {
//       result.warnings.push('Error conectando con Auth Service');
//       console.warn('⚠️ Error conectando con Auth Service:', error);
//     }

//     // Check Kafka
//     try {
//       result.kafkaConnected = await eventService.healthCheck();
//       if (result.kafkaConnected) {
//         console.log('✅ Kafka conectado');
//       } else {
//         result.warnings.push('Kafka no disponible');
//         console.warn('⚠️ Kafka no disponible');
//       }
//     } catch (error) {
//       result.warnings.push('Error conectando con Kafka');
//       console.warn('⚠️ Error conectando con Kafka:', error);
//     }
//   }

//   private async createDefaultRoles(result: SystemInitResult): Promise<void> {
//     console.log('👥 Creando roles por defecto...');

//     const defaultRoles = [
//       {
//         name: 'admin',
//         description: 'Administrador del sistema con acceso completo',
//         permissions: [
//           { resource: 'users', actions: ['create', 'read', 'update', 'delete', 'manage'] },
//           { resource: 'candidates', actions: ['create', 'read', 'update', 'delete', 'manage'] },
//           { resource: 'roles', actions: ['create', 'read', 'update', 'delete', 'manage'] },
//           { resource: 'exams', actions: ['create', 'read', 'update', 'delete', 'manage'] },
//           { resource: 'sessions', actions: ['create', 'read', 'update', 'delete', 'manage'] },
//           { resource: 'reports', actions: ['create', 'read', 'update', 'delete', 'manage'] }
//         ],
//         level: 10,
//         isActive: true,
//         isSystem: true
//       },
//       {
//         name: 'teacher',
//         description: 'Profesor con permisos para gestionar candidatos y exámenes',
//         permissions: [
//           { resource: 'candidates', actions: ['create', 'read', 'update'] },
//           { resource: 'exams', actions: ['create', 'read', 'update', 'execute'] },
//           { resource: 'sessions', actions: ['read', 'execute'] },
//           { resource: 'reports', actions: ['read'] }
//         ],
//         level: 5,
//         isActive: true,
//         isSystem: true
//       },
//       {
//         name: 'proctor',
//         description: 'Supervisor de exámenes con permisos limitados',
//         permissions: [
//           { resource: 'sessions', actions: ['read', 'execute'] },
//           { resource: 'candidates', actions: ['read'] },
//           { resource: 'exams', actions: ['read'] }
//         ],
//         level: 3,
//         isActive: true,
//         isSystem: true
//       },
//       {
//         name: 'student',
//         description: 'Estudiante con permisos básicos',
//         permissions: [
//           { resource: 'exams', actions: ['read', 'execute'] },
//           { resource: 'results', actions: ['read'] }
//         ],
//         level: 1,
//         isActive: true,
//         isSystem: true
//       }
//     ];

//     for (const roleData of defaultRoles) {
//       try {
//         const existingRole = await this.roleRepository.findByName(roleData.name);
        
//         if (!existingRole) {
//           await this.roleRepository.create({
//             ...roleData as any,
//           });
//           result.rolesCreated++;
//           console.log(`✅ Rol creado: ${roleData.name}`);
//         } else {
//           console.log(`ℹ️ Rol ya existe: ${roleData.name}`);
//         }
//       } catch (error) {
//         const errorMsg = `Error creando rol ${roleData.name}: ${error}`;
//         result.errors.push(errorMsg);
//         console.error('❌', errorMsg);
//       }
//     }
//   }

//   private async checkAdminUser(result: SystemInitResult): Promise<void> {
//     console.log('👤 Verificando usuario administrador...');

//     try {
//       // Buscar usuarios con rol admin
//       const adminUsers = await this.userRepository.findByRole('admin');
      
//       if (adminUsers.length > 0) {
//         result.adminUserExists = true;
//         console.log(`✅ Usuario(s) administrador encontrado(s): ${adminUsers.length}`);
//       } else {
//         result.warnings.push('No se encontró usuario administrador');
//         console.warn('⚠️ No se encontró usuario administrador');
//         console.warn('💡 Crea un usuario administrador manualmente o usa el endpoint de registro');
//       }
//     } catch (error) {
//       result.errors.push(`Error verificando usuario admin: ${error}`);
//       console.error('❌ Error verificando usuario admin:', error);
//     }
//   }

//   private async createSampleData(result: SystemInitResult): Promise<void> {
//     console.log('📊 Creando datos de ejemplo (desarrollo)...');

//     try {
//       // Verificar si ya existen datos de ejemplo
//       const userCount = await this.userRepository.countDocuments();
      
//       if (userCount > 0) {
//         console.log('ℹ️ Ya existen usuarios en la base de datos, omitiendo datos de ejemplo');
//         return;
//       }

//       // Crear usuario administrador de ejemplo
//       const adminEmail = 'admin@cba.local';
//       const existingAdmin = await this.userRepository.findByEmail(adminEmail);
      
//       if (!existingAdmin && result.authServiceConnected) {
//         try {
//           const { password, credentials } = await authServiceIntegration.generateUserCredentials({
//             email: adminEmail,
//             firstName: 'Admin',
//             lastName: 'CBA',
//             role: 'admin'
//           });

//           // Crear en auth-service
//           const authResult = await authServiceIntegration.createUserInAuthService(credentials);
          
//           if (authResult.success) {
//             // Crear en user-management
//             const adminUser = await this.userRepository.create({
//               email: adminEmail,
//               firstName: 'Admin',
//               lastName: 'CBA',
//               role: 'admin',
//               status: 'active',
//               profile: {
//                 preferences: {
//                   language: 'es',
//                   timezone: 'America/La_Paz',
//                   notifications: {
//                     email: true,
//                     push: true,
//                     sms: false
//                   }
//                 }
//               },
//               permissions: [
//                 { resource: 'users', actions: ['create', 'read', 'update', 'delete', 'manage'] },
//                 { resource: 'candidates', actions: ['create', 'read', 'update', 'delete', 'manage'] },
//                 { resource: 'roles', actions: ['create', 'read', 'update', 'delete', 'manage'] }
//               ]
//             });

//             console.log(`✅ Usuario admin de ejemplo creado: ${adminEmail}`);
//             console.log(`🔑 Contraseña temporal: ${password}`);
//             result.adminUserExists = true;

//             // Publicar evento si Kafka está disponible
//             if (result.kafkaConnected) {
//               try {
//                 await eventService.publishUserCreated(
//                   adminUser._id!.toString(),
//                   adminUser.toJSON(),
//                   'system-initializer'
//                 );
//               } catch (eventError) {
//                 console.warn('⚠️ Error publicando evento para usuario admin:', eventError);
//               }
//             }
//           } else {
//             result.warnings.push('No se pudo crear usuario admin en auth-service');
//             console.warn('⚠️ No se pudo crear usuario admin en auth-service');
//           }
//         } catch (error) {
//           result.warnings.push(`Error creando usuario admin de ejemplo: ${error}`);
//           console.warn('⚠️ Error creando usuario admin de ejemplo:', error);
//         }
//       }

//       // Crear algunos usuarios de ejemplo adicionales
//       const sampleUsers = [
//         {
//           email: 'teacher@cba.local',
//           firstName: 'Maria',
//           lastName: 'Gonzalez',
//           role: 'teacher'
//         },
//         {
//           email: 'proctor@cba.local',
//           firstName: 'Carlos',
//           lastName: 'Martinez',
//           role: 'proctor'
//         }
//       ];

//       for (const userData of sampleUsers) {
//         try {
//           const existing = await this.userRepository.findByEmail(userData.email);
//           if (!existing && result.authServiceConnected) {
//             const { password, credentials } = await authServiceIntegration.generateUserCredentials(userData);
//             const authResult = await authServiceIntegration.createUserInAuthService(credentials);
            
//             if (authResult.success) {
//               await this.userRepository.create({
//                 ...userData,
//                 status: 'active',
//                 profile: {
//                   preferences: {
//                     language: 'es',
//                     timezone: 'America/La_Paz',
//                     notifications: {
//                       email: true,
//                       push: true,
//                       sms: false
//                     }
//                   }
//                 },
//                 permissions: this.getDefaultPermissionsByRole(userData.role as any)
//               });
              
//               console.log(`✅ Usuario de ejemplo creado: ${userData.email} (password: ${password})`);
//             }
//           }
//         } catch (error) {
//           console.warn(`⚠️ Error creando usuario ${userData.email}:`, error);
//         }
//       }

//     } catch (error) {
//       result.warnings.push(`Error creando datos de ejemplo: ${error}`);
//       console.warn('⚠️ Error creando datos de ejemplo:', error);
//     }
//   }

//   private getDefaultPermissionsByRole(role: string): any[] {
//     switch (role) {
//       case 'admin':
//         return [
//           { resource: 'users', actions: ['create', 'read', 'update', 'delete', 'manage'] },
//           { resource: 'candidates', actions: ['create', 'read', 'update', 'delete', 'manage'] },
//           { resource: 'roles', actions: ['create', 'read', 'update', 'delete', 'manage'] }
//         ];
//       case 'teacher':
//         return [
//           { resource: 'candidates', actions: ['create', 'read', 'update'] },
//           { resource: 'exams', actions: ['create', 'read', 'update', 'execute'] }
//         ];
//       case 'proctor':
//         return [
//           { resource: 'sessions', actions: ['read', 'execute'] },
//           { resource: 'candidates', actions: ['read'] }
//         ];
//       case 'student':
//         return [
//           { resource: 'exams', actions: ['read', 'execute'] }
//         ];
//       default:
//         return [];
//     }
//   }

//   private logInitializationSummary(result: SystemInitResult): void {
//     console.log('\n📊 RESUMEN DE INICIALIZACIÓN:');
//     console.log('================================');
//     console.log(`✅ Roles creados: ${result.rolesCreated}`);
//     console.log(`👤 Admin existe: ${result.adminUserExists ? 'Sí' : 'No'}`);
//     console.log(`🔗 Auth Service: ${result.authServiceConnected ? 'Conectado' : 'Desconectado'}`);
//     console.log(`📨 Kafka: ${result.kafkaConnected ? 'Conectado' : 'Desconectado'}`);
    
//     if (result.warnings.length > 0) {
//       console.log(`⚠️ Advertencias: ${result.warnings.length}`);
//       result.warnings.forEach(warning => console.log(`   - ${warning}`));
//     }
    
//     if (result.errors.length > 0) {
//       console.log(`❌ Errores: ${result.errors.length}`);
//       result.errors.forEach(error => console.log(`   - ${error}`));
//     }
    
//     console.log('================================\n');
//   }

//   async createAdminUser(email: string, password: string, firstName: string, lastName: string): Promise<boolean> {
//     try {
//       console.log(`👤 Creando usuario administrador: ${email}`);

//       // Verificar si el usuario ya existe
//       const existing = await this.userRepository.findByEmail(email);
//       if (existing) {
//         console.warn('⚠️ El usuario administrador ya existe');
//         return false;
//       }

//       // Crear en auth-service
//       const authResult = await authServiceIntegration.createUserInAuthService({
//         email,
//         password,
//         firstName,
//         lastName,
//         role: 'admin'
//       });

//       if (!authResult.success) {
//         console.error('❌ Error creando usuario en auth-service:', authResult.message);
//         return false;
//       }

//       // Crear en user-management
//       const adminUser = await this.userRepository.create({
//         email,
//         firstName,
//         lastName,
//         role: 'admin',
//         status: 'active',
//         profile: {
//           preferences: {
//             language: 'es',
//             timezone: 'America/La_Paz',
//             notifications: {
//               email: true,
//               push: true,
//               sms: false
//             }
//           }
//         },
//         permissions: this.getDefaultPermissionsByRole('admin')
//       });

//       console.log(`✅ Usuario administrador creado exitosamente: ${email}`);

//       // Publicar evento
//       try {
//         await eventService.publishUserCreated(
//           adminUser._id!.toString(),
//           adminUser.toJSON(),
//           'manual-creation'
//         );
//       } catch (eventError) {
//         console.warn('⚠️ Error publicando evento:', eventError);
//       }

//       return true;
//     } catch (error) {
//       console.error('❌ Error creando usuario administrador:', error);
//       return false;
//     }
//   }
// }

// // Singleton instance
// export const systemInitializer = new SystemInitializer();
