# Diccionario de Datos - Exam Service

## Colección: levels

**Descripción**: Define los niveles MCER con sus requisitos y criterios de competencia para la evaluación de idiomas.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | ObjectId | - | Sí | Identificador único del nivel |
| code | String | - | Sí | Código del nivel MCER (A1, A2, B1, B2, C1, C2) |
| name | String | - | Sí | Nombre descriptivo del nivel |
| description | String | - | Sí | Descripción detallada del nivel |
| competencyRequirements.reading.minScore | Number | - | Sí | Puntuación mínima requerida en lectura |
| competencyRequirements.reading.description | String | - | No | Descripción de competencia en lectura |
| competencyRequirements.reading.canDoStatements | Array[String] | - | No | Declaraciones "can-do" para lectura |
| competencyRequirements.writing.minScore | Number | - | Sí | Puntuación mínima requerida en escritura |
| competencyRequirements.writing.description | String | - | No | Descripción de competencia en escritura |
| competencyRequirements.writing.canDoStatements | Array[String] | - | No | Declaraciones "can-do" para escritura |
| competencyRequirements.listening.minScore | Number | - | Sí | Puntuación mínima requerida en comprensión auditiva |
| competencyRequirements.listening.description | String | - | No | Descripción de competencia auditiva |
| competencyRequirements.listening.canDoStatements | Array[String] | - | No | Declaraciones "can-do" para comprensión auditiva |
| competencyRequirements.speaking.minScore | Number | - | Sí | Puntuación mínima requerida en expresión oral |
| competencyRequirements.speaking.description | String | - | No | Descripción de competencia oral |
| competencyRequirements.speaking.canDoStatements | Array[String] | - | No | Declaraciones "can-do" para expresión oral |
| overallMinScore | Number | - | Sí | Puntuación mínima general para el nivel |
| isActive | Boolean | - | Sí | Indica si el nivel está activo |
| createdBy | ObjectId | - | Sí | Usuario que creó el nivel |
| createdAt | Date | - | Sí | Fecha de creación |
| updatedAt | Date | - | Sí | Fecha de última actualización |

### Índices
- code (único)
- isActive

### Validaciones
- code: Valores MCER válidos (A1, A2, B1, B2, C1, C2), único
- name: No puede estar vacío
- description: No puede estar vacío
- competencyRequirements.*.minScore: Debe ser mayor a 0
- overallMinScore: Debe ser mayor a 0
