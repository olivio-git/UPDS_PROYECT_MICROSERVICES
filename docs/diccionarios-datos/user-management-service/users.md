# Diccionario de Datos - User Management Service

## Colección: users

**Descripción**: Gestiona información detallada de usuarios con perfiles completos, preferencias y datos específicos por rol.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | ObjectId | - | Sí | Identificador único del usuario |
| email | String | - | Sí | Dirección de correo electrónico única |
| firstName | String | - | Sí | Nombre del usuario |
| lastName | String | - | Sí | Apellido del usuario |
| role | String | - | Sí | Rol del usuario (admin, teacher, proctor, student) |
| status | String | - | Sí | Estado del usuario (active, inactive, suspended, pending) |
| profile.avatar | String | - | No | URL del avatar del usuario |
| profile.phone | String | - | No | Número de teléfono |
| profile.address | String | - | No | Dirección física |
| profile.dateOfBirth | Date | - | No | Fecha de nacimiento |
| profile.nationality | String | - | No | Nacionalidad del usuario |
| profile.bio | String | - | No | Biografía del usuario |
| profile.preferences.language | String | - | No | Idioma preferido (es, en) |
| profile.preferences.timezone | String | - | No | Zona horaria |
| profile.preferences.notifications.email | Boolean | - | No | Recibir notificaciones por email |
| profile.preferences.notifications.push | Boolean | - | No | Recibir notificaciones push |
| profile.preferences.notifications.sms | Boolean | - | No | Recibir notificaciones SMS |
| permissions | Array[Object] | - | Sí | Lista de permisos con recursos y acciones |
| permissions[].resource | String | - | Sí | Recurso del sistema |
| permissions[].actions | Array[String] | - | Sí | Acciones permitidas en el recurso |
| teacherData.department | String | - | No | Departamento del profesor |
| teacherData.specialization | Array[String] | - | No | Especializaciones del profesor |
| teacherData.experience | Number | - | No | Años de experiencia |
| teacherData.certifications | Array[Object] | - | No | Certificaciones obtenidas |
| teacherData.schedule | Array[Object] | - | No | Horario de trabajo |
| proctorData.availableHours | Array[Object] | - | No | Horarios disponibles |
| proctorData.certificationLevel | String | - | No | Nivel de certificación |
| proctorData.languages | Array[String] | - | No | Idiomas que maneja |
| proctorData.maxSimultaneousSessions | Number | - | No | Máximo de sesiones simultáneas |
| authServiceUserId | String | - | No | ID del usuario en auth-service |
| lastSync | Date | - | No | Última sincronización con auth-service |
| createdBy | String | - | No | Usuario que creó este registro |
| createdAt | Date | - | Sí | Fecha de creación |
| updatedAt | Date | - | Sí | Fecha de última actualización |
| lastLogin | Date | - | No | Último acceso del usuario |

### Índices
- email (único)
- role
- status
- authServiceUserId

### Validaciones
- email: Formato de email válido
- firstName: Mínimo 2 caracteres
- lastName: Mínimo 2 caracteres
- role: Valores permitidos (admin, teacher, proctor, student)
- status: Valores permitidos (active, inactive, suspended, pending)
- profile.preferences.language: Valores permitidos (es, en)
