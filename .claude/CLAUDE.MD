# Contexto

Sistema de evaluación lingüística automatizada con IA para el CBA Tarija, diseñado
para calificar las cuatro habilidades del inglés (Reading, Writing, Listening,
Speaking) bajo el estándar internacional MCER.

# Stack y Reglas Base

**React (UI):** Gestión de interfaces responsivas, consumo de APIs
(FastAPI/Node), autenticación OTP/JWT y monitoreo de sesiones en tiempo real vía
WebSockets.
**(System):** Orquestación de procesos locales de IA (Ollama), manejo de
archivos de audio para procesamiento offline y persistencia de logs de auditoría.

# Entidades Core

**Users:** Gestión de identidades con roles (Admin, Docente, Proctor,
Estudiante) y metadatos académicos.
**Exams/Questions:** Estructura de evaluaciones, banco de preguntas
categorizado por niveles MCER y rúbricas de calificación.
**Sessions:** Instancias de ejecución cronometradas con asignación de
participantes y control de estado (Scheduled, In-Progress, Evaluated).
**Responses:** Almacenamiento de respuestas multimodales, puntajes calculados y
feedback generado por los motores de IA.

# Roadmap y Estado Actual

## Leyenda: [x] Completo · [~] En progreso / parcialmente implementado · [ ] Pendiente

[x] Módulo de Gestión de Usuarios y Autenticación OTP/JWT.
    - auth-service completo (JWT + OTP), user-management-service, frontend login/OTP screens.

[~] Configuración Académica (Niveles MCER, Rúbricas y Parámetros).
    - Backend: level/rubric/question services en exam-service.
    - Frontend: LevelsManagementScreen, RubricsManagementScreen, AcademicConfigScreen, ExamsScreen.
    - Pendiente: validación e2e de flujos CRUD completos.

[~] Banco de Preguntas Multimodal (Texto y Audio).
    - Backend: question.service, import.service, storage.service (MinIO), questionImproved.controller.
    - Frontend: QuestionForm, QuestionsList, AIQuestionGenerator, ImportModal.
    - Pendiente: integración estable de audio upload + previsualización.

[~] Interfaz de Examen Responsiva y Grabación de Audio (WebRTC).
    - Frontend: ExamRunner, ExamRunnerHTTP, AdaptiveExamRunner, SectionedExamRenderer.
    - Componentes de audio en frontend/src/components/audio/.
    - Pendiente: grabación WebRTC en producción, flujo adaptativo completo.

[~] Panel de Monitoreo en Tiempo Real para Proctores.
    - SessionMonitorScreen, UpcomingSessionsScreen implementados.
    - session-manager-service corriendo, WebSocket via Socket.IO.
    - Pendiente: acciones de control en tiempo real (pausar/expulsar candidato).

[~] Motor de Calificación IA (NLP para Writing y Whisper para Speaking).
    - grading-service (GROQ llama-3.3-70b) para essay/open_text.
    - ai-grading-service (Python/Whisper) para audio.
    - Bugs conocidos: drag_drop scores 0, EvaluationController query incorrecta.
    - Pendiente: corregir bugs, integrar flujo completo exam → grading → result.

[~] Sistema de Reportes Estadísticos y Envío Automático de Resultados.
    - Backend: reports.service, exam-result-pdf.service, pdf-professional.service.
    - Frontend: ReportsScreen, StudentResults, ExamReview.
    - Notificaciones por email via Resend + Kafka configurado.
    - Pendiente: reportes estadísticos agregados, envío automático post-sesión.
