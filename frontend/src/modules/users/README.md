# Módulo de Gestión de Usuarios

Este módulo proporciona una interfaz completa para la gestión de usuarios en el sistema CBA, incluyendo funcionalidades CRUD, filtros avanzados, paginación y acciones específicas por rol.

## 📁 Estructura

```
src/modules/users/
├── components/           # Componentes reutilizables
│   ├── UserTable.tsx    # Tabla principal con CustomizableTable
│   ├── UserTableHeader.tsx # Header con filtros y acciones
│   ├── UserForm.tsx     # Formulario para crear/editar usuarios
│   ├── Pagination.tsx   # Componente de paginación
│   └── index.ts         # Exportaciones
├── hooks/
│   └── useUsers.ts      # Hook principal para lógica de usuarios
├── services/
│   └── userService.ts   # Servicio API con autenticación
├── types/
│   └── user.types.ts    # Tipos TypeScript
├── screens/
│   └── UserScreen.tsx   # Pantalla principal
└── index.ts             # Exportaciones del módulo
```

## 🚀 Características Principales

### ✅ Gestión Completa de Usuarios
- **CRUD completo**: Crear, leer, actualizar y eliminar usuarios
- **Roles dinámicos**: Admin, Teacher, Proctor, Student
- **Estados de usuario**: Active, Inactive, Suspended, Pending
- **Validación de formularios**: Validación tanto frontend como backend

### ✅ Interfaz de Usuario Avanzada
- **Tabla personalizable**: Usando `CustomizableTable` con sorting y selección
- **Filtros dinámicos**: Por rol, estado, búsqueda de texto
- **Paginación avanzada**: Con controles completos de navegación
- **Selección múltiple**: Para acciones en lote

### ✅ Funcionalidades Específicas por Rol
- **Teachers**: Departamento, especializaciones, experiencia
- **Proctors**: Nivel de certificación, idiomas, sesiones simultáneas
- **Students**: Información básica y perfil
- **Admins**: Acceso completo a todas las funciones

### ✅ Acciones Específicas
- **Activar/Desactivar** usuarios
- **Generar contraseñas temporales**
- **Asignar roles** (pendiente de implementar)
- **Enviar emails** (pendiente de implementar)
- **Exportar/Importar** datos (pendiente de implementar)

### ✅ Autenticación y Seguridad
- **JWT tokens**: Gestión automática con renovación
- **Permisos por rol**: Validación en frontend y backend
- **Headers seguros**: Autenticación en todas las peticiones

## 🛠️ Uso del Módulo

### Importar la pantalla principal
```typescript
import { UsersScreen } from '@/modules/users';

// En tu router
<Route path="/users" element={<UsersScreen />} />
```

### Usar componentes individuales
```typescript
import { 
  UserTable, 
  UserForm, 
  useUsers 
} from '@/modules/users';

function CustomUserComponent() {
  const {
    users,
    isLoading,
    createUser,
    updateUser,
    deleteUser
  } = useUsers();

  return (
    <UserTable
      users={users}
      isLoading={isLoading}
      onEditUser={handleEdit}
      onDeleteUser={handleDelete}
      // ... más props
    />
  );
}
```

### Hook `useUsers`
```typescript
const {
  // Estado de datos
  users,
  totalUsers,
  pagination,
  
  // Estado de UI
  isLoading,
  isFetching,
  isError,
  
  // Filtros
  filters,
  setFilters,
  
  // Selección múltiple
  selectedUsers,
  selectUser,
  selectAllUsers,
  clearSelection,
  
  // Acciones CRUD
  createUser,
  updateUser,
  deleteUser,
  deleteSelectedUsers,
  
  // Acciones específicas
  activateUser,
  deactivateUser,
  generateTemporaryPassword,
  
  // Utilidades
  refreshUsers,
  getUserById,
  resetState
} = useUsers();
```

## 🎨 Estilos y Temas

El módulo utiliza:
- **Tailwind CSS** para estilos base
- **Shadcn/ui** para componentes UI
- **Esquema de colores consistente**:
  - Azul para acciones principales
  - Verde para éxito/activación
  - Rojo para eliminación/errores
  - Naranja para warnings/desactivación
  - Gris para estados neutros

## 📡 API Integration

### Endpoints utilizados
```typescript
// Usuarios
GET    /api/v1/users              # Listar con filtros
GET    /api/v1/users/:id          # Obtener por ID
POST   /api/v1/users              # Crear usuario
PUT    /api/v1/users/:id          # Actualizar usuario
DELETE /api/v1/users/:id          # Eliminar usuario

// Acciones específicas
PUT    /api/v1/users/:id/activate           # Activar
PUT    /api/v1/users/:id/deactivate         # Desactivar
POST   /api/v1/users/:id/generate-password  # Contraseña temporal
PUT    /api/v1/users/:id/assign-role        # Asignar rol
```

### Autenticación
- Utiliza `authSDK.getAccessToken()` para tokens
- Renovación automática de tokens expirados
- Manejo de errores 401 con reautenticación

## 🔧 Configuración

### Variables de entorno
```env
VITE_USER_MANAGEMENT_URL=http://localhost:3002
```

### Dependencias requeridas
- `@tanstack/react-table` - Para la tabla
- `sonner` - Para notificaciones
- `date-fns` - Para formateo de fechas
- `lucide-react` - Para iconos

## 🚧 Funcionalidades Pendientes

- [ ] **Asignación de roles**: Modal para cambiar roles de usuario
- [ ] **Envío de emails**: Integración con servicio de notificaciones
- [ ] **Exportación**: CSV/Excel de usuarios filtrados
- [ ] **Importación**: Carga masiva desde archivos
- [ ] **Vista de detalles**: Modal/página para ver información completa
- [ ] **Historial de cambios**: Auditoría de modificaciones
- [ ] **Permisos granulares**: Gestión específica de permisos

## 🎯 Ejemplos de Uso

### Filtrar usuarios por rol
```typescript
setFilters({
  ...filters,
  role: 'teacher',
  page: 1
});
```

### Crear usuario teacher
```typescript
const teacherData = {
  email: 'profesor@cba.com',
  firstName: 'Carlos',
  lastName: 'González',
  role: 'teacher',
  teacherData: {
    department: 'Inglés General',
    specialization: ['Grammar', 'Conversation'],
    experience: 5,
    certifications: [],
    schedule: []
  }
};

await createUser(teacherData);
```

### Acciones en lote
```typescript
// Seleccionar múltiples usuarios
selectAllUsers(['user1', 'user2', 'user3']);

// Eliminar seleccionados
await deleteSelectedUsers();
```

## 📱 Responsive Design

- **Mobile-first**: Diseño adaptativo desde móviles
- **Breakpoints**: sm, md, lg para diferentes tamaños
- **Tabla responsive**: Scroll horizontal en pantallas pequeñas
- **Filtros colapsables**: Panel expandible en móviles

## 🔍 Testing

Para probar el módulo:

1. **Verificar servicios backend**:
   ```bash
   curl http://localhost:3002/health
   ```

2. **Probar autenticación**:
   - Asegúrate de estar logueado
   - Verifica que el token sea válido

3. **Datos de prueba**:
   - Usa el script de migración para datos iniciales
   - Crea usuarios de diferentes roles para testing

## 🤝 Contribución

Al trabajar en este módulo:

1. **Mantén la consistencia** con los tipos TypeScript
2. **Usa el hook `useUsers`** para toda la lógica de estado
3. **Sigue los patrones** de los componentes existentes
4. **Prueba todas las funcionalidades** antes de hacer commit
5. **Documenta cambios importantes** en este README

---

**Autor**: Olivio Subelza Cabezas  
**Fecha**: Agosto 2025  
**Versión**: 1.0.0
