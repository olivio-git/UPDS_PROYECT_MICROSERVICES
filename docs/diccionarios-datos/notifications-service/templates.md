# Diccionario de Datos - Notifications Service

## Colección: templates

**Descripción**: Almacena las plantillas de email utilizadas por el sistema para diferentes tipos de notificaciones.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | String | - | Sí | Identificador único de la plantilla |
| name | String | - | Sí | Nombre único de la plantilla |
| subject | String | - | Sí | Asunto por defecto del email |
| htmlContent | String | - | Sí | Contenido HTML de la plantilla |
| textContent | String | - | No | Contenido en texto plano |
| variables | Array[String] | - | Sí | Lista de variables que acepta la plantilla |
| category | String | - | Sí | Categoría de la plantilla (auth, otp, exam, result, general) |
| isActive | Boolean | - | Sí | Indica si la plantilla está activa |
| createdAt | Date | - | Sí | Fecha de creación |
| updatedAt | Date | - | Sí | Fecha de última actualización |

### Índices
- name (único)
- category
- isActive

### Validaciones
- name: Debe ser único en la colección
- category: Valores permitidos (auth, otp, exam, result, general)
- htmlContent: No puede estar vacío
- variables: Debe ser un array válido
