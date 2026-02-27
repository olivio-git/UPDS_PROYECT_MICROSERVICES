# Diccionario de Datos - Exam Service

## Colección: attempts

**Descripción**: Registra los intentos de examen de los candidatos, controlando el tiempo y estado de cada intento.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | ObjectId | - | Sí | Identificador único del intento |
| sessionId | ObjectId | - | Sí | Referencia a la sesión del examen |
| candidateId | ObjectId | - | Sí | Referencia al candidato |
| examId | ObjectId | - | Sí | Referencia al examen |
| startedAt | Date | - | No | Fecha y hora de inicio del intento |
| finishedAt | Date | - | No | Fecha y hora de finalización |
| status | String | - | Sí | Estado del intento (in_progress, completed, cancelled) |
| timeAllowedSeconds | Number | - | Sí | Tiempo permitido en segundos |
| lastHeartbeat | Date | - | No | Última señal de vida del candidato |
| createdAt | Date | - | Sí | Fecha de creación del registro |
| updatedAt | Date | - | Sí | Fecha de última actualización |

### Índices
- sessionId, candidateId

### Validaciones
- status: Valores permitidos (in_progress, completed, cancelled)
- timeAllowedSeconds: Debe ser mayor a 0
- finishedAt: Debe ser posterior a startedAt (si ambos están presentes)
