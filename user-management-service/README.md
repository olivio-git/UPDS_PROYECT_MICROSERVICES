# User Management Service - CBA Platform

## 📋 Descripción

Microservicio para la gestión de usuarios, candidatos y roles en la plataforma CBA. Incluye integración con auth-service para autenticación y Kafka para comunicación entre servicios.

## 🚀 Características

- ✅ CRUD completo de usuarios
- ✅ Gestión de candidatos a exámenes
- ✅ Sistema de roles y permisos
- ✅ Integración con auth-service
- ✅ Eventos Kafka para comunicación entre servicios
- ✅ Validación de datos con Zod
- ✅ Cache con Redis
- ✅ Rate limiting
- ✅ Logging estructurado
- ✅ Health checks

## 🛠️ Stack Tecnológico

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Base de Datos**: MongoDB
- **Cache**: Redis
- **Mensajería**: Kafka
- **Validación**: Zod
- **HTTP Client**: Axios
- **Contenedor**: Docker

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Compilar TypeScript
npm run build

# Ejecutar en desarrollo
npm run dev

# Ejecutar en producción
npm start
```

## ⚙️ Variables de Entorno

Copia `.env.template` a `.env` y configura:

```env
# Server
PORT=3002
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_DB_NAME=cba_platform_db

# Redis
REDIS_URI=redis://localhost:6379

# Kafka
KAFKA_BROKER=localhost:9092
KAFKA_CLIENT_ID=user-management-service

# Auth Service Integration
AUTH_SERVICE_URL=http://localhost:3000
AUTH_SERVICE_TOKEN=your-service-token

# Security
JWT_SECRET=your-jwt-secret-key

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

## 🔗 Endpoints Principales

### Health Checks
- `GET /health` - Health check básico
- `GET /api/v1/test/health` - Health check completo (Admin)

### Usuarios
- `GET /api/v1/users` - Listar usuarios
- `POST /api/v1/users` - Crear usuario
- `GET /api/v1/users/:id` - Obtener usuario
- `PUT /api/v1/users/:id` - Actualizar usuario
- `DELETE /api/v1/users/:id` - Eliminar usuario
- `PUT /api/v1/users/:id/change-password` - Cambiar contraseña

### Candidatos
- `GET /api/v1/candidates` - Listar candidatos
- `POST /api/v1/candidates` - Registrar candidato
- `GET /api/v1/candidates/:id` - Obtener candidato
- `PUT /api/v1/candidates/:id` - Actualizar candidato

### Testing (Solo Admin)
- `GET /api/v1/test/info` - Información del servicio
- `GET /api/v1/test/auth-service` - Test auth-service
- `GET /api/v1/test/kafka` - Test Kafka
- `POST /api/v1/test/user-flow` - Test flujo completo

## 🧪 Testing de Integración

### 1. Verificar Health del Sistema

```bash
# Health check básico
curl http://localhost:3002/health

# Health check completo (requiere token admin)
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://localhost:3002/api/v1/test/health
```

### 2. Test de Auth Service

```bash
# Test de conexión
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://localhost:3002/api/v1/test/auth-service

# Test de validación de usuario
curl -X POST \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}' \
     http://localhost:3002/api/v1/test/auth-service/validate-user
```

### 3. Test de Kafka

```bash
# Test de conexión Kafka
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://localhost:3002/api/v1/test/kafka

# Test de publicación de eventos
curl -X POST \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"eventType": "USER_CREATED", "testData": {"email": "test@example.com"}}' \
     http://localhost:3002/api/v1/test/kafka/publish
```

### 4. Test de Flujo Completo

```bash
# Test completo de creación de usuario
curl -X POST \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"testEmail": "integration-test@cba.com"}' \
     http://localhost:3002/api/v1/test/user-flow
```

## 📊 Monitoreo

### Logs
```bash
# Ver logs en desarrollo
npm run dev

# Ver logs de Docker
docker logs user-management-service -f
```

### Métricas
- `GET /api/v1/system/metrics` - Métricas del sistema
- `GET /api/v1/system/info` - Información del sistema

## 🔄 Eventos Kafka

### Topics Producidos
- `user-events` - Eventos de usuarios (CREATED, UPDATED, DELETED)
- `candidate-events` - Eventos de candidatos

### Topics Consumidos
- `auth-events` - Eventos del auth-service
- `notification-events` - Eventos de notificaciones
- `email-events` - Eventos de emails

### Estructura de Eventos

```json
{
  "eventType": "USER_CREATED",
  "userId": "userId",
  "userData": {
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "student"
  },
  "updatedBy": "adminUserId",
  "timestamp": "2025-07-26T10:00:00.000Z",
  "metadata": {
    "source": "user-management-service",
    "action": "create"
  }
}
```

## 🔐 Integración con Auth Service

### Flujo de Creación de Usuario

1. **Generar credenciales temporales**
2. **Crear usuario en auth-service**
3. **Crear usuario en user-management**
4. **Asignar permisos por defecto**
5. **Publicar evento USER_CREATED**

### Sincronización de Datos

- Los cambios de perfil se sincronizan automáticamente
- Las contraseñas se gestionan exclusivamente en auth-service
- Los roles y permisos se mantienen en ambos servicios

## 🐛 Troubleshooting

### Problemas Comunes

1. **Error de conexión con auth-service**
   ```bash
   # Verificar que auth-service esté corriendo
   curl http://localhost:3000/health
   
   # Verificar configuración
   curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
        http://localhost:3002/api/v1/test/auth-service
   ```

2. **Error de conexión con Kafka**
   ```bash
   # Verificar que Kafka esté corriendo
   docker ps | grep kafka
   
   # Verificar conexión
   curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
        http://localhost:3002/api/v1/test/kafka
   ```

3. **Error de base de datos**
   ```bash
   # Verificar MongoDB
   docker ps | grep mongo
   
   # Verificar conexión
   curl http://localhost:3002/health
   ```

### Logs Útiles

```bash
# Filtrar logs por servicio
docker logs user-management-service 2>&1 | grep "ERROR"

# Ver eventos Kafka
docker logs kafka -f | grep "user-events"

# Ver logs de auth-service integration
docker logs user-management-service 2>&1 | grep "auth-service"
```

## 🔧 Configuración Avanzada

### Permisos por Rol

```typescript
// Permisos por defecto según rol
const DEFAULT_PERMISSIONS = {
  admin: [
    { resource: 'users', actions: ['create', 'read', 'update', 'delete', 'manage'] },
    { resource: 'candidates', actions: ['create', 'read', 'update', 'delete', 'manage'] },
    { resource: 'roles', actions: ['create', 'read', 'update', 'delete', 'manage'] }
  ],
  teacher: [
    { resource: 'candidates', actions: ['create', 'read', 'update'] },
    { resource: 'exams', actions: ['create', 'read', 'update', 'execute'] }
  ],
  proctor: [
    { resource: 'sessions', actions: ['read', 'execute'] },
    { resource: 'candidates', actions: ['read'] }
  ],
  student: [
    { resource: 'exams', actions: ['read', 'execute'] }
  ]
};
```

### Configuración de Rate Limiting

```typescript
// Rate limiting por endpoint
const RATE_LIMITS = {
  '/api/v1/users': { windowMs: 15 * 60 * 1000, max: 100 }, // 100 requests per 15min
  '/api/v1/candidates': { windowMs: 15 * 60 * 1000, max: 200 },
  '/api/v1/test/*': { windowMs: 5 * 60 * 1000, max: 10 } // Testing endpoints
};
```

## 📈 Escalabilidad

### Horizontal Scaling

```yaml
# docker-compose.yml para múltiples instancias
version: '3.8'
services:
  user-management-1:
    build: .
    environment:
      - INSTANCE_ID=1
      - PORT=3002
    
  user-management-2:
    build: .
    environment:
      - INSTANCE_ID=2
      - PORT=3003
      
  nginx:
    image: nginx
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    ports:
      - "3002:80"
    depends_on:
      - user-management-1
      - user-management-2
```

### Load Balancing con Nginx

```nginx
upstream user_management {
    server user-management-1:3002;
    server user-management-2:3003;
}

server {
    listen 80;
    location / {
        proxy_pass http://user_management;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔄 CI/CD Pipeline

### GitHub Actions

```yaml
name: User Management Service CI/CD

on:
  push:
    branches: [ main, develop ]
    paths: [ 'user-management-service/**' ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: |
          cd user-management-service
          npm ci
          
      - name: Run tests
        run: |
          cd user-management-service
          npm test
          
      - name: Build
        run: |
          cd user-management-service
          npm run build
          
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy to production
        run: echo "Deploy user-management-service"
```

## 📚 Recursos Adicionales

### Enlaces Útiles
- [Documentación de Kafka](https://kafka.apache.org/documentation/)
- [MongoDB Best Practices](https://docs.mongodb.com/manual/administration/production/)
- [Redis Documentation](https://redis.io/documentation)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)

### Arquitectura de Microservicios
- [Microservices Patterns](https://microservices.io/patterns/)
- [Event-Driven Architecture](https://martinfowler.com/articles/201701-event-driven.html)
- [API Gateway Pattern](https://microservices.io/patterns/apigateway.html)

## 🤝 Contribución

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit tus cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.
