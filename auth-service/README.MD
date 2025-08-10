# 📋 Guía Completa de Testing - CBA Platform

## 🚀 **Configuración Inicial**

### **1. Verificar Servicios**
```bash
# Verificar que todos los servicios estén corriendo
docker-compose ps

# Ver logs de servicios específicos
docker-compose logs auth-service -f
docker-compose logs notifications-service -f
```

### **2. Health Checks**
```bash
# Auth Service
curl http://localhost:3000/health

# Notifications Service  
curl http://localhost:3001/health
```

---

## 🔐 **AUTH SERVICE - Testing Completo**

### **📝 1. Registro de Usuario**

**POST** `http://localhost:3000/auth/register`

```json
{
  "email": "juan.perez@cba.com",
  "password": "MiPassword123",
  "firstName": "Juan",
  "lastName": "Pérez",
  "role": "student"
}
```

**Respuesta Esperada:**
```json
{
  "success": true,
  "message": "Usuario registrado exitosamente",
  "data": {
    "user": {
      "_id": "...",
      "email": "juan.perez@cba.com",
      "firstName": "Juan",
      "lastName": "Pérez",
      "role": "student",
      "isActive": true,
      "permissions": ["exam.take", "result.view"]
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "1h"
  }
}
```

### **🔑 2. Login de Usuario**

**POST** `http://localhost:3000/auth/login`

```json
{
  "email": "juan.perez@cba.com",
  "password": "MiPassword123"
}
```

**Respuesta Esperada:**
```json
{
  "success": true,
  "message": "Inicio de sesión exitoso",
  "data": {
    "user": { /* datos del usuario */ },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": "1h"
  }
}
```

### **🔄 3. Refresh Token**

**POST** `http://localhost:3000/auth/refresh`

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### **👤 4. Obtener Perfil (Requiere Token)**

**GET** `http://localhost:3000/auth/profile`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### **🔓 5. Logout**

**POST** `http://localhost:3000/auth/logout`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### **🔓 6. Logout All Sessions**

**POST** `http://localhost:3000/auth/logout-all`

**Headers:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

---

## 📱 **OTP SERVICE - Testing Completo**

### **📤 1. Generar OTP**

**POST** `http://localhost:3000/auth/otp/generate`

```json
{
  "email": "juan.perez@cba.com",
  "purpose": "login"
}
```

**Propósitos disponibles:**
- `"login"` - Inicio de sesión
- `"password_reset"` - Restablecimiento de contraseña
- `"email_verification"` - Verificación de email

**Respuesta Esperada:**
```json
{
  "success": true,
  "message": "Código OTP enviado exitosamente",
  "data": {
    "expiresIn": 600,
    "purpose": "login"
  }
}
```

### **✅ 2. Verificar OTP**

**POST** `http://localhost:3000/auth/otp/verify`

```json
{
  "email": "juan.perez@cba.com",
  "code": "123456",
  "purpose": "login"
}
```

**Respuesta Esperada (Correcto):**
```json
{
  "success": true,
  "message": "Código OTP verificado exitosamente",
  "data": {
    "verified": true,
    "purpose": "login"
  }
}
```

**Respuesta (Código Incorrecto):**
```json
{
  "success": false,
  "message": "Código incorrecto. Intentos restantes: 2"
}
```

### **📊 3. Estado del OTP**

**GET** `http://localhost:3000/auth/otp/status?email=juan.perez@cba.com&purpose=login`

**Respuesta Esperada:**
```json
{
  "success": true,
  "message": "Status de OTP obtenido",
  "data": {
    "exists": true,
    "expiresAt": "2025-07-21T18:15:00.000Z",
    "attemptsRemaining": 3
  }
}
```

### **🗑️ 4. Revocar OTP**

**DELETE** `http://localhost:3000/auth/otp/revoke`

```json
{
  "email": "juan.perez@cba.com",
  "purpose": "login"
}
```

---

## 📧 **NOTIFICATIONS SERVICE - Testing**

### **📤 1. Enviar Email de Prueba**

**POST** `http://localhost:3001/notifications/send-test`

**Email de Bienvenida:**
```json
{
  "to": "juan.perez@cba.com",
  "type": "welcome",
  "data": {
    "firstName": "Juan",
    "lastName": "Pérez"
  }
}
```

**Email OTP:**
```json
{
  "to": "juan.perez@cba.com",
  "type": "otp",
  "data": {
    "code": "123456",
    "purpose": "verificación de cuenta",
    "expiryMinutes": 10
  }
}
```

**Email Reset Password:**
```json
{
  "to": "juan.perez@cba.com",
  "type": "password_reset",
  "data": {
    "resetToken": "abc123token",
    "firstName": "Juan"
  }
}
```

### **📊 2. Estadísticas de Emails**

**GET** `http://localhost:3001/notifications/stats`

**Respuesta Esperada:**
```json
{
  "success": true,
  "message": "Estadísticas obtenidas exitosamente",
  "data": {
    "total": 15,
    "sent": 12,
    "pending": 2,
    "failed": 1,
    "today": 5,
    "successRate": "80.00",
    "recentFailures": [],
    "lastUpdated": "2025-07-21T17:30:00.000Z"
  }
}
```

### **📜 3. Historial de Emails**

**GET** `http://localhost:3001/notifications/history?email=juan.perez@cba.com&limit=10`

### **🔄 4. Procesar Cola de Emails**

**POST** `http://localhost:3001/notifications/process-queue`

### **♻️ 5. Reintentar Emails Fallidos**

**POST** `http://localhost:3001/notifications/retry-failed`

---

## 🧪 **Flujos de Testing Completos**

### **🔄 Flujo 1: Registro Completo con Email**

```bash
# 1. Registrar usuario
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria.rodriguez@cba.com",
    "password": "Password123",
    "firstName": "María",
    "lastName": "Rodríguez",
    "role": "student"
  }'

# 2. Verificar que se envió email de bienvenida
curl http://localhost:3001/notifications/history?email=maria.rodriguez@cba.com

# 3. Login con el usuario
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria.rodriguez@cba.com",
    "password": "Password123"
  }'
```

### **📱 Flujo 2: Proceso OTP Completo**

```bash
# 1. Generar OTP
curl -X POST http://localhost:3000/auth/otp/generate \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria.rodriguez@cba.com",
    "purpose": "email_verification"
  }'

# 2. Verificar estado del OTP
curl "http://localhost:3000/auth/otp/status?email=maria.rodriguez@cba.com&purpose=email_verification"

# 3. Verificar OTP (usa el código del email recibido)
curl -X POST http://localhost:3000/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria.rodriguez@cba.com",
    "code": "123456",
    "purpose": "email_verification"
  }'
```

### **🔐 Flujo 3: Autenticación con Token**

```bash
# 1. Login y obtener token
RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "maria.rodriguez@cba.com",
    "password": "Password123"
  }')

# 2. Extraer token (manual desde la respuesta)
TOKEN="eyJhbGciOiJIUzI1NiIs..."

# 3. Acceder a perfil protegido
curl -X GET http://localhost:3000/auth/profile \
  -H "Authorization: Bearer $TOKEN"

# 4. Validar token
curl -X GET http://localhost:3000/auth/validate \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🚫 **Testing de Rate Limiting**

### **Probar Límites de OTP**
```bash
# Generar múltiples OTP rápidamente para activar rate limiting
for i in {1..5}; do
  curl -X POST http://localhost:3000/auth/otp/generate \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test.rate@cba.com",
      "purpose": "login"
    }'
  echo "Intento $i"
done
```

### **Probar Límites de Login**
```bash
# Múltiples intentos de login para activar rate limiting
for i in {1..12}; do
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test.rate@cba.com",
      "password": "wrongpassword"
    }'
  echo "Intento $i"
done
```

---

## 🐞 **Testing de Errores**

### **Casos de Error Esperados**

1. **Email duplicado en registro:**
```json
{
  "success": false,
  "message": "El usuario ya existe con este email"
}
```

2. **Credenciales incorrectas:**
```json
{
  "success": false,
  "message": "Credenciales inválidas"
}
```

3. **Token expirado:**
```json
{
  "success": false,
  "message": "Token inválido o expirado"
}
```

4. **OTP incorrecto:**
```json
{
  "success": false,
  "message": "Código incorrecto. Intentos restantes: 2"
}
```

5. **Rate limit excedido:**
```json
{
  "success": false,
  "message": "Demasiadas solicitudes"
}
```

---

## 📊 **Monitoreo y Logs**

### **Ver Logs en Tiempo Real**
```bash
# Auth service logs
docker-compose logs auth-service -f

# Notifications service logs
docker-compose logs notifications-service -f

# Kafka logs (para eventos)
docker-compose logs kafka -f

# Todos los logs
docker-compose logs -f
```

### **Kafka UI (Debug Mode)**
```bash
# Iniciar con Kafka UI
docker-compose --profile debug up

# Acceder a: http://localhost:8080
# Ver topics: user-events, otp-events, email-events
```

---

## ✅ **Checklist de Testing**

- [ ] ✅ Auth service health check
- [ ] ✅ Notifications service health check
- [ ] ✅ Registro de usuario exitoso
- [ ] ✅ Email de bienvenida recibido
- [ ] ✅ Login exitoso con JWT
- [ ] ✅ Acceso a endpoint protegido
- [ ] ✅ Generación de OTP
- [ ] ✅ Email de OTP recibido
- [ ] ✅ Verificación de OTP exitosa
- [ ] ✅ Rate limiting funcionando
- [ ] ✅ Refresh token funcionando
- [ ] ✅ Logout exitoso
- [ ] ✅ Eventos Kafka publicándose
- [ ] ✅ Estadísticas de emails
- [ ] ✅ Manejo de errores

**¡Con esta guía puedes probar completamente todos los microservicios implementados!** 🎉