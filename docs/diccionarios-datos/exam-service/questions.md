# Diccionario de Datos - Exam Service

## Colección: questions

**Descripción**: Almacena las preguntas que conforman el banco de preguntas del sistema de evaluación.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | ObjectId | - | Sí | Identificador único de la pregunta |
| type | String | - | Sí | Tipo de pregunta (multiple_choice, true_false, open_text, essay, fill_blanks, drag_drop, matching, ordering, audio_response, file_upload) |
| competency | String | - | Sí | Competencia evaluada (reading, writing, listening, speaking, grammar, vocabulary) |
| level | String | - | Sí | Nivel MCER (A1, A2, B1, B2, C1, C2) |
| difficulty | Number | - | Sí | Nivel de dificultad (1-5) |
| content.question | String | - | Sí | Texto de la pregunta |
| content.instructions | String | - | No | Instrucciones específicas |
| content.context | String | - | No | Contexto adicional (texto de lectura, transcripción) |
| content.mediaUrl | String | - | No | URL de archivo multimedia |
| content.mediaType | String | - | No | Tipo de multimedia (audio, image, video) |
| content.options | Array[Object] | - | No | Opciones para preguntas de selección |
| content.options[].id | String | - | No | Identificador de la opción |
| content.options[].text | String | - | No | Texto de la opción |
| content.options[].isCorrect | Boolean | - | No | Indica si es la respuesta correcta |
| content.correctAnswer | Mixed | - | No | Respuesta correcta (string o array) |
| content.sampleAnswer | String | - | No | Respuesta de ejemplo |
| content.keywords | Array[String] | - | No | Palabras clave para evaluación |
| content.template | String | - | No | Plantilla para preguntas fill_blanks |
| content.blanks | Array[Object] | - | No | Espacios en blanco para completar |
| content.blanks[].position | Number | - | No | Posición del espacio en blanco |
| content.blanks[].correctAnswers | Array[String] | - | No | Respuestas correctas posibles |
| content.blanks[].caseSensitive | Boolean | - | No | Sensible a mayúsculas/minúsculas |
| content.items | Array[Object] | - | No | Elementos para preguntas drag_drop/matching |
| content.items[].id | String | - | No | Identificador del elemento |
| content.items[].content | String | - | No | Contenido del elemento |
| content.items[].correctPosition | Number | - | No | Posición correcta |
| content.items[].matchingPair | String | - | No | Par correspondiente |
| content.promptAudioUrl | String | - | No | URL del prompt de audio |
| content.expectedResponseType | String | - | No | Tipo de respuesta esperada (word, sentence, paragraph) |
| metadata.topic | String | - | No | Tema de la pregunta |
| metadata.subtopic | String | - | No | Subtema específico |
| metadata.tags | Array[String] | - | No | Etiquetas asociadas |
| metadata.estimatedTime | Number | - | No | Tiempo estimado en segundos |
| metadata.points | Number | - | No | Puntos asignados |
| metadata.rubricId | ObjectId | - | No | Referencia a rúbrica de evaluación |
| statistics.timesUsed | Number | - | Sí | Veces que se ha utilizado |
| statistics.averageScore | Number | - | Sí | Puntuación promedio obtenida |
| statistics.averageTime | Number | - | Sí | Tiempo promedio de respuesta |
| statistics.difficulty | Number | - | Sí | Dificultad calculada |
| isActive | Boolean | - | Sí | Indica si la pregunta está activa |
| createdBy | ObjectId | - | Sí | Usuario que creó la pregunta |
| reviewedBy | ObjectId | - | No | Usuario que revisó la pregunta |
| lastUsed | Date | - | No | Fecha del último uso |
| createdAt | Date | - | Sí | Fecha de creación |
| updatedAt | Date | - | Sí | Fecha de última actualización |

### Índices
- type, competency, level
- metadata.tags
- isActive
- createdBy

### Validaciones
- type: Valores específicos de tipos de pregunta
- competency: Valores permitidos (reading, writing, listening, speaking, grammar, vocabulary)
- level: Valores MCER válidos (A1-C2)
- difficulty: Rango 1-5
- content.mediaType: Valores permitidos (audio, image, video)
- content.expectedResponseType: Valores permitidos (word, sentence, paragraph)
