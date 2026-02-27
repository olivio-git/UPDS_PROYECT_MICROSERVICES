<!--
  Activity diagram (Mermaid) for the main exam workflow
  File: docs/workflows/exam-activity-diagram.md
  Purpose: high-level view of the main flow to "dar un examen"
-->

# Diagrama de actividades — Flujo principal para evaluar a un alumno

Fecha: 2025-09-06

Este diagrama representa a alto nivel el flujo principal (actividad) para evaluar a un alumno en el sistema.

```mermaid
flowchart TD
  Start((Start))
  A[Definir examen] --> B[Crear examen y recursos]
  B --> C[Programar sesión]
  C --> D[Inscribir candidato]
  D --> E[Prechecks: identidad y permisos]
  E --> F[Iniciar sesión / Rendimiento del examen]
  F --> G[Enviar respuesta / Subir evidencias]
  G --> H[Cerrar sesión y generar submission]
  H --> I[Grading automático/manual]
  I --> J{¿Apelación o revisión necesaria?}
  J -- Sí --> K[Proceso de revisión humana]
  K --> L[Resultado finalizado]
  J -- No --> L
  L --> M[Publicar resultados y notificar]
  M --> End((End))

  classDef startEnd fill:#111827, color:#fff;
  class Start,End startEnd;

  classDef main fill:#0F172A, color:#E6EEF6, stroke:#274155;
  class A,B,C,D,E,F,G,H,I,L,M main;

```

Notas:
- Es un diagrama de alto nivel, pensado para documentación y onboarding.
- Se puede convertir a un diagrama UML de actividad más formal si se desea (PlantUML) y exportar a imagen.
