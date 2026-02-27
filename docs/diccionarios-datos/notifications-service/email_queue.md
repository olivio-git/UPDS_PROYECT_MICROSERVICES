# Diccionario de Datos - Notifications Service

## Colección: email_queue

**Descripción**: Cola de procesamiento para emails que serán enviados de forma asíncrona.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | String | - | Sí | Identificador único del elemento en cola |
| emailId | String | - | Sí | Referencia al email en la colección emails |
| priority | Number | - | Sí | Prioridad numérica para ordenamiento |
| scheduledAt | Date | - | Sí | Fecha programada para envío |
| processedAt | Date | - | No | Fecha de procesamiento |
| status | String | - | Sí | Estado en la cola (queued, processing, completed, failed) |
| createdAt | Date | - | Sí | Fecha de creación del elemento |

### Índices
- status
- priority, scheduledAt
- scheduledAt

### Validaciones
- status: Valores permitidos (queued, processing, completed, failed)
- priority: Debe ser un número entero
- scheduledAt: No puede ser fecha pasada al momento de creación