# Diccionario de Datos - Exam Service

## Colección: responses

**Descripción**: Almacena las respuestas de los candidatos a las preguntas del examen y su evaluación correspondiente.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | ObjectId | - | Sí | Identificador único de la respuesta |
| sessionId | ObjectId | - | Sí | Referencia a la sesión del examen |
| candidateId | ObjectId | - | Sí | Referencia al candidato |
| examId | ObjectId | - | Sí | Referencia al examen |
| questionId | ObjectId | - | Sí | Referencia a la pregunta |
| competency | String | - | Sí | Competencia evaluada (reading, writing, listening, speaking) |
| response.type | String | - | Sí | Tipo de respuesta (multiple_choice, true_false, open_text, essay, audio_response, file_upload) |
| response.answer | String | - | No | Respuesta en texto |
| response.selectedOptions | Array[String] | - | No | Opciones seleccionadas |
| response.audioUrl | String | - | No | URL del archivo de audio |
| response.fileUrl | String | - | No | URL del archivo subido |
| response.text | String | - | No | Texto de la respuesta |
| answer | Mixed | - | No | Respuesta directa (acceso rápido) |
| evaluation.isCorrect | Boolean | - | No | Indica si la respuesta es correcta |
| evaluation.score | Number | - | Sí | Puntuación obtenida |
| evaluation.maxScore | Number | - | Sí | Puntuación máxima posible |
| evaluation.feedback | String | - | No | Retroalimentación al candidato |
| evaluation.evaluatedBy | String | - | Sí | Método de evaluación (auto, human, ai) |
| evaluation.evaluatorId | ObjectId | - | No | ID del evaluador (si es humano) |
| evaluation.evaluatedAt | Date | - | No | Fecha de evaluación |
| evaluation.rubricScores | Array[Object] | - | No | Puntuaciones por criterio de rúbrica |
| evaluation.rubricScores[].criterionName | String | - | No | Nombre del criterio |
| evaluation.rubricScores[].score | Number | - | No | Puntuación del criterio |
| evaluation.rubricScores[].feedback | String | - | No | Retroalimentación del criterio |
| evaluation.details | Mixed | - | No | Detalles adicionales de evaluación |
| isEvaluated | Boolean | - | Sí | Indica si ya fue evaluada |
| evaluatedAt | Date | - | No | Fecha de evaluación |
| timeSpent | Number | - | Sí | Tiempo empleado en segundos |
| attempts | Number | - | Sí | Número de intentos realizados |
| submittedAt | Date | - | No | Fecha de envío de la respuesta |
| createdAt | Date | - | Sí | Fecha de creación |
| updatedAt | Date | - | Sí | Fecha de última actualización |

### Índices
- sessionId, candidateId, questionId
- candidateId, examId
- questionId
- competency

### Validaciones
- competency: Valores permitidos (reading, writing, listening, speaking)
- response.type: Valores específicos de tipos de respuesta
- evaluation.score: No puede ser negativo, no mayor a maxScore
- evaluation.maxScore: Debe ser mayor a 0
- evaluation.evaluatedBy: Valores permitidos (auto, human, ai)
- timeSpent: No puede ser negativo
- attempts: Mínimo 1
