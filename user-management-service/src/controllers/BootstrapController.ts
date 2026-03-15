import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { UserRepository } from '../repositories/user.repository';

export class BootstrapController {
  private userService: UserService;
  private userRepository: UserRepository;

  constructor() {
    this.userService = new UserService();
    this.userRepository = new UserRepository();
  }

  /**
   * Crear el primer usuario administrador del sistema
   * Solo funciona si no hay usuarios existentes
   */
  createFirstAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      console.log('🚀 Intentando crear primer administrador...');

      // 1. Verificar si ya existen usuarios en el sistema
      const existingUsersCount = await this.userRepository.count();
      
      if (existingUsersCount > 0) {
        res.status(403).json({
          success: false,
          message: 'El sistema ya tiene usuarios registrados. El bootstrap está deshabilitado.',
          error: 'BOOTSTRAP_DISABLED'
        });
        return;
      }

      // 2. Validar datos requeridos
      const { email, firstName, lastName, password } = req.body;
      
      if (!email || !firstName || !lastName || !password) {
        res.status(400).json({
          success: false,
          message: 'Email, nombre, apellido y contraseña son requeridos',
          error: 'MISSING_REQUIRED_FIELDS'
        });
        return;
      }

      // 3. Validar formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          success: false,
          message: 'Formato de email inválido',
          error: 'INVALID_EMAIL_FORMAT'
        });
        return;
      }

      // 4. Validar contraseña
      if (password.length < 8) {
        res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 8 caracteres',
          error: 'WEAK_PASSWORD'
        });
        return;
      }

      console.log('✅ Validaciones pasadas, creando primer admin...');

      // 5. Crear el primer usuario admin usando el servicio
      const result = await this.userService.createFirstAdmin({
        email: email.toLowerCase(),
        firstName,
        lastName,
        password,
        role: 'admin'
      });

      if (result.success) {
        console.log('🎉 Primer administrador creado exitosamente');
        
        res.status(201).json({
          success: true,
          message: '🎉 Primer administrador creado exitosamente',
          data: {
            user: result.data?.user,
            message: '📧 Las credenciales han sido confirmadas. Ya puedes iniciar sesión.',
            bootstrapCompleted: true
          }
        });
      } else {
        console.error('❌ Error creando primer admin:', result.message);
        res.status(400).json(result);
      }
    } catch (error) {
      console.error('❌ Error en bootstrap:', error);
      next(error);
    }
  };

  /**
   * Verificar si el sistema necesita bootstrap
   */
  checkBootstrapStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const usersCount = await this.userRepository.count();
      const needsBootstrap = usersCount === 0;

      res.status(200).json({
        success: true,
        message: 'Estado de bootstrap obtenido',
        data: {
          needsBootstrap,
          usersCount,
          message: needsBootstrap 
            ? 'El sistema está listo para el bootstrap del primer administrador'
            : 'El sistema ya está inicializado'
        }
      });
    } catch (error) {
      console.error('Error verificando estado de bootstrap:', error);
      next(error);
    }
  };
}
