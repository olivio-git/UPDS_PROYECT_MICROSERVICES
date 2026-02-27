# Diccionario de Datos - Exam Service

## Colección: sessions

**Descripción**: Gestiona las sesiones de examen donde los candidatos toman las evaluaciones.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | ObjectId | - | Sí | Identificador único de la sesión |
| examId | ObjectId | - | Sí | Referencia al examen asociado |
| sessionName | String | 200 | Sí | Nombre descriptivo de la sesión |
| scheduling.startDate | Date | - | Sí | Fecha de inicio de la sesión |
| scheduling.endDate | Date | - | Sí | Fecha de finalización de la sesión |
| scheduling.timeSlots | Array[Object] | - | Sí | Horarios disponibles |
| scheduling.timeSlots[].date | Date | - | Sí | Fecha del horario |
| scheduling.timeSlots[].startTime | String | - | Sí | Hora de inicio (formato HH:mm) |
| scheduling.timeSlots[].endTime | String | - | Sí | Hora de finalización (formato HH:mm) |
| scheduling.timeSlots[].capacity | Number | - | Sí | Capacidad máxima del horario |
| scheduling.timeSlots[].enrolled | Number | - | Sí | Candidatos inscritos |
| participants.maxCandidates | Number | - | Sí | Máximo número de candidatos |
| participants.registeredCandidates | Array[ObjectId] | - | Sí | IDs de candidatos registrados |
| participants.proctors | Array[ObjectId] | - | Sí | IDs de supervisores asignados |
| participants.currentActive | Number | - | Sí | Participantes actualmente activos |
| settings.requireProctor | Boolean | - | Sí | Requiere supervisor |
| settings.enableRecording | Boolean | - | Sí | Habilitar grabación |
| settings.enableLockdown | Boolean | - | Sí | Habilitar modo bloqueo |
| settings.allowLateEntry | Boolean | - | Sí | Permitir entrada tardía |
| settings.lateEntryMinutes | Number | - | Sí | Minutos de tolerancia para entrada tardía |
| status | String | - | Sí | Estado de la sesión (scheduled, in_progress, completed, cancelled, expired) |
| stats.totalRegistered | Number | - | Sí | Total de candidatos registrados |
| stats.totalCompleted | Number | - | Sí | Total que completaron el examen |
| stats.totalAbandoned | Number | - | Sí | Total que abandonaron |
| stats.averageScore | Number | - | Sí | Puntuación promedio obtenida |
| user | ObjectId | - | No | Usuario asociado (para casos específicos) |
| finalScore | Number | - | No | Puntuación final |
| maxScore | Number | - | No | Puntuación máxima posible |
| isEvaluated | Boolean | - | Sí | Indica si ya fue evaluada |
| evaluatedAt | Date | - | No | Fecha de evaluación |
| completedAt | Date | - | No | Fecha de finalización |
| createdBy | ObjectId | - | Sí | Usuario que creó la sesión |
| createdAt | Date | - | Sí | Fecha de creación |
| updatedAt | Date | - | Sí | Fecha de última actualización |

### Índices
- examId, status
- scheduling.startDate, scheduling.endDate
- participants.registeredCandidates
- status
- createdBy

### Validaciones
- sessionName: Máximo 200 caracteres
- participants.maxCandidates: Mínimo 1
- status: Valores permitidos (scheduled, in_progress, completed, cancelled, expired)
- scheduling.startDate: Debe ser fecha futura
- scheduling.endDate: Debe ser posterior a startDate
- settings.lateEntryMinutes: No puede ser negativo
