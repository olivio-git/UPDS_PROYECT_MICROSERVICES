import { Collection, Db, ObjectId, Filter, UpdateFilter, FindOptions } from 'mongodb';
import { getDatabase } from '../database/connections';
import { Role, Permission, UserRole } from '../types';
import { RoleModel } from '../models/Role';
import config from '../config';

export class RoleRepository {
  private db: Db;
  private collection: Collection<Role>;

  constructor() {
    this.db = getDatabase();
    this.collection = this.db.collection<Role>(config.collections.roles);
  }

  // ================================
  // CRUD OPERATIONS
  // ================================

  async create(roleData: Omit<Role, '_id' | 'createdAt' | 'updatedAt'>): Promise<RoleModel> {
    const role = new RoleModel({
      ...roleData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const validation = role.validate();
    if (!validation.isValid) {
      throw new Error(`Datos de rol inválidos: ${validation.errors.join(', ')}`);
    }

    const result = await this.collection.insertOne(role.toJSON());
    
    if (!result.insertedId) {
      throw new Error('Error creando rol');
    }

    role._id = result.insertedId;
    return role;
  }

  async findById(id: string | ObjectId): Promise<RoleModel | null> {
    try {
      const objectId = typeof id === 'string' ? new ObjectId(id) : id;
      const roleData = await this.collection.findOne({ _id: objectId });
      
      return roleData ? RoleModel.fromDatabase(roleData) : null;
    } catch (error) {
      console.error('Error buscando rol por ID:', error);
      return null;
    }
  }

  async findByName(name: string): Promise<RoleModel | null> {
    try {
      const roleData = await this.collection.findOne({ name });
      return roleData ? RoleModel.fromDatabase(roleData) : null;
    } catch (error) {
      console.error('Error buscando rol por nombre:', error);
      return null;
    }
  }

  async update(id: string | ObjectId, updates: UpdateFilter<Role>): Promise<RoleModel | null> {
    try {
      const objectId = typeof id === 'string' ? new ObjectId(id) : id;
      
      const updateDoc = {
        ...updates,
        updatedAt: new Date(),
      };

      const result = await this.collection.findOneAndUpdate(
        { _id: objectId },
        { $set: updateDoc },
        { returnDocument: 'after' }
      );

      return result ? RoleModel.fromDatabase(result) : null;
    } catch (error) {
      console.error('Error actualizando rol:', error);
      throw error;
    }
  }

  async delete(id: string | ObjectId): Promise<boolean> {
    try {
      const objectId = typeof id === 'string' ? new ObjectId(id) : id;
      
      // Verificar si es un rol por defecto
      const role = await this.findById(objectId);
      if (role?.isDefault) {
        throw new Error('No se puede eliminar un rol por defecto');
      }

      const result = await this.collection.deleteOne({ _id: objectId });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error eliminando rol:', error);
      throw error;
    }
  }

  // ================================
  // QUERY OPERATIONS
  // ================================

  async findAll(): Promise<RoleModel[]> {
    try {
      const roles = await this.collection.find({}).sort({ name: 1 }).toArray();
      return roles.map(role => RoleModel.fromDatabase(role));
    } catch (error) {
      console.error('Error obteniendo roles:', error);
      return [];
    }
  }

  async findDefaultRoles(): Promise<RoleModel[]> {
    try {
      const roles = await this.collection.find({ isDefault: true }).toArray();
      return roles.map(role => RoleModel.fromDatabase(role));
    } catch (error) {
      console.error('Error obteniendo roles por defecto:', error);
      return [];
    }
  }

  async findCustomRoles(): Promise<RoleModel[]> {
    try {
      const roles = await this.collection.find({ isDefault: false }).toArray();
      return roles.map(role => RoleModel.fromDatabase(role));
    } catch (error) {
      console.error('Error obteniendo roles personalizados:', error);
      return [];
    }
  }

  async findByPermission(resource: string, action: string): Promise<RoleModel[]> {
    try {
      const roles = await this.collection.find({
        permissions: {
          $elemMatch: {
            resource: resource,
            actions: action
          }
        }
      }).toArray();

      return roles.map(role => RoleModel.fromDatabase(role));
    } catch (error) {
      console.error('Error buscando roles por permiso:', error);
      return [];
    }
  }

  // ================================
  // INITIALIZATION
  // ================================

  async initializeDefaultRoles(): Promise<void> {
    try {
      console.log('🔧 Inicializando roles por defecto...');

      const defaultRoles = RoleModel.getDefaultRoles();
      
      for (const defaultRole of defaultRoles) {
        const existingRole = await this.findByName(defaultRole.name);
        
        if (!existingRole) {
          await this.collection.insertOne(defaultRole.toJSON());
          console.log(`✅ Rol creado: ${defaultRole.name}`);
        } else {
          // Actualizar permisos si el rol ya existe pero necesita actualizaciones
          await this.collection.updateOne(
            { name: defaultRole.name },
            { 
              $set: { 
                permissions: defaultRole.permissions,
                updatedAt: new Date()
              }
            }
          );
          console.log(`🔄 Rol actualizado: ${defaultRole.name}`);
        }
      }

      console.log('✅ Roles por defecto inicializados correctamente');
    } catch (error) {
      console.error('❌ Error inicializando roles por defecto:', error);
      throw error;
    }
  }

  // ================================
  // PERMISSION OPERATIONS
  // ================================

  async addPermissionToRole(
    roleId: string | ObjectId, 
    resource: string, 
    actions: string[]
  ): Promise<RoleModel | null> {
    try {
      const objectId = typeof roleId === 'string' ? new ObjectId(roleId) : roleId;
      
      const role = await this.findById(objectId);
      if (!role) return null;

      role.addPermission(resource, actions);
      
      return this.update(objectId, { permissions: role.permissions });
    } catch (error) {
      console.error('Error agregando permiso a rol:', error);
      return null;
    }
  }

  async removePermissionFromRole(
    roleId: string | ObjectId, 
    resource: string, 
    actions?: string[]
  ): Promise<RoleModel | null> {
    try {
      const objectId = typeof roleId === 'string' ? new ObjectId(roleId) : roleId;
      
      const role = await this.findById(objectId);
      if (!role) return null;

      role.removePermission(resource, actions);
      
      return this.update(objectId, { permissions: role.permissions });
    } catch (error) {
      console.error('Error removiendo permiso de rol:', error);
      return null;
    }
  }

  async hasPermission(
    roleId: string | ObjectId, 
    resource: string, 
    action: string
  ): Promise<boolean> {
    try {
      const role = await this.findById(roleId);
      return role ? role.hasPermission(resource, action) : false;
    } catch (error) {
      console.error('Error verificando permiso:', error);
      return false;
    }
  }

  // ================================
  // ROLE MANAGEMENT
  // ================================

  async cloneRole(roleId: string | ObjectId, newName: string): Promise<RoleModel | null> {
    try {
      const role = await this.findById(roleId);
      if (!role) return null;

      // Verificar que el nuevo nombre no exista
      const existingRole = await this.findByName(newName);
      if (existingRole) {
        throw new Error('Ya existe un rol con ese nombre');
      }

      const clonedRole = role.clone(newName);
      const result = await this.collection.insertOne(clonedRole.toJSON());
      
      if (!result.insertedId) {
        throw new Error('Error clonando rol');
      }

      clonedRole._id = result.insertedId;
      return clonedRole;
    } catch (error) {
      console.error('Error clonando rol:', error);
      throw error;
    }
  }

  async makeDefault(roleId: string | ObjectId): Promise<RoleModel | null> {
    try {
      const objectId = typeof roleId === 'string' ? new ObjectId(roleId) : roleId;
      return this.update(objectId, { isDefault: true });
    } catch (error) {
      console.error('Error marcando rol como defecto:', error);
      return null;
    }
  }

  async removeDefault(roleId: string | ObjectId): Promise<RoleModel | null> {
    try {
      const objectId = typeof roleId === 'string' ? new ObjectId(roleId) : roleId;
      return this.update(objectId, { isDefault: false });
    } catch (error) {
      console.error('Error removiendo rol como defecto:', error);
      return null;
    }
  }

  // ================================
  // HELPER METHODS
  // ================================

  async getRoleByUserRole(userRole: UserRole): Promise<RoleModel | null> {
    const roleNames: Record<UserRole, string> = {
      admin: 'Administrador',
      teacher: 'Profesor',
      proctor: 'Supervisor',
      student: 'Estudiante',
    };

    return this.findByName(roleNames[userRole]);
  }

  async canUserPerformAction(
    userRole: UserRole, 
    resource: string, 
    action: string
  ): Promise<boolean> {
    try {
      const role = await this.getRoleByUserRole(userRole);
      return role ? role.hasPermission(resource, action) : false;
    } catch (error) {
      console.error('Error verificando acción de usuario:', error);
      return false;
    }
  }

  // ================================
  // VALIDATION HELPERS
  // ================================

  async nameExists(name: string, excludeId?: string | ObjectId): Promise<boolean> {
    try {
      const query: Filter<Role> = { name };
      
      if (excludeId) {
        const objectId = typeof excludeId === 'string' ? new ObjectId(excludeId) : excludeId;
        query._id = { $ne: objectId };
      }

      const count = await this.collection.countDocuments(query);
      return count > 0;
    } catch (error) {
      console.error('Error verificando nombre de rol existente:', error);
      return false;
    }
  }

  // ================================
  // STATISTICS
  // ================================

  async getStatistics(): Promise<{
    total: number;
    defaultRoles: number;
    customRoles: number;
    mostUsedPermissions: Array<{ resource: string; count: number }>;
  }> {
    try {
      const [total, defaultRoles, customRoles, permissionStats] = await Promise.all([
        this.collection.countDocuments(),
        this.collection.countDocuments({ isDefault: true }),
        this.collection.countDocuments({ isDefault: false }),
        this.getMostUsedPermissions(),
      ]);

      return {
        total,
        defaultRoles,
        customRoles,
        mostUsedPermissions: permissionStats,
      };
    } catch (error) {
      console.error('Error obteniendo estadísticas de roles:', error);
      throw error;
    }
  }

  private async getMostUsedPermissions(): Promise<Array<{ resource: string; count: number }>> {
    try {
      const pipeline = [
        { $unwind: '$permissions' },
        { $group: { _id: '$permissions.resource', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ];

      const results = await this.collection.aggregate(pipeline).toArray();
      
      return results.map(result => ({
        resource: result._id,
        count: result.count,
      }));
    } catch (error) {
      console.error('Error obteniendo permisos más usados:', error);
      return [];
    }
  }

  // ================================
  // EXPORT/IMPORT
  // ================================

  async exportRoles(): Promise<RoleModel[]> {
    try {
      return this.findAll();
    } catch (error) {
      console.error('Error exportando roles:', error);
      return [];
    }
  }

  async importRoles(roles: Partial<Role>[]): Promise<{ successful: number; failed: number; errors: string[] }> {
    const result = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const roleData of roles) {
      try {
        // Verificar que no exista un rol con el mismo nombre
        if (roleData.name && await this.nameExists(roleData.name)) {
          result.failed++;
          result.errors.push(`Rol '${roleData.name}' ya existe`);
          continue;
        }

        const role = new RoleModel(roleData);
        const validation = role.validate();
        
        if (!validation.isValid) {
          result.failed++;
          result.errors.push(`Rol '${roleData.name}': ${validation.errors.join(', ')}`);
          continue;
        }

        await this.collection.insertOne(role.toJSON());
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push(`Error importando rol '${roleData.name}': ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }
    }

    return result;
  }
}
