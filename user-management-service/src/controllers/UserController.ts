import { NextFunction, Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { createError } from '../middleware/error.middleware';
import { UserService } from '../services/user.service';
import { auditLog } from '../services/audit.service';
import { JWTPayload } from '../types/index';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  // ================================
  // GET USERS
  // ================================
  
  getUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as any;
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 10;
      const search = query.search;
      const role = query.role;
      const status = query.status;
      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder || 'desc';
      const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
      const dateTo = query.dateTo ? new Date(`${query.dateTo}T23:59:59.999Z`) : undefined;

      // Separar parámetros de paginación y filtros
      const pagination = { page, limit, sortBy, sortOrder };
      const filters = { search, role, status, dateFrom, dateTo };

      const result = await this.userService.getUsers(pagination, filters);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  };
  getProctors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { 
      const query = req.query as any;
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 10;
      const search = query.search;
      const role = query.role;
      const status = query.status;
      const sortBy = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder || 'desc';

      const sessionId = req.params.sessionId;
      // Separar parámetros de paginación y filtros
      const pagination = { page, limit, sortBy, sortOrder };
      const filters = { search, role, status, sessionId };

      const result = await this.userService.getProctors(pagination, filters);

      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  };
  // ================================
  // GET USER BY ID
  // ================================
  
  getUserById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'El parámetro id es requerido',
          error: 'ID_REQUIRED'
        });
        return;
      }
      
      const result = await this.userService.getUserById(id);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(404).json(result);
      }
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // CREATE USER
  // ================================
  
  createUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userData = req.body;
      const currentUser = req.user as JWTPayload;

      const result = await this.userService.createUser(userData, currentUser.userId);

      if (result.success) {
        auditLog('user.created', { type: 'user', name: `${userData.firstName} ${userData.lastName}`, id: result.data?.user?._id }, { req, details: { email: userData.email, role: userData.role } });
        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // UPDATE USER
  // ================================
  
  updateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'El parámetro id es requerido',
          error: 'ID_REQUIRED'
        });
        return;
      }

      const result = await this.userService.updateUser(id, updates);

      if (result.success) {
        auditLog('user.updated', { type: 'user', id, name: result.data?.user ? `${result.data.user.firstName} ${result.data.user.lastName}` : id }, { req, details: { fields: Object.keys(updates) } });
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // UPDATE CURRENT USER (by JWT)
  // ================================

  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const jwtUser = req.user as JWTPayload;
      if (!jwtUser?.userId) {
        res.status(401).json({ success: false, message: 'No autenticado', error: 'UNAUTHORIZED' });
        return;
      }

      const existingUser = await this.userService.getUserByAuthServiceId(jwtUser.userId);
      if (!existingUser) {
        res.status(404).json({ success: false, message: 'Usuario no encontrado', error: 'USER_NOT_FOUND' });
        return;
      }

      res.status(200).json({ success: true, data: { user: existingUser } });
    } catch (error) {
      next(error);
    }
  };

  updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const jwtUser = req.user as JWTPayload;
      if (!jwtUser?.userId) {
        res.status(401).json({ success: false, message: 'No autenticado', error: 'UNAUTHORIZED' });
        return;
      }

      const existingUser = await this.userService.getUserByAuthServiceId(jwtUser.userId);
      if (!existingUser) {
        res.status(404).json({ success: false, message: 'Usuario no encontrado', error: 'USER_NOT_FOUND' });
        return;
      }

      const result = await this.userService.updateUser(existingUser._id!.toString(), req.body);
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // PATCH USER
  // ================================

  patchUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'El parámetro id es requerido',
          error: 'ID_REQUIRED'
        });
        return;
      }

      const result = await this.userService.updateUser(id, updates);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // DELETE USER
  // ================================
  
  deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'El parámetro id es requerido',
          error: 'ID_REQUIRED'
        });
        return;
      }

      const result = await this.userService.deleteUser(id);

      if (result.success) {
        auditLog('user.deleted', { type: 'user', id }, { req });
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // ACTIVATE USER
  // ================================
  
  activateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'El parámetro id es requerido',
          error: 'ID_REQUIRED'
        });
        return;
      }

      const result = await this.userService.activateUser(id);

      if (result.success) {
        auditLog('user.activated', { type: 'user', id, name: result.data?.user ? `${result.data.user.firstName} ${result.data.user.lastName}` : id }, { req });
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // DEACTIVATE USER
  // ================================
  
  deactivateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'El parámetro id es requerido',
          error: 'ID_REQUIRED'
        });
        return;
      }

      const result = await this.userService.deactivateUser(id);

      if (result.success) {
        auditLog('user.deactivated', { type: 'user', id, name: result.data?.user ? `${result.data.user.firstName} ${result.data.user.lastName}` : id }, { req });
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  }; 

  // ================================
  // ASSIGN ROLE
  // ================================
  
  assignRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { roleId, role } = req.body;

      res.status(200).json({
        success: true,
        message: 'Rol asignado exitosamente',
        data: {
          user: {
            _id: id,
            role: role || 'student',
            updatedAt: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // ASSIGN PERMISSIONS
  // ================================
  
  assignPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { permissions } = req.body;

      res.status(200).json({
        success: true,
        message: 'Permisos asignados exitosamente',
        data: {
          user: {
            _id: id,
            permissions: permissions || [],
            updatedAt: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // GET USER PERMISSIONS
  // ================================
  
  getUserPermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      res.status(200).json({
        success: true,
        message: 'Permisos de usuario obtenidos exitosamente',
        data: {
          userId: id,
          permissions: [],
          role: 'student'
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // SEARCH USERS
  // ================================
  
  searchUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { query, page = 1, limit = 10 } = req.query;
      
      const pagination = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        sortBy: 'createdAt',
        sortOrder: 'desc' as 'asc' | 'desc'
      };

      const result = await this.userService.searchUsers(query as string, pagination);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // GET USER STATS
  // ================================
  
  getUserStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.userService.getUserStats();
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // UPDATE PROFILE
  // ================================
  
  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const profileData = req.body;
      const currentUser = req.user as JWTPayload;

      // Verificar ownership o permisos admin
      if (currentUser.userId !== id && currentUser.role !== 'admin') {
        const error = createError.forbidden('No tienes permisos para actualizar este perfil');
        next(error);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Perfil actualizado exitosamente',
        data: {
          user: {
            _id: id,
            profile: profileData,
            updatedAt: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // BULK OPERATIONS
  // ================================
  
  createBulkUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { users } = req.body;
      
      if (!Array.isArray(users)) {
        res.status(400).json({
          success: false,
          message: 'El campo users debe ser un array',
          error: 'INVALID_INPUT'
        });
        return;
      }

      let created = 0;
      let failed = 0;
      const results = [];

      for (const userData of users) {
        try {
          const result = await this.userService.createUser(userData);
          if (result.success) {
            created++;
            results.push({ user: userData.email, status: 'created' });
          } else {
            failed++;
            results.push({ user: userData.email, status: 'failed', error: result.message });
          }
        } catch (error) {
          failed++;
          results.push({ user: userData.email, status: 'failed', error: 'Error interno' });
        }
      }

      res.status(200).json({
        success: true,
        message: 'Usuarios creados en lote exitosamente',
        data: {
          created,
          failed,
          total: users.length,
          details: results
        }
      });
    } catch (error) {
      next(error);
    }
  };

  updateBulkUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ids, updates } = req.body;
      
      if (!Array.isArray(ids)) {
        res.status(400).json({
          success: false,
          message: 'El campo ids debe ser un array',
          error: 'INVALID_INPUT'
        });
        return;
      }

      let updated = 0;
      let failed = 0;
      const results = [];

      for (const id of ids) {
        try {
          const result = await this.userService.updateUser(id, updates);
          if (result.success) {
            updated++;
            results.push({ userId: id, status: 'updated' });
          } else {
            failed++;
            results.push({ userId: id, status: 'failed', error: result.message });
          }
        } catch (error) {
          failed++;
          results.push({ userId: id, status: 'failed', error: 'Error interno' });
        }
      }

      res.status(200).json({
        success: true,
        message: 'Usuarios actualizados en lote exitosamente',
        data: {
          updated,
          failed,
          total: ids.length,
          details: results
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // PASSWORD MANAGEMENT
  // ================================

  /**
   * Cambiar contraseña del usuario actual
   */
  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { oldPassword, newPassword } = req.body;
      const currentUser = req.user as JWTPayload;
      const jwt = req.jwt;
      if(!jwt){
        res.status(401).json({
          success: false,
          message: 'Token JWT no proporcionado',
          error: 'JWT_REQUIRED'
        });
        return;
      }
      // Validar datos requeridos
      if (!oldPassword || !newPassword) {
        res.status(400).json({
          success: false,
          message: 'Contraseña actual y nueva contraseña son requeridas',
          error: 'MISSING_FIELDS'
        });
        return;
      }

      // Validar contraseña nueva
      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          message: 'La nueva contraseña debe tener al menos 8 caracteres',
          error: 'WEAK_PASSWORD'
        });
        return;
      }

      const result = await this.userService.changePassword(currentUser.userId, oldPassword, newPassword,jwt);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Resetear contraseña de un usuario (solo admin)
   */
    resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body;
      const currentUser = req.user as JWTPayload;

      // Solo admin puede resetear contraseñas
      if (currentUser.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden resetear contraseñas',
          error: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'El parámetro id es requerido',
          error: 'ID_REQUIRED'
        });
        return;
      }

      const result = await this.userService.resetPassword(id, newPassword);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Generar nueva contraseña temporal para un usuario
   */
  generateTemporaryPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { sendByEmail = true } = req.body; // Por defecto enviar por email
      const currentUser = req.user as JWTPayload;

      // Solo admin puede generar contraseñas temporales
      if (currentUser.role !== 'admin') {
        res.status(403).json({
          success: false,
          message: 'Solo los administradores pueden generar contraseñas temporales',
          error: 'INSUFFICIENT_PERMISSIONS'
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'El parámetro id es requerido',
          error: 'ID_REQUIRED'
        });
        return;
      }

      const result = await this.userService.generateTemporaryPassword(id, sendByEmail);

      if (result.success) {
        auditLog('user.password_reset', { type: 'user', id }, { req, details: { sentByEmail: sendByEmail } });
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  };

  deleteBulkUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { ids } = req.body;
      
      if (!Array.isArray(ids)) {
        res.status(400).json({
          success: false,
          message: 'El campo ids debe ser un array',
          error: 'INVALID_INPUT'
        });
        return;
      }

      const result = await this.userService.bulkDeleteUsers(ids);
      
      if (result.success) {
        res.status(200).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // IMPORT / EXPORT / TEMPLATE
  // ================================

  downloadTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const templateData = [
        { firstName: 'Juan', lastName: 'Pérez', email: 'juan.perez@ejemplo.com', role: 'teacher', isActive: true },
        { firstName: 'María', lastName: 'García', email: 'maria.garcia@ejemplo.com', role: 'proctor', isActive: true },
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="plantilla_usuarios.xlsx"');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  exportUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query as any;
      const result = await this.userService.getUsers(
        { page: 1, limit: 10000, sortBy: 'createdAt', sortOrder: 'desc' },
        { search: query.search, role: query.role, status: query.status }
      );

      if (!result.success || !result.data) {
        res.status(400).json({ success: false, message: 'Error obteniendo usuarios para exportar' });
        return;
      }

      const users: any[] = (result.data as any).users || [];
      const exportData = users.map((u: any) => ({
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt ? new Date(u.createdAt).toLocaleDateString('es-BO') : '',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [{ wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Usuarios');

      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = `usuarios_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  importUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No se proporcionó ningún archivo', error: 'NO_FILE' });
        return;
      }

      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const firstSheet = wb.SheetNames[0];
      if (!firstSheet) {
        res.status(400).json({ success: false, message: 'El archivo no contiene hojas de datos', error: 'NO_SHEET' });
        return;
      }
      const ws = wb.Sheets[firstSheet]!;
      const rows: any[] = XLSX.utils.sheet_to_json(ws);

      if (rows.length === 0) {
        res.status(400).json({ success: false, message: 'El archivo está vacío o no tiene el formato correcto', error: 'EMPTY_FILE' });
        return;
      }

      const validRoles = ['admin', 'teacher', 'proctor', 'student'];
      let created = 0;
      let failed = 0;
      const details: any[] = [];

      for (const row of rows) {
        const email = row.email?.toString().trim();
        const firstName = row.firstName?.toString().trim();
        const lastName = row.lastName?.toString().trim();
        const role = row.role?.toString().trim().toLowerCase();
        const isActive = row.isActive === false || row.isActive === 'false' ? false : true;

        if (!email || !firstName || !lastName) {
          failed++;
          details.push({ email: email || '(sin email)', status: 'failed', error: 'Faltan campos requeridos: email, firstName, lastName' });
          continue;
        }

        if (!validRoles.includes(role)) {
          failed++;
          details.push({ email, status: 'failed', error: `Rol inválido: "${role}". Use: admin, teacher, proctor, student` });
          continue;
        }

        const result = await this.userService.createUser({ email, firstName, lastName, role: role as any, status: isActive ? 'active' : 'inactive' });
        if (result.success) {
          created++;
          details.push({ email, status: 'created' });
        } else {
          failed++;
          details.push({ email, status: 'failed', error: result.message });
        }
      }

      auditLog('user.bulk_import', { type: 'user' }, { req, details: { created, failed, total: rows.length } });
      res.status(200).json({
        success: true,
        message: `Importación completada: ${created} creados, ${failed} fallidos de ${rows.length} total`,
        data: { created, failed, total: rows.length, details }
      });
    } catch (error) {
      next(error);
    }
  };

  // ================================
  // SERVICE HEALTH CHECKS
  // ================================

  /**
   * Verificar estado de conexiones con servicios externos
   */
  // ================================
  // AVATAR UPLOAD
  // ================================

  uploadAvatar = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No se envió ningún archivo', error: 'NO_FILE' });
        return;
      }

      // Buscar el usuario por authServiceUserId (del JWT) para obtener el _id real de UMS
      const jwtUser = req.user as JWTPayload;
      if (!jwtUser?.userId) {
        res.status(401).json({ success: false, message: 'No autenticado', error: 'UNAUTHORIZED' });
        return;
      }

      const existingUser = await this.userService.getUserByAuthServiceId(jwtUser.userId);
      if (!existingUser) {
        res.status(404).json({ success: false, message: 'Usuario no encontrado', error: 'USER_NOT_FOUND' });
        return;
      }

      const umsId = existingUser._id!.toString();
      const { uploadAvatar } = await import('../services/storage.service');
      const avatarUrl = await uploadAvatar(req.file, umsId);
      await this.userService.updateUser(umsId, { profile: { avatarUrl } } as any);
      res.json({ success: true, message: 'Avatar actualizado', data: { avatarUrl } });
    } catch (error) {
      next(error);
    }
  };

  healthCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authServiceStatus = await this.userService.checkAuthServiceConnection();
      
      res.status(200).json({
        success: true,
        message: 'Health check completado',
        data: {
          userManagementService: {
            status: 'healthy',
            timestamp: new Date().toISOString()
          },
          authService: authServiceStatus.data,
          database: {
            status: 'connected', // Esto se podría verificar realmente
            timestamp: new Date().toISOString()
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
