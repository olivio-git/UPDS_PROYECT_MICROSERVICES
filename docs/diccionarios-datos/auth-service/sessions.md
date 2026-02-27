# Diccionario de Datos - Auth Service

## Colección: sessions

**Descripción**: Gestiona las sesiones activas de usuario y tokens de refresco para el sistema de autenticación.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | String | - | Sí | Identificador único de la sesión |
| userId | String | - | Sí | Identificador del usuario propietario de la sesión |
| refreshToken | String | - | Sí | Token de refresco para renovar tokens de acceso |
| userAgent | String | - | No | Información del navegador/dispositivo del usuario |
| ipAddress | String | - | No | Dirección IP desde donde se inició la sesión |
| expiresAt | Date | - | Sí | Fecha de expiración de la sesión |
| createdAt | Date | - | Sí | Fecha de creación de la sesión |

### Índices
- userId
- refreshToken (único)
- expiresAt (con TTL para expiración automática)

### Validaciones
- refreshToken: Único en la colección
- expiresAt: Debe ser fecha futura
- userId: Debe corresponder a un usuario existente
