# Diccionario de Datos - User Management Service

## Colección: roles

**Descripción**: Define roles del sistema con sus permisos asociados para control de acceso granular.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | ObjectId | - | Sí | Identificador único del rol |
| name | String | - | Sí | Nombre del rol |
| description | String | - | Sí | Descripción detallada del rol |
| permissions | Array[Object] | - | Sí | Lista de permisos asignados al rol |
| permissions[].resource | String | - | Sí | Recurso del sistema al que aplica el permiso |
| permissions[].actions | Array[String] | - | Sí | Acciones permitidas en el recurso |
| isDefault | Boolean | - | Sí | Indica si es un rol predeterminado del sistema |
| createdAt | Date | - | Sí | Fecha de creación del rol |
| updatedAt | Date | - | Sí | Fecha de última actualización |

### Índices
- name (único)
- isDefault

### Valores de recursos válidos
- users: Gestión de usuarios
- candidates: Gestión de candidatos
- exams: Gestión de exámenes
- sessions: Gestión de sesiones
- reports: Acceso a reportes
- settings: Configuración del sistema
- roles: Gestión de roles
- questions: Gestión de preguntas
- results: Gestión de resultados

### Valores de acciones válidas
- create: Crear nuevos registros
- read: Leer/consultar información
- update: Actualizar registros existentes
- delete: Eliminar registros
- execute: Ejecutar procesos específicos
- manage: Gestión completa (incluye todas las acciones)

### Validaciones
- name: Mínimo 2 caracteres, sin caracteres especiales
- description: Mínimo 10 caracteres
- permissions[].resource: Debe ser un recurso válido del sistema
- permissions[].actions: Debe contener al menos una acción válida
