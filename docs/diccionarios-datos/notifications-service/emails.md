# Diccionario de Datos - Notifications Service

## Colección: emails

**Descripción**: Gestiona las notificaciones por email que se envían desde el sistema.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | String | - | Sí | Identificador único del email |
| to | String | - | Sí | Dirección de email del destinatario |
| from | String | - | No | Dirección de email del remitente |
| subject | String | - | Sí | Asunto del email |
| template | String | - | Sí | Nombre de la plantilla utilizada |
| templateData | Object | - | Sí | Datos para personalizar la plantilla |
| status | String | - | Sí | Estado del email (pending, sent, failed, retrying) |
| priority | String | - | Sí | Prioridad del email (low, normal, high, urgent) |
| retryCount | Number | - | Sí | Número de intentos de envío realizados |
| maxRetries | Number | - | Sí | Máximo número de reintentos permitidos |
| lastAttempt | Date | - | No | Fecha del último intento de envío |
| sentAt | Date | - | No | Fecha de envío exitoso |
| failureReason | String | - | No | Razón del fallo en el envío |
| messageId | String | - | No | ID del mensaje asignado por el proveedor |
| createdAt | Date | - | Sí | Fecha de creación del registro |
| updatedAt | Date | - | Sí | Fecha de última actualización |

### Índices
- status
- to
- createdAt
- priority, createdAt

### Validaciones
- to: Formato de email válido
- status: Valores permitidos (pending, sent, failed, retrying)
- priority: Valores permitidos (low, normal, high, urgent)
- retryCount: No puede ser negativo
- maxRetries: Debe ser mayor a 0
