# 🚀 PLAN DE DESARROLLO - SISTEMA DE EVALUACIÓN MCER

Este documento detalla el plan de desarrollo para el **Sistema de Evaluación MCER**, un proyecto ambicioso que busca transformar la forma en que se evalúan las competencias lingüísticas. El plan se estructura en **16 semanas**, divididas en **4 Sprints de 4 semanas cada uno**, asegurando entregas incrementales de valor con un enfoque inicial en las funcionalidades principales y la posterior adición de características avanzadas.

---
## 🎯 Visión General del Proyecto

El Sistema de Evaluación MCER tiene como objetivo proporcionar una plataforma robusta y eficiente para la evaluación de competencias lingüísticas, siguiendo los parámetros del Marco Común Europeo de Referencia para las Lenguas (MCER). Utilizará tecnologías modernas y un enfoque ágil para garantizar un desarrollo eficiente y una solución de alta calidad.

---
## 🗓️ Planificación de Sprints

Cada sprint tiene un objetivo claro y entregables específicos, lo que permite un seguimiento detallado del progreso y una adaptación continua.

### 📋 SPRINT 1: FUNDACIÓN DEL SISTEMA (Semanas 1-4)

**Objetivo:** Establecer la base técnica y funcionalidades core de autenticación.

Este sprint se centra en la configuración de la infraestructura y el desarrollo de los módulos esenciales para la gestión de usuarios y la autenticación del sistema.

#### Semana 1: Setup de Infraestructura
* Configuración de **MongoDB**, **Redis** y **MinIO** para almacenamiento de datos y objetos.
* Implementación de **API Gateway (Nginx)** para la gestión de solicitudes.
* Configuración de proyectos **auth-service** y **exam-service** con FastAPI.
* Configuración de **Docker containers** para la orquestación de servicios.
* Implementación de **CI/CD básico** para la automatización de despliegues.

#### Semana 2: Auth Service
* **REQ #1:** CRUD de usuarios del sistema (Prioridad 5 - Dificultad 2).
* **REQ #2:** Gestión de roles (Admin, Docente, Proctor) (P5-D3).
* **REQ #3:** Autenticación con JWT (P5-D2).
* **REQ #36:** Validación de permisos por endpoint (P5-D3).
* Desarrollo de tests unitarios básicos.

#### Semana 3: User Management
* **REQ #4:** Gestión de perfil de usuario (P4-D2).
* **REQ #5:** Registro de candidatos (P5-D2).
* **REQ #37:** Logs de auditoría (P4-D2).
* **REQ #38:** Recuperación de contraseña (P3-D2).

#### Semana 4: Candidatos + Import
* **REQ #6:** Importación masiva desde Excel/CSV (P3-D3).
* **REQ #7:** Búsqueda y filtrado de candidatos (P3-D2).
* **REQ #39:** Configuración del sistema (P4-D2).
* Desarrollo de un frontend básico de login y dashboard.

**🎯 ENTREGABLE SPRINT 1:** Sistema de autenticación completo + gestión básica de usuarios.

---

### 📋 SPRINT 2: MOTOR DE EXÁMENES (Semanas 5-8)

**Objetivo:** Crear el core del sistema de exámenes y preguntas.

Este sprint se enfoca en el desarrollo del motor principal de exámenes, la gestión de preguntas y la configuración de las sesiones.

#### Semana 5: Question Bank
* **REQ #8:** CRUD de niveles de benchmark (A1-C2) (P5-D2).
* **REQ #9:** CRUD de preguntas por nivel y competencia (P5-D3).
* **REQ #10:** Definición de rúbricas MCER (P5-D4).
* Setup básico de la capa de Inteligencia Artificial (Hugging Face).

#### Semana 6: Exam Configuration
* **REQ #11:** Configuración de parámetros del examen (P4-D2).
* **REQ #12:** Programación de sesiones de examen (P5-D3).
* **REQ #13:** Asignación de candidatos y proctors (P4-D3).
* Desarrollo del frontend para la configuración de exámenes.

#### Semana 7: Session Management
* **REQ #14:** Verificación de identidad del candidato (P4-D3).
* **REQ #15:** Prueba de audio (micrófono y auriculares) (P4-D3).
* **REQ #16:** Inicio y control de sesión de examen (P5-D4).
* Setup de **WebSocket básico** para comunicación en tiempo real.

#### Semana 8: Test Engine Core
* **REQ #17:** Monitoreo de progreso en tiempo real (P3-D4).
* **REQ #18:** Asignación aleatoria de preguntas (P4-D3).
* **REQ #19:** Interfaz de examen responsiva (P5-D3).
* Desarrollo del frontend para la interfaz de examen.

**🎯 ENTREGABLE SPRINT 2:** Motor de exámenes funcional + gestión de sesiones.

---

### 📋 SPRINT 3: EVALUACIÓN Y RESULTADOS (Semanas 9-12)

**Objetivo:** Implementar el sistema de evaluación y generación de resultados.

En este sprint se desarrollarán las funcionalidades relacionadas con la captura de respuestas, la corrección de exámenes y la generación de informes detallados.

#### Semana 9: Capture & Storage
* **REQ #20:** Grabación de respuestas de audio (Speaking) (P5-D4).
* **REQ #21:** Guardado automático de respuestas (P5-D3).
* **REQ #22:** Finalización automática por tiempo (P4-D2).
* Setup completo de **MinIO/GridFS** para almacenamiento de archivos grandes.

#### Semana 10: Grading Service
* **REQ #23:** Corrección automática de preguntas objetivas (P5-D2).
* **REQ #24:** Evaluación de respuestas abiertas con IA (P4-D5).
* **REQ #25:** Cálculo de puntajes por competencia (P5-D4).
* Integración con modelos de IA locales.

#### Semana 11: MCER Scoring
* **REQ #26:** Determinación de nivel MCER (P5-D4).
* **REQ #27:** Generación de feedback personalizado (P3-D4).
* **REQ #28:** Envío automático de resultados (P4-D2).
* Setup completo del servicio de notificaciones.

#### Semana 12: Reports & Analytics
* **REQ #29:** Recomendaciones de nivel de curso (P3-D3).
* **REQ #30:** Estadísticas de candidatos (P4-D3).
* **REQ #33:** Exportación de reportes (PDF, CSV) (P4-D3).
* Desarrollo del dashboard de resultados.

**🎯 ENTREGABLE SPRINT 3:** Sistema completo de evaluación + reportes básicos.

---

### 📋 SPRINT 4: OPTIMIZACIÓN Y FEATURES AVANZADAS (Semanas 13-16)

**Objetivo:** Pulir la aplicación y agregar funcionalidades avanzadas.

El último sprint se dedicará a mejoras de rendimiento, seguridad, análisis avanzados y la preparación final para el despliegue en producción.

#### Semana 13: Advanced Analytics
* **REQ #31:** Análisis de rendimiento por competencia (P4-D3).
* **REQ #32:** Próximas programaciones (P3-D2).
* **REQ #34:** Historial de exámenes por candidato (P4-D2).
* Desarrollo de un dashboard avanzado de analytics.

#### Semana 14: UI/UX Enhancement
* Mejoras generales de la interfaz de usuario.
* Optimización de performance.
* Testing de usabilidad.
* Implementación completa de **Responsive Design**.
* Asegurar la accesibilidad del sistema.

#### Semana 15: Testing & Security
* Desarrollo de tests de integración completos.
* Realización de un **Security Audit**.
* Pruebas de rendimiento (**Performance Testing**).
* Pruebas de carga (**Load Testing**).
* Generación de documentación de API.

#### Semana 16: Deploy & Launch
* **Deploy en producción**.
* Configuración de monitoreo con **Prometheus/Grafana**.
* Implementación de backups automatizados.
* Capacitación del equipo.
* **Go-live** del sistema.

**🎯 ENTREGABLE SPRINT 4:** Sistema completo en producción.

---

## 📊 Distribución de Esfuerzo por Sprint

| Sprint          | Foco Principal      | Reqs Completados | Complejidad |
| :-------------- | :------------------ | :--------------- | :---------- |
| Sprint 1        | Auth + Users        | 8 requerimientos | Media       |
| Sprint 2        | Exam Engine         | 8 requerimientos | Alta        |
| Sprint 3        | Grading + Reports   | 10 requerimientos | Muy Alta    |
| Sprint 4        | Polish + Deploy     | 6 requerimientos | Media       |

---

## 🛠️ Stack Tecnológico por Sprint

La elección de tecnologías se alinea con los objetivos de cada fase del desarrollo, garantizando escalabilidad y eficiencia.

* **Sprint 1:** **FastAPI**, **MongoDB**, **JWT**, **React**.
* **Sprint 2:** **FastAPI**, **WebSocket**, **Redis**, **React**.
* **Sprint 3:** **Python IA**, **MinIO**, **PDF Generation**.
* **Sprint 4:** **Monitoring (Prometheus/Grafana)**, **Docker**, **CI/CD**.

---

## 👥 Equipo Recomendado

Para la correcta ejecución de este plan, se recomienda el siguiente equipo:

* 1 **Tech Lead/Architect**
* 2 **Backend Developers** (Python/FastAPI)
* 1 **Frontend Developer** (React)
* 1 **DevOps Engineer**
* 1 **AI/ML Engineer** (incorporándose desde el Sprint 2)

---

## 🎯 Criterios de Éxito por Sprint

Cada sprint tiene criterios de éxito definidos para asegurar que los objetivos se cumplan antes de avanzar.

* **Sprint 1:** ✅ Login funcional + CRUD de usuarios.
* **Sprint 2:** ✅ Creación y ejecución de un examen básico.
* **Sprint 3:** ✅ Evaluación automática + generación de resultados.
* **Sprint 4:** ✅ Sistema completo en producción.

Este plan de desarrollo está diseñado para asegurar entregas incrementales de valor, construyendo el sistema de evaluación MCER de manera sólida y eficiente.