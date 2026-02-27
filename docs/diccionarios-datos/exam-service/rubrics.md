# Diccionario de Datos - Exam Service

## Colección: rubrics

**Descripción**: Define las rúbricas de evaluación utilizadas para calificar las respuestas de los candidatos según criterios específicos.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | ObjectId | - | Sí | Identificador único de la rúbrica |
| name | String | - | Sí | Nombre de la rúbrica |
| competency | String | - | Sí | Competencia a evaluar (reading, writing, listening, speaking) |
| level | String | - | Sí | Nivel MCER asociado (A1, A2, B1, B2, C1, C2) |
| criteria | Array[Object] | - | Sí | Criterios de evaluación |
| criteria[].name | String | - | Sí | Nombre del criterio |
| criteria[].description | String | - | Sí | Descripción del criterio |
| criteria[].weight | Number | - | Sí | Peso porcentual del criterio |
| criteria[].levels | Array[Object] | - | Sí | Niveles de puntuación del criterio |
| criteria[].levels[].score | Number | - | Sí | Puntuación del nivel |
| criteria[].levels[].description | String | - | Sí | Descripción del nivel de puntuación |
| criteria[].levels[].examples | Array[String] | - | No | Ejemplos para el nivel |
| scoringType | String | - | Sí | Tipo de puntuación (holistic, analytic) |
| maxScore | Number | - | Sí | Puntuación máxima de la rúbrica |
| isActive | Boolean | - | Sí | Indica si la rúbrica está activa |
| createdBy | ObjectId | - | Sí | Usuario que creó la rúbrica |
| createdAt | Date | - | Sí | Fecha de creación |
| updatedAt | Date | - | Sí | Fecha de última actualización |

### Índices
- competency, level
- isActive

### Validaciones
- competency: Valores permitidos (reading, writing, listening, speaking)
- level: Valores MCER válidos (A1-C2)
- scoringType: Valores permitidos (holistic, analytic)
- criteria[].weight: Debe ser mayor a 0, la suma total debe ser 100
- maxScore: Debe ser mayor a 0
- criteria[].levels[].score: Debe ser mayor o igual a 0
