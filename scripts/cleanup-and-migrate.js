// scripts/cleanup-and-migrate.js - Script para limpiar duplicados y migrar datos

const { MongoClient } = require('mongodb');

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is required. Refusing to run against a hardcoded connection string.');
  process.exit(1);
}

const config = {
  mongoUri: process.env.MONGO_URI,
  
  // Bases de datos separadas
  authDb: 'cba_auth_db',
  userMgmtDb: 'cba_user_management_db',
  notificationDb: 'cba_notification_db',
  
  // Colecciones
  collections: {
    auth: {
      users: 'users',
      sessions: 'sessions',
      blacklist: 'blacklist'
    },
    userMgmt: {
      users: 'users',
      candidates: 'candidates',
      roles: 'roles'
    },
    notification: {
      emails: 'notification_emails',
      templates: 'email_templates'
    }
  }
};

class DatabaseMigrator {
  constructor() {
    this.client = null;
  }

  async connect() {
    try {
      console.log('🔌 Conectando a MongoDB...');
      this.client = new MongoClient(config.mongoUri);
      await this.client.connect();
      console.log('✅ Conectado a MongoDB');
    } catch (error) {
      console.error('❌ Error conectando a MongoDB:', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('🔌 Desconectado de MongoDB');
    }
  }

  async cleanup() {
    console.log('\n🧹 INICIANDO LIMPIEZA DE DATOS DUPLICADOS...\n');

    try {
      // 1. Listar todas las bases de datos existentes
      const adminDb = this.client.db('admin');
      const databases = await adminDb.admin().listDatabases();
      
      console.log('📋 Bases de datos existentes:');
      databases.databases.forEach(db => {
        console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
      });

      // 2. Verificar si existe la BD problemática
      const problematicDb = 'cba_platform_db';
      const hasProblematicDb = databases.databases.some(db => db.name === problematicDb);

      if (hasProblematicDb) {
        console.log(`\n⚠️ Encontrada base de datos problemática: ${problematicDb}`);
        
        // Backup de usuarios antes de eliminar
        await this.backupUsers(problematicDb);
        
        // Eliminar la base de datos problemática
        console.log(`🗑️ Eliminando base de datos: ${problematicDb}`);
        await this.client.db(problematicDb).dropDatabase();
        console.log('✅ Base de datos eliminada');
      } else {
        console.log(`ℹ️ No se encontró la base de datos problemática: ${problematicDb}`);
      }

      // 3. Limpiar posibles duplicados en las BDs correctas
      await this.cleanupDatabase(config.authDb, config.collections.auth);
      await this.cleanupDatabase(config.userMgmtDb, config.collections.userMgmt);
      await this.cleanupDatabase(config.notificationDb, config.collections.notification);

    } catch (error) {
      console.error('❌ Error durante la limpieza:', error);
      throw error;
    }
  }

  async backupUsers(dbName) {
    try {
      console.log(`💾 Haciendo backup de usuarios de ${dbName}...`);
      
      const db = this.client.db(dbName);
      const users = await db.collection('users').find({}).toArray();
      
      if (users.length > 0) {
        console.log(`📊 Encontrados ${users.length} usuarios para backup`);
        
        // Guardar en archivo JSON con timestamp
        const fs = require('fs');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = `./users-backup-${timestamp}.json`;
        
        fs.writeFileSync(backupFile, JSON.stringify(users, null, 2));
        console.log(`✅ Backup guardado en: ${backupFile}`);
        
        // Mostrar resumen de usuarios
        console.log('\n📋 Resumen de usuarios en backup:');
        const summary = users.reduce((acc, user) => {
          acc[user.role || 'unknown'] = (acc[user.role || 'unknown'] || 0) + 1;
          return acc;
        }, {});
        
        Object.entries(summary).forEach(([role, count]) => {
          console.log(`   - ${role}: ${count} usuarios`);
        });
      } else {
        console.log('ℹ️ No se encontraron usuarios para backup');
      }
    } catch (error) {
      console.error('❌ Error en backup:', error);
    }
  }

  async cleanupDatabase(dbName, collections) {
    try {
      console.log(`\n🧽 Limpiando base de datos: ${dbName}`);
      
      const db = this.client.db(dbName);
      
      for (const [collectionType, collectionName] of Object.entries(collections)) {
        try {
          const collection = db.collection(collectionName);
          
          // Verificar si la colección existe
          const collectionExists = await this.collectionExists(db, collectionName);
          
          if (collectionExists) {
            const count = await collection.countDocuments();
            console.log(`   📁 ${collectionName}: ${count} documentos`);
            
            // Remover duplicados por email si es colección de usuarios
            if (collectionName === 'users') {
              await this.removeDuplicatesByEmail(collection);
            }
          } else {
            console.log(`   📁 ${collectionName}: colección no existe (será creada automáticamente)`);
          }
        } catch (error) {
          console.warn(`   ⚠️ Error verificando colección ${collectionName}:`, error.message);
        }
      }
    } catch (error) {
      console.error(`❌ Error limpiando ${dbName}:`, error);
    }
  }

  async collectionExists(db, collectionName) {
    try {
      const collections = await db.listCollections({ name: collectionName }).toArray();
      return collections.length > 0;
    } catch (error) {
      return false;
    }
  }

  async removeDuplicatesByEmail(collection) {
    try {
      console.log('      🔍 Buscando duplicados por email...');
      
      // Encontrar duplicados
      const duplicates = await collection.aggregate([
        {
          $group: {
            _id: '$email',
            count: { $sum: 1 },
            docs: { $push: '$_id' }
          }
        },
        {
          $match: {
            count: { $gt: 1 }
          }
        }
      ]).toArray();

      if (duplicates.length > 0) {
        console.log(`      🗑️ Encontrados ${duplicates.length} emails duplicados`);
        
        for (const dup of duplicates) {
          // Mantener el primer documento, eliminar el resto
          const toDelete = dup.docs.slice(1);
          
          if (toDelete.length > 0) {
            await collection.deleteMany({ _id: { $in: toDelete } });
            console.log(`      ✅ Eliminados ${toDelete.length} duplicados para: ${dup._id}`);
          }
        }
      } else {
        console.log('      ✅ No se encontraron duplicados por email');
      }
    } catch (error) {
      console.error('      ❌ Error removiendo duplicados:', error);
    }
  }

  async setupIndexes() {
    console.log('\n📝 CONFIGURANDO ÍNDICES...\n');

    try {
      // Índices para auth-service
      const authDb = this.client.db(config.authDb);
      await this.createIndexIfNotExists(authDb, 'users', { email: 1 }, { unique: true });
      await this.createIndexIfNotExists(authDb, 'users', { role: 1 });
      await this.createIndexIfNotExists(authDb, 'sessions', { userId: 1 });
      await this.createIndexIfNotExists(authDb, 'sessions', { token: 1 }, { unique: true });

      // Índices para user-management
      const userMgmtDb = this.client.db(config.userMgmtDb);
      await this.createIndexIfNotExists(userMgmtDb, 'users', { email: 1 }, { unique: true });
      await this.createIndexIfNotExists(userMgmtDb, 'users', { authServiceUserId: 1 });
      await this.createIndexIfNotExists(userMgmtDb, 'users', { role: 1 });
      await this.createIndexIfNotExists(userMgmtDb, 'users', { status: 1 });
      await this.createIndexIfNotExists(userMgmtDb, 'candidates', { email: 1 });
      await this.createIndexIfNotExists(userMgmtDb, 'roles', { name: 1 }, { unique: true });

      // Índices para notifications
      const notificationDb = this.client.db(config.notificationDb);
      await this.createIndexIfNotExists(notificationDb, 'notification_emails', { recipient: 1 });
      await this.createIndexIfNotExists(notificationDb, 'notification_emails', { status: 1 });
      await this.createIndexIfNotExists(notificationDb, 'notification_emails', { createdAt: 1 });

      console.log('✅ Índices configurados correctamente');

    } catch (error) {
      console.error('❌ Error configurando índices:', error);
      throw error;
    }
  }

  async createIndexIfNotExists(db, collectionName, indexSpec, options = {}) {
    try {
      const collection = db.collection(collectionName);
      
      // Verificar si el índice ya existe
      const indexes = await collection.indexes();
      const indexKey = JSON.stringify(indexSpec);
      const exists = indexes.some(index => JSON.stringify(index.key) === indexKey);
      
      if (!exists) {
        await collection.createIndex(indexSpec, options);
        console.log(`   ✅ Índice creado en ${collectionName}:`, indexSpec);
      } else {
        console.log(`   ℹ️ Índice ya existe en ${collectionName}:`, indexSpec);
      }
    } catch (error) {
      console.warn(`   ⚠️ Error creando índice en ${collectionName}:`, error.message);
    }
  }

  async verifySetup() {
    console.log('\n🔍 VERIFICANDO CONFIGURACIÓN...\n');

    try {
      const adminDb = this.client.db('admin');
      const databases = await adminDb.admin().listDatabases();
      
      console.log('📋 Estado final de bases de datos:');
      
      for (const dbName of [config.authDb, config.userMgmtDb, config.notificationDb]) {
        const dbExists = databases.databases.some(db => db.name === dbName);
        
        if (dbExists) {
          const db = this.client.db(dbName);
          const collections = await db.listCollections().toArray();
          
          console.log(`   ✅ ${dbName}:`);
          for (const col of collections) {
            const count = await db.collection(col.name).countDocuments();
            console.log(`      📁 ${col.name}: ${count} documentos`);
          }
        } else {
          console.log(`   📝 ${dbName}: será creada automáticamente cuando sea necesaria`);
        }
      }
      
      console.log('\n🎉 Configuración verificada correctamente');
      
    } catch (error) {
      console.error('❌ Error verificando configuración:', error);
      throw error;
    }
  }

  async run() {
    try {
      console.log('🚀 INICIANDO MIGRACIÓN Y LIMPIEZA DE BASE DE DATOS\n');
      
      await this.connect();
      await this.cleanup();
      await this.setupIndexes();
      await this.verifySetup();
      
      console.log('\n✅ MIGRACIÓN COMPLETADA EXITOSAMENTE');
      console.log('\n📌 PRÓXIMOS PASOS:');
      console.log('   1. Reinicia los servicios con docker-compose restart');
      console.log('   2. Verifica que cada servicio use su propia base de datos');
      console.log('   3. Crea un nuevo usuario admin si es necesario');
      
    } catch (error) {
      console.error('\n❌ ERROR EN LA MIGRACIÓN:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Ejecutar migración
if (require.main === module) {
  const migrator = new DatabaseMigrator();
  
  migrator.run()
    .then(() => {
      console.log('\n🎉 Proceso completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Proceso falló:', error);
      process.exit(1);
    });
}

module.exports = DatabaseMigrator;
