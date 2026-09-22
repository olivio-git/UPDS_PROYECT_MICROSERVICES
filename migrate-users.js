// scripts/migrate-users.js - Script para migrar usuarios existentes

const { MongoClient } = require('mongodb');

const config = {
  mongoUri: 'mongodb://sa:olivio12@localhost:27017',
  oldAuthDb: 'microservices_auth_olivio',
  newDb: 'cba_platform_db',
  collections: {
    users: 'users',
    sessions: 'sessions'
  }
};

async function migrateUsers() {
  const client = new MongoClient(config.mongoUri);
  
  try {
    await client.connect();
    console.log('✅ Conectado a MongoDB');

    const oldAuthDb = client.db(config.oldAuthDb);
    const newDb = client.db(config.newDb);

    // 1. Migrar usuarios
    const oldUsers = await oldAuthDb.collection('users').find({}).toArray();
    console.log(`📊 Usuarios encontrados en auth DB: ${oldUsers.length}`);

    for (const oldUser of oldUsers) {
      try {
        // Transformar estructura de auth-service a user-management-service
        const newUser = transformUser(oldUser);
        
        // Verificar si ya existe
        const existingUser = await newDb.collection('users').findOne({ email: newUser.email });
        
        if (!existingUser) {
          await newDb.collection('users').insertOne(newUser);
          console.log(`✅ Usuario migrado: ${newUser.email}`);
        } else {
          // Actualizar usuario existente
          await newDb.collection('users').updateOne(
            { email: newUser.email },
            { $set: newUser }
          );
          console.log(`🔄 Usuario actualizado: ${newUser.email}`);
        }
      } catch (error) {
        console.error(`❌ Error migrando usuario ${oldUser.email}:`, error);
      }
    }

    // 2. Migrar sesiones
    const oldSessions = await oldAuthDb.collection('sessions').find({}).toArray();
    console.log(`📊 Sesiones encontradas: ${oldSessions.length}`);

    for (const session of oldSessions) {
      try {
        const existingSession = await newDb.collection('sessions').findOne({ 
          refreshToken: session.refreshToken 
        });
        
        if (!existingSession) {
          await newDb.collection('sessions').insertOne(session);
          console.log(`✅ Sesión migrada: ${session._id}`);
        }
      } catch (error) {
        console.error(`❌ Error migrando sesión:`, error);
      }
    }

    console.log('🎉 Migración completada');

  } catch (error) {
    console.error('❌ Error en la migración:', error);
  } finally {
    await client.close();
  }
}

function transformUser(authUser) {
  return {
    _id: authUser._id,
    email: authUser.email,
    // NO incluir password en user-management
    firstName: authUser.firstName,
    lastName: authUser.lastName,
    role: authUser.role,
    status: authUser.isActive ? 'active' : 'inactive', // Mapear isActive -> status
    profile: transformProfile(authUser.profile),
    permissions: transformPermissions(authUser.permissions, authUser.role),
    teacherData: transformTeacherData(authUser.teacherData),
    proctorData: transformProctorData(authUser.proctorData),
    createdAt: authUser.createdAt,
    updatedAt: authUser.updatedAt,
    lastLogin: authUser.lastLogin
  };
}

function transformProfile(authProfile) {
  return {
    preferences: {
      language: 'es',
      timezone: 'America/La_Paz',
      notifications: {
        email: true,
        push: true,
        sms: false
      }
    },
    // Mapear campos existentes si están disponibles
    ...(authProfile?.avatar && { avatar: authProfile.avatar }),
    ...(authProfile?.phone && { phone: authProfile.phone }),
    ...(authProfile?.address && { address: authProfile.address })
  };
}

function transformPermissions(permissions, role) {
  // Mapear de array simple a array de objetos complejos según el rol
  const permissionMap = {
    admin: [
      { resource: 'users', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'candidates', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'exams', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'sessions', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'reports', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'settings', actions: ['create', 'read', 'update', 'delete', 'manage'] },
      { resource: 'roles', actions: ['create', 'read', 'update', 'delete', 'manage'] }
    ],
    teacher: [
      { resource: 'candidates', actions: ['create', 'read', 'update'] },
      { resource: 'exams', actions: ['create', 'read', 'update'] },
      { resource: 'sessions', actions: ['read', 'execute'] },
      { resource: 'reports', actions: ['read'] },
      { resource: 'questions', actions: ['create', 'read', 'update'] },
      { resource: 'results', actions: ['read', 'update'] }
    ],
    proctor: [
      { resource: 'sessions', actions: ['read', 'execute'] },
      { resource: 'candidates', actions: ['read'] },
      { resource: 'exams', actions: ['read'] },
      { resource: 'reports', actions: ['read'] }
    ],
    student: [
      { resource: 'exams', actions: ['read', 'execute'] },
      { resource: 'results', actions: ['read'] }
    ]
  };

  return permissionMap[role] || permissionMap.student;
}

function transformTeacherData(authTeacherData) {
  if (!authTeacherData) return undefined;

  return {
    department: 'English Department',
    specialization: authTeacherData.specialization || ['General English'],
    experience: authTeacherData.experience || 0,
    certification: {
      level: 'Certified',
      issuer: 'CBA Tarija',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 año
    },
    availableHours: [
      { day: 'monday', start: '08:00', end: '18:00' },
      { day: 'tuesday', start: '08:00', end: '18:00' },
      { day: 'wednesday', start: '08:00', end: '18:00' },
      { day: 'thursday', start: '08:00', end: '18:00' },
      { day: 'friday', start: '08:00', end: '18:00' }
    ]
  };
}

function transformProctorData(authProctorData) {
  if (!authProctorData) return undefined;

  return {
    certificationLevel: 'Advanced Proctor',
    languages: ['es', 'en'],
    maxSimultaneousSessions: 5,
    certification: {
      level: authProctorData.certifications?.[0] || 'Basic',
      issuer: 'CBA Tarija',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    },
    schedule: {
      timezone: 'America/La_Paz',
      availableHours: authProctorData.availableHours || [
        { day: 'monday', start: '08:00', end: '18:00' },
        { day: 'tuesday', start: '08:00', end: '18:00' },
        { day: 'wednesday', start: '08:00', end: '18:00' },
        { day: 'thursday', start: '08:00', end: '18:00' },
        { day: 'friday', start: '08:00', end: '18:00' }
      ]
    }
  };
}

// Ejecutar migración
if (require.main === module) {
  migrateUsers()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Error en la migración:', error);
      process.exit(1);
    });
}

module.exports = { migrateUsers, transformUser };
