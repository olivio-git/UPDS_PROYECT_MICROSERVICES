<!--
  Archivo: docs/workflows/exam-workflow.md
  Propósito: documento vivo que describe el workflow para "llegar a dar un examen"
  Creado por: asistente automático
-->

# Workflow: Proceso para evaluar a un alumno (adaptado al repo)

Fecha: 2025-09-06

## Objetivo
Definir un flujo de trabajo claro y mapeado a los microservicios existentes de este repositorio para "evaluar a un alumno" desde la especificación hasta la publicación de resultados.

Este documento adapta el modelo genérico (Investigación → Creación → Revisión → Corrección → Aprobación → Publicación) a la arquitectura concreta del proyecto y propone artefactos, eventos y responsabilidades por servicio.

---

## Resumen ejecutivo (1 línea)
Evaluación = (definir examen) → (preparar sesión + inscribir candidato) → (ejecución de la sesión y recolección de evidencias) → (calificación automática/manual) → (revisión/appeal) → (publicación de resultados y notificaciones).

## Mapeo de etapas al repo (servicios y artefactos)

- Investigación / Definición
  - Qué: definición del objetivo del examen, competencias, rúbricas, lista de ítems/preguntas, tiempo y recursos permitidos.
  - Artefactos: `exam_spec` (JSON/YAML), banco de preguntas.
  - Servicios: trabajo administrativo en `user-management-service` (perfiles de docentes/creadores); no se requiere un microservicio nuevo.

- Creación / Preparación
  - Qué: creación del `exam` (metadatos), asociación de preguntas, subida de recursos (pdfs, multimedia) a almacenamiento (MinIO), configuración de sesiones (horarios, duración, límite de participantes).
  - Artefactos: colección `exams`, objetos en MinIO (`exam-files/`), evento publicado `exam.created` o `exam.updated`.
  - Servicios implicados: `exam-service` (APIs CRUD de exam), `storage` (MinIO), `user-management-service` (roles), `notifications-service` (opcional: avisar a inscritos cuando el examen esté listo).

- Registro / Inscripción
  - Qué: asignar candidatos a una `session` o crear `session.candidate` entries (invitación / enrolment).
  - Artefactos: colección `sessions`, `session_candidates`; evento `session.candidate.added` (ya usado en repo).
  - Servicios: `session-manager-service` (si existe) / `exam-service`, `notifications-service` (in-app + email), `auth-service` para comprobación de identidad.

- Pre-exam (checks, envío de instrucciones)
  - Qué: comprobaciones de identidad, permisos, preconditions (material permitido), envío de instrucciones y checklists, generación de tokens temporales para la sesión, bloqueo de reintentos (Redis OTP-like).
  - Artefactos: `session_tokens`, Redis keys para rate-limiting, evento `session.starting`.
  - Servicios: `auth-service`, `notifications-service`, `exam-service`, `middleware` (proctoring hooks).

- Ejecución / Recolección
  - Qué: el candidato realiza el examen. Eventos en tiempo real: `session.started`, `question.answered`, `file.uploaded` (guardados en MinIO), `session.ended`.
  - Artefactos: respuestas, ficheros en MinIO (`exam-files/sessionId/...`), logs de sesión.
  - Servicios: `exam-service` (coordina), `session-manager-service` (si separada), `minio` (storage), `notifications-service` (updates realtime), `ollama-service` o `ai-grading-service` (si se necesita retroalimentación inmediata).

- Entrega / Finalización
  - Qué: cierre de sesión, lock de entregas, generación de paquete de entrega y publicación de evento `submission.created` o `session.completed`.
  - Artefactos: `submissions` collection, submission bundle in MinIO.
  - Servicios: `exam-service`, `notifications-service`.

- Calificación (grading)
  - Variantes:
    - Automática (AI): `ai-grading-service` consume `submission.created`, produce `grade.proposed`.
    - Manual: colas de trabajo para correctores humanos (interfaz en frontend con `user-management-service`).
    - Híbrida: AI propone, humano revisa.
  - Artefactos: `grades`, `grade_audit`, events `grade.created`, `grade.finalized`.

- Revisión / Corrección / Appeal
  - Qué: procesos de revisión, reclamaciones, re-escoring.
  - Artefactos: `review_tasks`, `appeals` collection.
  - Servicios: `exam-service` (orquestador), `notifications-service` (alertas al candidato/teacher), `user-management-service` (roles y asignación de revisores).

- Aprobación / Publicación de resultados
  - Qué: publicar resultados finales, emitir certificados, enviar notificaciones (email + in-app).
  - Artefactos: `results_published` event, `transcripts` files.
  - Servicios: `notifications-service` (in-app), `auth-service`/`user-management-service` (who can see), `ai-grading-service` (if needed for batch recalculation), storage for final artifacts (MinIO).

## Eventos recomendados / topic contracts (ejemplos)
- topic: `exam-events`
  - `exam.created` { type, data: { examId, creatorId, metadata... } }
  - `session.candidate.added` { type, data: { sessionId, candidateId, addedBy } }
  - `submission.created` { type, data: { submissionId, sessionId, candidateId, files: [url...] } }
  - `grade.proposed` { type, data: { submissionId, graderId, score, details } }
  - `grade.finalized` { type, data: { submissionId, finalScore, publishedAt } }

Definir explicitamente el esquema JSON de cada tipo ayuda a mantener consumidores robustos (notifications-service, grading-service, analytics).

## Riesgos y consideraciones técnicas
- Consistencia de shape de mensajes: el repo mostró divergencias (usar `type` vs `eventType`). Estándar: usar `type` y `data`.
- IDs y formatos: normalizar uso de ObjectId strings vs ObjectId en DB. Repositorios deben convertir cuando sea necesario.
- Seguridad: validar tokens en handshakes (sockets), firmar URLs para MinIO, TTL para tokens de sesión.
- Escalado: colas (Kafka) para procesamiento de grading; almacenamiento en MinIO con lifecycle policies; índices en MongoDB (sessionId, candidateId, createdAt).

## Opciones de implementación (trade-offs)
- Opción A — Rápida / Manual-first
  - Implementar: examen creado en `exam-service`, inscripciones manuales, notificaciones por `notifications-service`, grading manual. Menor complejidad, buena para MVP.
- Opción B — Híbrida (recomendada)
  - Implementar: auto-grading para preguntas objetivas con `ai-grading-service`, humana revisión para ensayos. Requiere contratos y colas.
- Opción C — Completamente automática
  - Implementar: AI para todo; requiere inversión en modelos, tests y monitoreo ético. Riesgo de calidad y appeals.

## Artefactos y tareas concretas a corto plazo (next actions)
1. Añadir este archivo al repo (hecho).
2. Definir JSON Schemas para los eventos citados (crear `docs/events/` con ejemplos). — prioridad alta.
3. Dibujar 2 diagramas UML/sequence:
   - a) Inscripción → `session.candidate.added` → notificación in-app.
   - b) Ejecución completa: student start → submission → grading → publication.
4. Implementar validación en el consumidor de `notifications-service` para aceptar `type` / `data` y documentar el contrato.
5. Añadir tests end‑to‑end (local Kafka or test harness) para el flujo submission → grading → notification.

## Cómo usar este documento
- Este archivo es un punto central: cualquier cambio en el contrato de eventos o en el modelado de `exam` debe reflejarse aquí.
- Agrega links a diagramas (archivos .png/.drawio) y a JSON Schemas colocados en `docs/events/`.

## Sugerencias de seguimiento (si quieres que lo haga yo)
- Generar los JSON Schemas y agregar `docs/events/*.json`.
- Crear los diagramas Sequence (Draw.io o PlantUML) y guardar en `docs/diagrams/`.
- Implementar las pruebas E2E mínimas (script que publica `submission.created` y verifica `grade.finalized`).

---

Si quieres, procedo ahora a: (A) generar los JSON Schemas para los eventos más críticos; (B) crear un diagrama sequence para la inscripción → notificación; o (C) crear tests de integración mínimos. Dime cuál prefieres.
