# CBA Platform - Frontend

Frontend de la plataforma CBA desarrollado con React + TypeScript + Vite.

## 🚀 Características

- **Autenticación OTP-First**: Verificación de email ANTES de login/registro
- **Flujos duales**: OTP-first (producción) y directo (testing)
- **Gestión de roles**: Admin, Teacher, Proctor, Student
- **UI moderna**: React + Tailwind CSS + shadcn/ui
- **State management**: Zustand
- **Routing**: React Router v7
- **Notificaciones**: Sonner (toast notifications)
- **SDK de autenticación**: sdk-simple-auth integrado
- **Panel de testing**: Para probar servicios backend

## 📋 Requisitos Previos

- Node.js 18+
- npm o yarn
- Servicios backend corriendo (auth-service y notifications-service)

## 🛠️ Instalación

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Configurar las URLs de los servicios en .env
VITE_AUTH_SERVICE_URL=http://localhost:3000
VITE_NOTIFICATION_SERVICE_URL=http://localhost:3001
```

## 🚀 Desarrollo

```bash
# Iniciar servidor de desarrollo
npm run dev

# El frontend estará disponible en http://localhost:5173
```

## 🔐 **NUEVO: Sistema de Autenticación OTP-First**

### **🌟 Flujo Principal: OTP-First (Recomendado)**

#### **Registro con OTP-First:**
```
1. Usuario completa formulario →
2. Sistema genera OTP para email_verification →
3. Email enviado vía notifications-service →
4. Usuario verifica OTP en /otp-verification →
5. RECIÉN ENTONCES se ejecuta POST /auth/register →
6. Redirect automático al dashboard
```

#### **Login con OTP-First:**
```
1. Usuario ingresa email/password →
2. Sistema genera OTP para login →
3. Email enviado vía notifications-service →
4. Usuario verifica OTP en /otp-verification →
5. RECIÉN ENTONCES se ejecuta POST /auth/login →
6. Redirect automático al dashboard
```

### **⚡ Flujo Alternativo: Directo (Solo Testing)**

Para testing y casos especiales, también están disponibles los métodos directos:
- `directLogin()` - Login inmediato sin OTP
- `directRegister()` - Registro inmediato sin OTP

### **🎯 Ventajas del Flujo OTP-First**

- ✅ **Seguridad mejorada**: Verificación de email antes de cualquier acción
- ✅ **Prevención de spam**: Solo emails válidos pueden registrarse
- ✅ **Autenticación robusta**: Doble verificación (credenciales + email)
- ✅ **Experiencia consistente**: Mismo flujo para login y registro
- ✅ **Trazabilidad completa**: Todos los emails son verificados

## 🏗️ Arquitectura

```
src/
├── components/         # Componentes UI reutilizables (shadcn/ui)
│   └── atoms/         # Componentes atómicos
├── hooks/             # Custom hooks
│   └── useAuth.ts     # Hook de autenticación (OTP-first + directo)
├── modules/           # Módulos de la aplicación
│   ├── auth/          # Módulo de autenticación
│   │   ├── screens/   # Pantallas de auth (LoginScreen, OtpVerificator)
│   │   └── services/  # Servicios y store de auth (Zustand)
│   ├── dashboard/     # Dashboard principal
│   └── testing/       # Panel de testing (solo admin)
├── navigation/        # Sistema de rutas
├── services/          # Servicios generales
│   ├── notifications/ # Servicio de notificaciones
│   └── sdk-simple-auth.ts # Configuración del SDK
└── lib/              # Utilidades
```

## 📱 **Flujos de Autenticación Implementados**

### **🔄 AuthStore (Zustand) - Métodos Principales**

```typescript
// Flujo OTP-First (Recomendado)
const authStore = useAuthStore();

// Iniciar login con OTP
await authStore.initiateLogin(email, password);
// → Genera OTP y redirige a /otp-verification

// Iniciar registro con OTP  
await authStore.initiateRegister(userData);
// → Genera OTP y redirige a /otp-verification

// Verificar OTP y completar acción
await authStore.verifyOTP(code);
// → Completa automáticamente login/registro pendiente

// Métodos directos (testing)
await authStore.directLogin(email, password);
await authStore.directRegister(userData);
```

### **🎣 Hook useAuth - Interface Simplificada**

```typescript
const {
  // Flujos OTP-First
  loginWithOTPFirst,
  registerWithOTPFirst,
  
  // Flujos directos
  directLogin,
  directRegister,
  
  // Gestión OTP
  verifyOTPCode,
  generateOTPManual,
  
  // Estado
  isInOTPFlow,
  getPendingActionInfo,
  getOTPAttemptsRemaining,
  
  // Permisos
  hasPermission,
  isAdmin,
  
} = useAuth();
```

### **📱 Componentes Principales**

#### **LoginScreen**
- ✅ Formulario único para login y registro
- ✅ Validación de campos
- ✅ Integración automática con flujo OTP-first
- ✅ Feedback visual sobre el proceso
- ✅ Redirección automática a OTP verification

#### **OtpVerificator**  
- ✅ Verificación de códigos OTP
- ✅ Temporizador de expiración
- ✅ Reenvío de códigos
- ✅ Manejo de acciones pendientes (login/register)
- ✅ Redirección automática tras completar acción
- ✅ Feedback contextual según el propósito

#### **TestingScreen (Solo Admin)**
- ✅ Testing de ambos flujos (OTP-first y directo)
- ✅ Generación manual de OTP
- ✅ Health checks de servicios
- ✅ Envío de emails de prueba
- ✅ Estadísticas en tiempo real

## 🧪 **Panel de Testing Mejorado**

### **🔬 Funcionalidades de Testing**

El panel incluye testing completo para ambos flujos:

#### **Flujos OTP-First**
```bash
# Testing del flujo completo OTP-first
1. Ir a /testing (como admin)
2. Completar datos de prueba
3. Hacer clic en "Test Register OTP-First"
4. Revisar email recibido
5. Completar verificación en /otp-verification
6. Verificar registro exitoso
```

#### **Flujos Directos**
```bash
# Testing de bypass OTP (solo para desarrollo)
1. Ir a /testing (como admin)  
2. Completar datos de prueba
3. Hacer clic en "Test Register Directo"
4. Verificar registro inmediato sin OTP
```

### **📊 Monitoreo y Debug**

- **Health Checks**: Verificar conectividad con servicios
- **Estadísticas de Email**: Métricas en tiempo real
- **Historial de Emails**: Últimos emails enviados
- **Testing de OTP Manual**: Generar/verificar códigos independientemente

## 🔧 Configuración

### Variables de Entorno

```bash
# URLs de servicios backend
VITE_AUTH_SERVICE_URL=http://localhost:3000
VITE_NOTIFICATION_SERVICE_URL=http://localhost:3001

# Configuración de la app
VITE_APP_NAME=CBA Platform
VITE_APP_VERSION=1.0.0
VITE_DEBUG_MODE=true
```

### AuthStore Configuration

```typescript
// Estado OTP expandido
interface OTPState {
  isOTPRequired: boolean;
  otpEmail: string;
  otpPurpose: 'login' | 'password_reset' | 'email_verification';
  otpExpiresAt?: Date;
  attemptsRemaining: number;
  // NUEVO: Manejo de acciones pendientes
  pendingAction: 'login' | 'register' | null;
  pendingData: any;
}
```

## 🚦 **Testing y Flujos de Prueba**

### **🧪 Flujo Completo de Testing**

#### **1. Verificar servicios backend**
```bash
# En el directorio raíz
docker-compose ps
docker-compose logs auth-service -f
docker-compose logs notifications-service -f
```

#### **2. Iniciar frontend**
```bash
cd frontend
npm run dev
# Frontend en http://localhost:5173
```

#### **3. Probar flujo OTP-First de registro**
```bash
# 1. Ir a http://localhost:5173
# 2. Hacer clic en "¿No tienes cuenta? Regístrate"
# 3. Completar formulario (usar email real)
# 4. Click en "Registrarse con Verificación"
# 5. Verificar que aparece: "📧 Te hemos enviado un código de verificación"
# 6. Revisar email recibido
# 7. Ser redirigido automáticamente a /otp-verification
# 8. Ingresar código de 6 dígitos
# 9. Click en "Verificar y Completar Registro"
# 10. Verificar redirección automática al dashboard
```

#### **4. Probar flujo OTP-First de login**
```bash
# 1. Usar credenciales del usuario registrado
# 2. Click en "Continuar con Verificación"
# 3. Verificar envío de OTP para login
# 4. Completar verificación OTP
# 5. Verificar acceso al dashboard
```

#### **5. Testing avanzado (panel admin)**
```bash
# 1. Registrar usuario con rol "admin"
# 2. Ir a /testing
# 3. Probar "Test Register OTP-First"
# 4. Probar "Test Login OTP-First"  
# 5. Comparar con flujos directos
# 6. Verificar estadísticas de emails
```

## 📈 **Métricas y Monitoreo**

### **Dashboard de Estadísticas**
- Total de emails enviados
- Tasa de éxito de OTP
- Tiempo promedio de verificación
- Intentos fallidos por usuario

### **Logs de Debugging**
```bash
# Ver logs del navegador
# 1. F12 → Console
# 2. Buscar logs de authStore
# 3. Verificar flujo de estados OTP

# Ver logs de backend
docker-compose logs auth-service | grep OTP
docker-compose logs notifications-service | grep email
```

## 🎯 **Decisiones de Diseño**

### **¿Por qué OTP-First?**

1. **Seguridad**: Garantiza que todos los usuarios tienen emails válidos
2. **Consistencia**: Mismo flujo para login y registro  
3. **Prevención**: Evita cuentas spam o emails inválidos
4. **Trazabilidad**: Todos los accesos están verificados
5. **Experiencia**: Proceso claro y predecible para el usuario

### **¿Cuándo usar flujo directo?**

- ✅ Testing y desarrollo
- ✅ Migración de datos existentes
- ✅ Casos de emergencia (configuración admin)
- ❌ NO para usuarios finales en producción

## 🔄 **Estados del Flujo OTP**

### **Flujo de Estados**
```
IDLE → GENERATING_OTP → OTP_SENT → VERIFYING_OTP → COMPLETING_ACTION → AUTHENTICATED
```

### **Manejo de Errores**
```typescript
// Errores comunes y manejo
- "Email no válido" → Validación en frontend
- "OTP expirado" → Opción de reenvío automático  
- "Código incorrecto" → Contador de intentos
- "Demasiados intentos" → Bloqueo temporal
- "Error de conexión" → Retry automático
```

## 🚀 **Próximos Pasos**

### **Funcionalidades Pendientes**
- [ ] Reset password con OTP
- [ ] Cambio de email con OTP
- [ ] 2FA opcional adicional
- [ ] Gestión de sesiones múltiples
- [ ] Notificaciones push

### **Mejoras del Flujo OTP**
- [ ] Códigos QR para verificación rápida
- [ ] Integración con apps de autenticación
- [ ] Verificación por SMS como backup
- [ ] Analíticas de patrones de acceso

## 📞 **Soporte y Troubleshooting**

### **Problemas Comunes**

**Email de OTP no llega:**
1. Verificar configuración RESEND_API_KEY
2. Revisar logs del notifications-service
3. Comprobar spam/promociones
4. Usar el panel de testing para envío manual

**Error al verificar OTP:**
1. Verificar que el código no haya expirado
2. Comprobar intentos restantes
3. Revisar logs de auth-service
4. Usar testing manual en panel admin

**Redirección no funciona:**
1. Verificar estados en React DevTools
2. Comprobar localStorage/IndexedDB
3. Revisar configuración de rutas
4. Limpiar cache del navegador

---

**¡El frontend está completamente listo con el nuevo flujo OTP-First implementado!** 

Todos los servicios están integrados y funcionando según el flujo deseado donde la verificación OTP ocurre ANTES del login/registro real.