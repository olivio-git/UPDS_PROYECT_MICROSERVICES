# Diccionario de Datos - Auth Service

## Colección: users

**Descripción**: Almacena la información básica de usuarios del sistema para autenticación y autorización.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | String | - | Sí | Identificador único del usuario |
| email | String | - | Sí | Dirección de correo electrónico del usuario (único) |
| password | String | - | Sí | Contraseña encriptada del usuario |
| firstName | String | - | Sí | Nombre del usuario |
| lastName | String | - | Sí | Apellido del usuario |
| role | String | - | Sí | Rol del usuario (admin, teacher, proctor, student) |
| isActive | Boolean | - | Sí | Estado de activación del usuario |
| permissions | Array[String] | - | Sí | Lista de permisos asignados al usuario |
| profile.avatar | String | - | No | URL del avatar del usuario |
| profile.phone | String | - | No | Número de teléfono del usuario |
| profile.address | String | - | No | Dirección física del usuario |
| teacherData.specialization | Array[String] | - | No | Especializaciones del profesor |
| teacherData.experience | Number | - | No | Años de experiencia del profesor |
| proctorData.certifications | Array[String] | - | No | Certificaciones del supervisor |
| proctorData.availableHours | Array[String] | - | No | Horarios disponibles del supervisor |
| createdAt | Date | - | Sí | Fecha de creación del registro |
| updatedAt | Date | - | Sí | Fecha de última actualización |
| lastLogin | Date | - | No | Fecha del último acceso del usuario |

### Índices
- email (único)
- role
- isActive

### Validaciones
- email: Formato de email válido
- password: Mínimo 6 caracteres
- firstName: Mínimo 2 caracteres
- lastName: Mínimo 2 caracteres
- role: Valores permitidos (admin, teacher, proctor, student)
