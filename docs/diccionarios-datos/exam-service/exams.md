# Diccionario de Datos - Exam Service

## Colección: exams

**Descripción**: Define la estructura y configuración de los exámenes disponibles en el sistema.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | ObjectId | - | Sí | Identificador único del examen |
| name | String | 200 | Sí | Nombre del examen |
| description | String | 1000 | Sí | Descripción detallada del examen |
| type | String | - | Sí | Tipo de examen (placement, progress, final, practice) |
| targetLevel | String | - | Sí | Nivel MCER objetivo (A1, A2, B1, B2, C1, C2) |
| structure.sections | Array[Object] | - | Sí | Secciones que componen el examen |
| structure.sections[].name | String | - | Sí | Nombre de la sección |
| structure.sections[].competency | String | - | Sí | Competencia evaluada (reading, writing, listening, speaking, grammar, vocabulary) |
| structure.sections[].duration | Number | - | Sí | Duración en minutos |
| structure.sections[].questionCount | Number | - | Sí | Número de preguntas en la sección |
| structure.sections[].weight | Number | - | Sí | Peso porcentual de la sección |
| structure.totalDuration | Number | - | Sí | Duración total del examen en minutos |
| structure.passingScore | Number | - | Sí | Puntuación mínima para aprobar |
| configuration.randomizeQuestions | Boolean | - | No | Aleatorizar orden de preguntas |
| configuration.allowReview | Boolean | - | No | Permitir revisar respuestas |
| configuration.showResults | Boolean | - | No | Mostrar resultados al finalizar |
| configuration.attemptsAllowed | Number | - | No | Número de intentos permitidos |
| configuration.timeBetweenAttempts | Number | - | No | Tiempo entre intentos en horas |
| questionPool | Array[ObjectId] | - | Sí | Referencias a preguntas del examen |
| isActive | Boolean | - | Sí | Indica si el examen está activo |
| isTemplate | Boolean | - | Sí | Indica si es una plantilla |
| createdBy | ObjectId | - | Sí | Usuario que creó el examen |
| approvedBy | ObjectId | - | No | Usuario que aprobó el examen |
| createdAt | Date | - | Sí | Fecha de creación |
| updatedAt | Date | - | Sí | Fecha de última actualización |

### Índices
- name
- type, targetLevel
- isActive, isTemplate
- createdBy

### Validaciones
- name: Máximo 200 caracteres
- description: Máximo 1000 caracteres
- type: Valores permitidos (placement, progress, final, mock, practice)
- targetLevel: Valores MCER válidos (A1-C2)
- structure.sections[].competency: Valores permitidos (reading, writing, listening, speaking, grammar, vocabulary)
- structure.passingScore: Entre 0 y 100
