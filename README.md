# 🚀 CBA Platform - Microservices API Documentation

## 📋 Servicios Implementados

| Servicio | Puerto | Base URL | Estado |
|----------|--------|----------|--------|
| **auth-service** | 3000 | `/auth` | ✅ Activo |
| **notifications-service** | 3001 | `/notifications` | ✅ Activo |
| **user-management-service** | 3002 | `/api/v1` | ✅ Activo |

---

## 🔐 AUTH-SERVICE (Puerto 3000)

### **Base URL:** `http://localhost:3000/auth`

### **Endpoints Públicos**

#### Registro de Usuario
```http
POST /auth/register
Content-Type: application/json

{
  "email": "usuario@ejemplo.com",
  "password": "password123",
  "firstName": "Juan",
  "lastName": "Pérez",
  "role": "student" // admin, teacher, proctor, student
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "usuario@ejemplo.com",
  "password": "password123"
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### **Endpoints Protegidos**
*Requieren: `Authorization: Bearer {token}`*

#### Obtener Perfil
```http
GET /auth/profile
```

#### Validar Token
```http
GET /auth/validate
```

#### Cambiar Contraseña
```http
POST /auth/change-password
Content-Type: application/json

{
  "userId": "user_id",
  "oldPassword": "password_anterior",
  "newPassword": "password_nuevo"
}
```

#### Logout
```http
POST /auth/logout
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Logout All Sessions
```http
POST /auth/logout-all
```

### **OTP Endpoints**

#### Generar OTP
```http
POST /auth/otp/generate
Content-Type: application/json

{
  "email": "usuario@ejemplo.com",
  "purpose": "login" // login, password_reset, email_verification
}
```

#### Verificar OTP
```http
POST /auth/otp/verify
Content-Type: application/json

{
  "email": "usuario@ejemplo.com",
  "code": "123456",
  "purpose": "login"
}
```

#### Estado OTP
```http
GET /auth/otp/status?email=usuario@ejemplo.com&purpose=login
```

#### Revocar OTP
```http
DELETE /auth/otp/revoke
Content-Type: application/json

{
  "email": "usuario@ejemplo.com",
  "purpose": "login"
}
```

---

## 📧 NOTIFICATIONS-SERVICE (Puerto 3001)

### **Base URL:** `http://localhost:3001/notifications`

### **Endpoints Principales**

#### Enviar Email de Prueba
```http
POST /notifications/send-test
Content-Type: application/json

{
  "to": "destinatario@ejemplo.com",
  "type": "welcome", // welcome, otp, password_reset
  "data": {
    "firstName": "Juan",
    "lastName": "Pérez",
    "code": "123456" // para OTP
  }
}
```

#### Estadísticas de Emails
```http
GET /notifications/stats
```

#### Historial de Emails
```http
GET /notifications/history?email=usuario@ejemplo.com&limit=10
```

#### Procesar Cola de Emails
```http
POST /notifications/process-queue
```

#### Reintentar Emails Fallidos
```http
POST /notifications/retry-failed
```

#### Health Check
```http
GET /notifications/health
```

---

## 👥 USER-MANAGEMENT-SERVICE (Puerto 3002)

### **Base URL:** `http://localhost:3002/api/v1`

### **Rutas de Usuarios** `/users`

#### Listar Usuarios
```http
GET /api/v1/users?page=1&limit=10&role=student&status=active
Authorization: Bearer {token}
```

#### Obtener Usuario por ID
```http
GET /api/v1/users/{id}
Authorization: Bearer {token}
```

#### Crear Usuario
```http
POST /api/v1/users
Authorization: Bearer {token}
Content-Type: application/json

{
  "email": "nuevo@ejemplo.com",
  "firstName": "Nombre",
  "lastName": "Apellido",
  "role": "student",
  "permissions": ["exam.take", "result.view"]
}
```

#### Actualizar Usuario
```http
PUT /api/v1/users/{id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "firstName": "Nuevo Nombre",
  "lastName": "Nuevo Apellido",
  "isActive": true
}
```

#### Cambiar Contraseña de Usuario
```http
PUT /api/v1/users/{id}/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "newPassword": "nueva_password123"
}
```

#### Eliminar Usuario
```http
DELETE /api/v1/users/{id}
Authorization: Bearer {token}
```

#### Generar Contraseña Temporal
```http
POST /api/v1/users/{id}/generate-password
Authorization: Bearer {token}
```

#### Obtener Permisos de Usuario
```http
GET /api/v1/users/{id}/permissions
Authorization: Bearer {token}
```

### **Rutas de Candidatos** `/candidates`

#### Listar Candidatos
```http
GET /api/v1/candidates?page=1&limit=10&level=B1&status=verified
Authorization: Bearer {token}
```

#### Crear Candidato
```http
POST /api/v1/candidates
Authorization: Bearer {token}
Content-Type: application/json

{
  "personalInfo": {
    "firstName": "Juan",
    "lastName": "Pérez",
    "email": "candidato@ejemplo.com",
    "phone": "+591 12345678",
    "dateOfBirth": "1990-01-01",
    "nationality": "Boliviana"
  },
  "academicInfo": {
    "currentLevel": "intermediate",
    "targetLevel": "B2",
    "previousExperience": "6 months"
  },
  "technicalSetup": {
    "hasHeadphones": true,
    "hasMicrophone": true,
    "hasWebcam": false
  }
}
```

#### Verificar Candidato
```http
PUT /api/v1/candidates/{id}/verify
Authorization: Bearer {token}
```

#### Historial de Exámenes
```http
GET /api/v1/candidates/{id}/exam-history
Authorization: Bearer {token}
```

#### Importar Candidatos (Excel/CSV)
```http
POST /api/v1/candidates/import
Authorization: Bearer {token}
Content-Type: multipart/form-data

file: [archivo.xlsx]
```

#### Exportar Candidatos
```http
GET /api/v1/candidates/export?format=excel
Authorization: Bearer {token}
```

### **Rutas de Roles** `/roles`

#### Listar Roles
```http
GET /api/v1/roles
Authorization: Bearer {token}
```

#### Crear Rol
```http
POST /api/v1/roles
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "examiner",
  "description": "Evaluador de exámenes",
  "permissions": ["exam.evaluate", "result.create"],
  "isActive": true
}
```

#### Actualizar Permisos de Rol
```http
PUT /api/v1/roles/{id}/permissions
Authorization: Bearer {token}
Content-Type: application/json

{
  "permissions": ["exam.create", "exam.manage", "student.view"]
}
```

### **Endpoints del Sistema**

#### Health Check
```http
GET /health
```

#### Información del Sistema
```http
GET /api/v1/system/info
Authorization: Bearer {token}
```

#### Métricas del Sistema
```http
GET /api/v1/system/metrics
Authorization: Bearer {token}
```

---

## 🔗 Integración Entre Servicios

### **1. Flujo de Registro Completo**
```mermaid
sequenceDiagram
    Client->>Auth Service: POST /auth/register
    Auth Service->>MongoDB: Crear usuario
    Auth Service->>Kafka: Publicar user.registered
    Kafka->>Notifications: Consumir evento
    Notifications->>Resend API: Enviar email bienvenida
    Auth Service->>Client: Respuesta con tokens
```

### **2. Comunicación via Kafka**

**Eventos Publicados:**
- `user.registered` - Nuevo usuario registrado
- `user.logged_in` - Usuario inició sesión
- `user.logged_out` - Usuario cerró sesión
- `otp.generated` - OTP generado
- `email.sent` - Email enviado

### **3. Autenticación Inter-Servicios**

User Management Service valida tokens JWT contra Auth Service:
```javascript
// Middleware de autenticación
Authorization: Bearer {jwt_token}

// Validación en user-management-service
const isValid = await authService.validateToken(token);
```

---

## 📊 Códigos de Respuesta

| Código | Significado | Uso |
|--------|-------------|-----|
| 200 | OK | Operación exitosa |
| 201 | Created | Recurso creado |
| 400 | Bad Request | Error en datos enviados |
| 401 | Unauthorized | Token inválido/expirado |
| 403 | Forbidden | Sin permisos |
| 404 | Not Found | Recurso no encontrado |
| 429 | Too Many Requests | Rate limit excedido |
| 500 | Internal Server Error | Error del servidor |

---

## 🔧 Configuración

### **Variables de Entorno Críticas**
```env
# Puertos
AUTH_SERVICE_PORT=3000
NOTIFICATION_SERVICE_PORT=3001
USER_MANAGEMENT_SERVICE_PORT=3002

# Base de Datos
MONGO_URI=mongodb://user:pass@mongo:27017
MONGO_DB_NAME=cba_platform

# Redis
REDIS_URI=redis://:password@redis:6379

# JWT
JWT_SECRET=tu_secreto_jwt
JWT_EXPIRATION=1h

# Email
RESEND_API_KEY=tu_api_key_resend

# Kafka
KAFKA_BROKER=kafka:29092
```

### **Comandos Docker**
```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f auth-service
docker-compose logs -f notifications-service
docker-compose logs -f user-management-service

# Reiniciar servicio específico
docker-compose restart auth-service
```

---

## 🧪 Testing Rápido

### **Flujo Básico de Prueba**
```bash
# 1. Registrar usuario
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","firstName":"Test","lastName":"User","role":"student"}'

# 2. Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# 3. Usar token para acceder a user-management
TOKEN="tu_token_aqui"
curl -X GET http://localhost:3002/api/v1/users \
  -H "Authorization: Bearer $TOKEN"
```

---

## ⚠️ Limitaciones y Rate Limits

| Endpoint | Límite | Ventana |
|----------|--------|---------|
| `/auth/login` | 10 intentos | 15 minutos |
| `/auth/otp/generate` | 5 intentos | 10 minutos |
| `/auth/otp/verify` | 10 intentos | 5 minutos |
| General API | 1000 requests | 15 minutos |

---

## 🔍 Logs y Debugging

### **Kafka UI** (Modo Debug)
```bash
# Activar Kafka UI
docker-compose --profile debug up

# Acceder a: http://localhost:8080
# Ver topics: user-events, otp-events, email-events
```

### **Health Checks**
- Auth Service: `http://localhost:3000/health`
- Notifications: `http://localhost:3001/health`
- User Management: `http://localhost:3002/health`