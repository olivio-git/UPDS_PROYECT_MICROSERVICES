# Diccionario de Datos - User Management Service

## Colección: candidates

**Descripción**: Almacena información completa de candidatos que tomarán exámenes, incluyendo datos personales, académicos y técnicos.

| Campo | Tipo | Tamaño | Requerido | Descripción |
|-------|------|--------|-----------|-------------|
| _id | ObjectId | - | Sí | Identificador único del candidato |
| userId | ObjectId | - | Sí | Referencia al usuario en la colección users |
| personalInfo.firstName | String | - | Sí | Nombre del candidato |
| personalInfo.lastName | String | - | Sí | Apellido del candidato |
| personalInfo.email | String | - | Sí | Dirección de correo electrónico |
| personalInfo.phone | String | - | No | Número de teléfono |
| personalInfo.dateOfBirth | Date | - | No | Fecha de nacimiento |
| personalInfo.nationality | String | - | No | Nacionalidad |
| personalInfo.identification.type | String | - | No | Tipo de identificación (ci, passport, other) |
| personalInfo.identification.number | String | - | No | Número de identificación |
| personalInfo.address.street | String | - | No | Dirección - calle |
| personalInfo.address.city | String | - | No | Ciudad |
| personalInfo.address.state | String | - | No | Estado/departamento |
| personalInfo.address.country | String | - | No | País |
| personalInfo.address.zipCode | String | - | No | Código postal |
| personalInfo.emergencyContact.name | String | - | No | Nombre del contacto de emergencia |
| personalInfo.emergencyContact.relationship | String | - | No | Relación con el candidato |
| personalInfo.emergencyContact.phone | String | - | No | Teléfono del contacto |
| personalInfo.emergencyContact.email | String | - | No | Email del contacto |
| academicInfo.currentLevel | String | - | Sí | Nivel actual MCER (A1, A2, B1, B2, C1, C2) |
| academicInfo.targetLevel | String | - | Sí | Nivel objetivo MCER |
| academicInfo.studyPurpose | String | - | No | Propósito de estudio (academic, professional, travel, personal, immigration) |
| academicInfo.previousExperience | Array[Object] | - | No | Experiencia previa en idiomas |
| academicInfo.institution | String | - | No | Institución educativa |
| academicInfo.courseDuration | Number | - | No | Duración del curso en meses |
| technicalSetup.hasCamera | Boolean | - | No | Tiene cámara disponible |
| technicalSetup.hasMicrophone | Boolean | - | No | Tiene micrófono disponible |
| technicalSetup.hasStableInternet | Boolean | - | No | Tiene conexión estable a internet |
| technicalSetup.browserInfo.name | String | - | No | Nombre del navegador |
| technicalSetup.browserInfo.version | String | - | No | Versión del navegador |
| technicalSetup.systemInfo.os | String | - | No | Sistema operativo |
| technicalSetup.systemInfo.device | String | - | No | Tipo de dispositivo |
| technicalSetup.lastTechCheck | Date | - | No | Última verificación técnica |
| examHistory | Array[Object] | - | Sí | Historial de exámenes tomados |
| examHistory[].examId | ObjectId | - | Sí | ID del examen |
| examHistory[].sessionId | ObjectId | - | Sí | ID de la sesión |
| examHistory[].date | Date | - | Sí | Fecha del examen |
| examHistory[].level | String | - | Sí | Nivel MCER del examen |
| examHistory[].scores.listening | Number | - | Sí | Puntuación en comprensión auditiva |
| examHistory[].scores.reading | Number | - | Sí | Puntuación en comprensión lectora |
| examHistory[].scores.writing | Number | - | Sí | Puntuación en expresión escrita |
| examHistory[].scores.speaking | Number | - | Sí | Puntuación en expresión oral |
| examHistory[].overallScore | Number | - | Sí | Puntuación general |
| examHistory[].result | String | - | Sí | Resultado (passed, failed, pending) |
| examHistory[].certificateUrl | String | - | No | URL del certificado |
| status | String | - | Sí | Estado del candidato (registered, verified, active, inactive, graduated) |
| registeredBy | ObjectId | - | Sí | ID del usuario que registró al candidato |
| notes | String | - | No | Notas adicionales |
| createdAt | Date | - | Sí | Fecha de creación |
| updatedAt | Date | - | Sí | Fecha de última actualización |

### Índices
- userId
- personalInfo.email
- academicInfo.currentLevel
- academicInfo.targetLevel
- status
- registeredBy

### Validaciones
- personalInfo.firstName: Mínimo 2 caracteres
- personalInfo.lastName: Mínimo 2 caracteres
- personalInfo.email: Formato de email válido
- academicInfo.currentLevel: Valores MCER válidos (A1-C2)
- academicInfo.targetLevel: Valores MCER válidos (A1-C2)
- status: Valores permitidos (registered, verified, active, inactive, graduated)
