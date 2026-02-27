# Diccionario de Datos - Notifications Service

## Colección: notifications

**Descripción**: Gestiona notificaciones in-app y otros tipos de alertas para usuarios del sistema.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | String | - | Sí | Identificador único de la notificación |
| recipientId | String | - | Sí | ID del destinatario de la notificación |
| recipientType | String | - | No | Tipo de destinatario (user, candidate, proctor) |
| type | String | - | Sí | Tipo de notificación (ej: session.candidate.added) |
| channel | String | - | No | Canal de entrega (in-app, email, sms) |
| content.title | String | - | Sí | Título de la notificación |
| content.body | String | - | No | Cuerpo del mensaje |
| content.link | String | - | No | Enlace relacionado con la notificación |
| delivery.delivered | Boolean | - | No | Indica si fue entregada |
| delivery.deliveredAt | Date | - | No | Fecha de entrega |
| read | Boolean | - | No | Indica si fue leída por el usuario |
| priority | String | - | No | Prioridad (low, normal, high) |
| metadata | Object | - | No | Datos adicionales de la notificación |
| createdAt | Date | - | Sí | Fecha de creación |
| updatedAt | Date | - | Sí | Fecha de última actualización |

### Índices
- recipientId
- type
- read
- createdAt

### Validaciones
- recipientType: Valores permitidos (user, candidate, proctor)
- channel: Valores permitidos (in-app, email, sms)
- priority: Valores permitidos (low, normal, high)
- content.title: No puede estar vacío