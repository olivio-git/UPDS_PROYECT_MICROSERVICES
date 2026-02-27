# Diagrama de Arquitectura del Sistema - ACTUALIZADO
> Arquitectura de microservicios implementada - Sistema de Evaluación UPDS

## 1. Arquitectura General del Sistema

```mermaid
graph TB
    subgraph "🌐 CLIENTE"
        Frontend["Frontend React<br/>Puerto 5173<br/>React 19 + Vite + Zustand"]
    end

    subgraph "🔐 CAPA DE APLICACIÓN"
        AuthService["Auth Service<br/>Puerto 3000<br/>Autenticación JWT + OTP"]
        UserMgmt["User Management<br/>Puerto 3002<br/>Gestión de Usuarios y Candidatos"]
        ExamService["Exam Service<br/>Puerto 3003<br/>Gestión de Exámenes"]
        SessionMgr["Session Manager<br/>Puerto 3004<br/>Sesiones en Tiempo Real"]
        NotifService["Notifications<br/>Puerto 3001<br/>Emails + In-App"]
        AIGrading["AI Grading<br/>Puerto 3006<br/>Evaluación con IA"]
        OllamaProxy["Ollama Service<br/>Puerto 3007<br/>Proxy LLM"]
    end

    subgraph "🗄️ CAPA DE DATOS"
        MongoDB[(MongoDB<br/>Puerto 27017<br/>Base de Datos)]
        Redis[(Redis<br/>Puerto 6379<br/>Caché + Sesiones)]
        MinIO[(MinIO<br/>Puerto 9000<br/>Almacenamiento Multimedia)]
    end

    subgraph "📡 MENSAJERÍA"
        Kafka["Apache Kafka<br/>Puerto 29092<br/>Mensajería Asíncrona"]
        Zookeeper["Zookeeper<br/>Puerto 2181<br/>Coordinador Kafka"]
    end

    subgraph "🤖 SERVICIOS IA"
        Ollama["Ollama Server<br/>Puerto 11434<br/>LLM Local"]
    end

    subgraph "📧 SERVICIOS EXTERNOS"
        ResendAPI["Resend API<br/>Envío de Emails"]
    end

    subgraph "🛠️ HERRAMIENTAS DE DESARROLLO"
        KafkaUI["Kafka UI<br/>Puerto 8080<br/>Monitoreo Kafka"]
        SocketAdmin["Socket.IO Admin<br/>WebSocket Monitor"]
    end

    %% Conexiones Frontend
    Frontend -->|HTTP/REST| AuthService
    Frontend -->|HTTP/REST| UserMgmt
    Frontend -->|HTTP/REST| ExamService
    Frontend -->|HTTP/REST| NotifService
    Frontend -->|WebSocket| SessionMgr
    Frontend -->|Socket.IO| NotifService

    %% Conexiones entre Servicios
    UserMgmt -->|HTTP| AuthService
    ExamService -->|HTTP| UserMgmt
    ExamService -->|HTTP| NotifService
    ExamService -->|HTTP| AIGrading
    SessionMgr -->|HTTP| ExamService
    SessionMgr -->|HTTP| UserMgmt
    AIGrading -->|HTTP| OllamaProxy
    OllamaProxy -->|HTTP| Ollama

    %% Conexiones a MongoDB
    AuthService -->|Mongoose| MongoDB
    UserMgmt -->|Mongoose| MongoDB
    ExamService -->|Mongoose| MongoDB
    SessionMgr -->|Mongoose| MongoDB
    NotifService -->|Mongoose| MongoDB
    AIGrading -->|PyMongo| MongoDB

    %% Conexiones a Redis
    AuthService -->|ioredis| Redis
    UserMgmt -->|ioredis| Redis
    ExamService -->|ioredis| Redis
    SessionMgr -->|ioredis| Redis
    NotifService -->|ioredis| Redis
    AIGrading -->|redis-py| Redis

    %% Conexiones a MinIO
    ExamService -->|MinIO SDK| MinIO

    %% Conexiones a Kafka
    AuthService -->|KafkaJS Producer| Kafka
    UserMgmt -->|KafkaJS Producer/Consumer| Kafka
    ExamService -->|KafkaJS Producer/Consumer| Kafka
    SessionMgr -->|KafkaJS Producer/Consumer| Kafka
    NotifService -->|KafkaJS Producer/Consumer| Kafka

    Kafka -->|Coordinación| Zookeeper

    %% Servicios Externos
    NotifService -->|API REST| ResendAPI

    %% Herramientas
    KafkaUI -->|Monitor| Kafka
    SocketAdmin -->|Monitor| SessionMgr

    %% Estilos
    style Frontend fill:#4fc3f7,stroke:#0277bd,stroke-width:3px,color:#000
    style AuthService fill:#81c784,stroke:#388e3c,stroke-width:2px,color:#000
    style UserMgmt fill:#81c784,stroke:#388e3c,stroke-width:2px,color:#000
    style ExamService fill:#81c784,stroke:#388e3c,stroke-width:2px,color:#000
    style SessionMgr fill:#81c784,stroke:#388e3c,stroke-width:2px,color:#000
    style NotifService fill:#81c784,stroke:#388e3c,stroke-width:2px,color:#000
    style AIGrading fill:#ffb74d,stroke:#f57c00,stroke-width:2px,color:#000
    style OllamaProxy fill:#ffb74d,stroke:#f57c00,stroke-width:2px,color:#000
    style MongoDB fill:#ce93d8,stroke:#7b1fa2,stroke-width:2px,color:#000
    style Redis fill:#ef5350,stroke:#c62828,stroke-width:2px,color:#000
    style MinIO fill:#90caf9,stroke:#1565c0,stroke-width:2px,color:#000
    style Kafka fill:#fff176,stroke:#f57f17,stroke-width:2px,color:#000
    style Zookeeper fill:#fff176,stroke:#f57f17,stroke-width:2px,color:#000
    style Ollama fill:#a5d6a7,stroke:#2e7d32,stroke-width:2px,color:#000
    style ResendAPI fill:#f48fb1,stroke:#c2185b,stroke-width:2px,color:#000
    style KafkaUI fill:#e0e0e0,stroke:#616161,stroke-width:1px,color:#000
    style SocketAdmin fill:#e0e0e0,stroke:#616161,stroke-width:1px,color:#000
```

---

## 2. Flujo de Comunicación entre Servicios

```mermaid
graph LR
    subgraph "Sincrónico (HTTP/REST)"
        A[Frontend] -->|1. Login| B[Auth Service]
        A -->|2. Gestión| C[User Management]
        A -->|3. Exámenes| D[Exam Service]
        A -->|5. Notificaciones| E[Notifications]

        C -->|Validar Token| B
        C -->|Registrar Usuario| B
        D -->|Datos Usuario| C
        D -->|Enviar Email| E
        D -->|Evaluar| F[AI Grading]
        G[Session Manager] -->|Datos Examen| D
        G -->|Datos Usuario| C
        F -->|LLM| H[Ollama]
    end

    subgraph "Asincrónico (Kafka)"
        B -.->|user-events| I[Kafka]
        C -.->|candidate-events| I
        D -.->|exam-events| I
        G -.->|session-events| I
        E -.->|notification-events| I

        I -.->|Consume| B
        I -.->|Consume| C
        I -.->|Consume| D
        I -.->|Consume| G
        I -.->|Consume| E
    end

    subgraph "Tiempo Real (WebSocket)"
        A <-->|Socket.IO| G
        A <-->|Socket.IO| E
    end

    style A fill:#4fc3f7,stroke:#0277bd,stroke-width:2px
    style I fill:#fff176,stroke:#f57f17,stroke-width:2px
```

---

## 3. Arquitectura de Datos

```mermaid
graph TB
    subgraph "Bases de Datos MongoDB"
        DB1[(auth-service DB<br/>users, sessions)]
        DB2[(user-mgmt DB<br/>users, candidates, roles)]
        DB3[(exam-service DB<br/>exams, questions, sessions<br/>attempts, responses, results)]
        DB4[(session-mgr DB<br/>activesessions)]
        DB5[(notifications DB<br/>emails, templates<br/>notifications_inapp)]
        DB6[(ai-grading DB<br/>grading_results)]
    end

    subgraph "Redis Keys"
        R1[auth:session:*<br/>auth:blacklist:*]
        R2[usermgmt:cache:*<br/>usermgmt:session:*]
        R3[exam:cache:*<br/>exam:session:*]
        R4[session:active:*]
        R5[notifications:queue:*<br/>notifications:cache:*]
        R6[ai_grading:*]
    end

    subgraph "MinIO Buckets"
        M1[exam-files/<br/>- question-audio/<br/>- question-images/<br/>- response-audio/]
    end

    AuthSvc[Auth Service] --> DB1
    AuthSvc --> R1

    UserMgmt[User Management] --> DB2
    UserMgmt --> R2

    ExamSvc[Exam Service] --> DB3
    ExamSvc --> R3
    ExamSvc --> M1

    SessionMgr[Session Manager] --> DB4
    SessionMgr --> R4

    NotifSvc[Notifications] --> DB5
    NotifSvc --> R5

    AIGrading[AI Grading] --> DB6
    AIGrading --> R6

    style DB1 fill:#ce93d8,stroke:#7b1fa2
    style DB2 fill:#ce93d8,stroke:#7b1fa2
    style DB3 fill:#ce93d8,stroke:#7b1fa2
    style DB4 fill:#ce93d8,stroke:#7b1fa2
    style DB5 fill:#ce93d8,stroke:#7b1fa2
    style DB6 fill:#ce93d8,stroke:#7b1fa2
    style R1 fill:#ef5350,stroke:#c62828
    style R2 fill:#ef5350,stroke:#c62828
    style R3 fill:#ef5350,stroke:#c62828
    style R4 fill:#ef5350,stroke:#c62828
    style R5 fill:#ef5350,stroke:#c62828
    style R6 fill:#ef5350,stroke:#c62828
    style M1 fill:#90caf9,stroke:#1565c0
```

---

## 4. Arquitectura de Eventos (Kafka)

```mermaid
graph TB
    subgraph "PRODUCERS"
        P1[Auth Service]
        P2[User Management]
        P3[Exam Service]
        P4[Session Manager]
        P5[Notifications]
    end

    subgraph "KAFKA TOPICS"
        T1[user-events]
        T2[candidate-events]
        T3[otp-events]
        T4[exam-events]
        T5[session-events]
        T6[notification-events]
        T7[security-events]
        T8[monitoring-events]
    end

    subgraph "CONSUMERS"
        C1[Auth Service<br/>Group: auth-service-users]
        C2[User Management<br/>Group: user-management-group]
        C3[Exam Service<br/>Group: exam-service]
        C4[Session Manager<br/>Group: session-manager-group]
        C5[Notifications<br/>Group: notifications-group]
    end

    %% Producers
    P1 -->|Publish| T1
    P1 -->|Publish| T3
    P1 -->|Publish| T7

    P2 -->|Publish| T1
    P2 -->|Publish| T2

    P3 -->|Publish| T4
    P3 -->|Publish| T5

    P4 -->|Publish| T5
    P4 -->|Publish| T8

    P5 -->|Publish| T6

    %% Consumers
    T1 -->|Subscribe| C1
    T1 -->|Subscribe| C2
    T1 -->|Subscribe| C5

    T2 -->|Subscribe| C3

    T3 -->|Subscribe| C5

    T4 -->|Subscribe| C4
    T4 -->|Subscribe| C5

    T5 -->|Subscribe| C3
    T5 -->|Subscribe| C5

    T6 -->|Subscribe| C2

    style T1 fill:#fff176,stroke:#f57f17,stroke-width:2px
    style T2 fill:#fff176,stroke:#f57f17,stroke-width:2px
    style T3 fill:#fff176,stroke:#f57f17,stroke-width:2px
    style T4 fill:#fff176,stroke:#f57f17,stroke-width:2px
    style T5 fill:#fff176,stroke:#f57f17,stroke-width:2px
    style T6 fill:#fff176,stroke:#f57f17,stroke-width:2px
    style T7 fill:#fff176,stroke:#f57f17,stroke-width:2px
    style T8 fill:#fff176,stroke:#f57f17,stroke-width:2px
```

### Eventos por Topic

**user-events:**
- USER_CREATED, USER_UPDATED, USER_DELETED
- USER_STATUS_CHANGED, USER_ROLE_CHANGED, USER_PASSWORD_CHANGED
- user.registered, user.logged_in, user.logged_out, user.token_refreshed

**candidate-events:**
- CANDIDATE_REGISTERED, CANDIDATE_UPDATED, CANDIDATE_DELETED
- CANDIDATE_STATUS_CHANGED

**otp-events:**
- otp.generated, otp.verified, otp.expired, otp.revoked

**exam-events:**
- EXAM_CREATED, EXAM_PUBLISHED, EXAM_STARTED, EXAM_FINISHED
- EVALUATION_COMPLETED, RESULT_PUBLISHED

**session-events:**
- SESSION_CREATED, SESSION_STARTED, SESSION_ENDED
- PARTICIPANT_JOINED, SESSION_JOINED, SESSION_LEFT
- ANSWER_SUBMITTED

**notification-events:**
- EMAIL_SENT, EMAIL_FAILED, SMS_SENT, SMS_FAILED

**security-events:**
- auth.failed_login, auth.suspicious_activity, auth.account_locked

**monitoring-events:**
- PARTICIPANT_INACTIVE, SUSPICIOUS_ACTIVITY

---

## 5. Flujos Críticos del Sistema

### 5.1 Flujo de Registro y Login con OTP

```mermaid
sequenceDiagram
    participant U as Usuario
    participant F as Frontend
    participant A as Auth Service
    participant K as Kafka
    participant N as Notifications
    participant R as Resend API

    U->>F: 1. Ingresa email
    F->>A: 2. POST /auth/otp/generate
    A->>A: 3. Genera código 6 dígitos
    A->>Redis: 4. Guarda OTP (TTL: 10min)
    A->>K: 5. Publica otp.generated
    K->>N: 6. Consume evento
    N->>R: 7. Envía email con código
    A-->>F: 8. OTP generado (200 OK)

    U->>F: 9. Ingresa código OTP
    F->>A: 10. POST /auth/otp/verify
    A->>Redis: 11. Valida código
    A->>K: 12. Publica otp.verified
    A->>A: 13. Genera JWT tokens
    A-->>F: 14. Tokens (accessToken, refreshToken)
    F->>F: 15. Guarda en localStorage
    F-->>U: 16. Redirige a dashboard
```

### 5.2 Flujo de Toma de Examen

```mermaid
sequenceDiagram
    participant S as Estudiante
    participant F as Frontend
    participant SM as Session Manager
    participant ES as Exam Service
    participant AI as AI Grading
    participant K as Kafka

    S->>F: 1. Selecciona sesión
    F->>F: 2. Verificación técnica
    F->>SM: 3. WebSocket connect
    SM-->>F: 4. connection established

    F->>SM: 5. join-exam-session
    SM->>ES: 6. GET /sessions/:id
    SM->>ES: 7. POST /exam-taking/start
    ES->>MongoDB: 8. Crea Attempt
    SM-->>F: 9. session-joined + questions

    loop Por cada pregunta
        S->>F: 10. Responde pregunta
        F->>SM: 11. submit-answer (WS)
        SM->>ES: 12. POST /exam-taking/answer
        ES->>MongoDB: 13. Guarda Response
        ES-->>SM: 14. answer saved
        SM-->>F: 15. answer-submitted
    end

    S->>F: 16. Finalizar examen
    F->>SM: 17. finish-exam (WS)
    SM->>ES: 18. POST /exam-taking/finish
    ES->>AI: 19. POST /grading/evaluate-bulk
    AI->>Ollama: 20. Evaluación con LLM
    AI-->>ES: 21. Resultados de evaluación
    ES->>MongoDB: 22. Guarda ExamResult
    ES->>K: 23. Publica EXAM_FINISHED
    K->>N: 24. Envía notificación
    ES-->>SM: 25. exam completed
    SM-->>F: 26. exam-finished + results
    F-->>S: 27. Muestra resultados
```

### 5.3 Flujo de Creación de Pregunta con Multimedia

```mermaid
sequenceDiagram
    participant T as Profesor
    participant F as Frontend
    participant ES as Exam Service
    participant MinIO as MinIO Storage
    participant MongoDB as MongoDB

    T->>F: 1. Crea pregunta + archivo audio
    F->>ES: 2. POST /questions/create-with-media<br/>(multipart/form-data)
    ES->>MinIO: 3. Upload audio file
    MinIO-->>ES: 4. File URL + metadata
    ES->>MongoDB: 5. Guarda Question<br/>(con questionAudio URL)
    ES-->>F: 6. Pregunta creada (201)
    F-->>T: 7. Confirmación
```

---

## 6. Stack Tecnológico

### Backend Services (Node.js/TypeScript)
- **Framework:** Express.js
- **ORM:** Mongoose
- **Validación:** Zod
- **Auth:** JWT (jsonwebtoken)
- **Mensajería:** KafkaJS
- **Caché:** ioredis
- **WebSocket:** Socket.IO
- **Storage:** MinIO SDK
- **Testing:** (pendiente)

### Backend Services (Python)
- **Framework:** FastAPI
- **ORM:** PyMongo
- **IA/ML:**
  - Ollama (LLM local)
  - Whisper (transcripción audio)
  - spaCy (análisis lingüístico)
  - LanguageTool (gramática)
- **Validación:** Pydantic
- **HTTP Client:** aiohttp

### Frontend (React)
- **Framework:** React 19.1.0
- **Bundler:** Vite 7.0.0
- **Routing:** React Router 7.6.3
- **Estado:** Zustand 5.0.6
- **UI:** Radix UI + shadcn/ui
- **Forms:** React Hook Form + Zod
- **HTTP:** Axios
- **WebSocket:** Socket.io-client
- **Styling:** Tailwind CSS 4.1.11

### Infraestructura
- **Base de Datos:** MongoDB 7.x
- **Caché:** Redis 7.x
- **Mensajería:** Apache Kafka + Zookeeper
- **Storage:** MinIO
- **Containerización:** Docker + Docker Compose
- **IA:** Ollama

---

## 7. Puertos y URLs

| Servicio | Puerto | Base URL | Tecnología |
|----------|--------|----------|------------|
| Frontend | 5173 | `/` | React + Vite |
| Auth Service | 3000 | `/auth` | Express + TypeScript |
| Notifications | 3001 | `/notifications` | Express + TypeScript |
| User Management | 3002 | `/api/v1` | Express + TypeScript |
| Exam Service | 3003 | `/api/v1` | Express + TypeScript |
| Session Manager | 3004 | `/api/v1` | Express + TypeScript + Socket.IO |
| AI Grading | 3006 | `/api/v1` | FastAPI + Python |
| Ollama Proxy | 3007 | `/` | FastAPI + Python |
| MongoDB | 27017 | - | MongoDB |
| Redis | 6379 | - | Redis |
| MinIO | 9000 | - | S3-compatible |
| MinIO Console | 9001 | - | Web UI |
| Kafka | 29092 | - | Kafka |
| Zookeeper | 2181 | - | Zookeeper |
| Kafka UI | 8080 | - | Kafka UI (debug) |
| Ollama Server | 11434 | - | Ollama |

---

## 8. Seguridad

### Autenticación
- **Método:** JWT (Access Token + Refresh Token)
- **Algoritmo:** HS256
- **Access Token TTL:** 1 hora
- **Refresh Token TTL:** 7 días
- **OTP TTL:** 10 minutos
- **Storage:** localStorage (frontend), Redis (backend)

### Autorización
- **Roles:** admin, teacher, proctor, student
- **Permisos:** Resource-based (ej: exam.create, user.delete)
- **Validación:** Middleware en cada servicio
- **Inter-service:** Token especial de servicio

### Comunicación
- **HTTP:** Bearer Token en headers
- **WebSocket:** Token en handshake
- **Kafka:** Sin autenticación (red interna)
- **MongoDB:** Usuario/contraseña
- **Redis:** Contraseña

### Rate Limiting
- **Login:** 10 intentos / 15 min
- **OTP Generate:** 3 intentos / 5 min
- **OTP Verify:** 10 intentos / 5 min
- **API General:** 1000 requests / 15 min

---

## 9. Escalabilidad y Resiliencia

### Estrategias Implementadas
✅ Arquitectura de microservicios independientes
✅ Comunicación asíncrona con Kafka
✅ Caché distribuido con Redis
✅ Almacenamiento escalable con MinIO
✅ Sesiones stateless con JWT
✅ WebSocket para tiempo real

### Pendientes de Implementar
⚠️ Load balancer (Nginx/Traefik)
⚠️ API Gateway
⚠️ Circuit breakers
⚠️ Health checks robustos
⚠️ Distributed tracing
⚠️ Centralized logging
⚠️ Service mesh
⚠️ Auto-scaling
⚠️ Replicación de MongoDB
⚠️ Redis Cluster
⚠️ Kafka partitions optimization

---

## 10. Comparación: Original vs Actualizado

### Servicios Agregados ✅
- **AI Grading Service** - Evaluación con IA
- **Ollama Service** - Proxy para LLM local
- **Session Manager Service** - Gestión de sesiones en tiempo real con WebSocket

### Servicios Modificados 🔄
- **Exam Service** - Expandido con:
  - Gestión de preguntas mejorada (12 tipos)
  - Upload multimedia (MinIO)
  - Integración con IA
  - Sistema de intentos y respuestas
  - Exportación de resultados PDF

- **Auth Service** - Agregado:
  - Sistema OTP completo
  - Múltiples propósitos de OTP
  - Rate limiting avanzado
  - Consumer de eventos de user-management

- **User Management Service** - Agregado:
  - Sistema de roles dinámico
  - Importación/exportación masiva
  - Sincronización bidireccional con auth

- **Notifications Service** - Agregado:
  - Notificaciones in-app con Socket.IO
  - Plantillas de email
  - Sistema de cola y reintentos

### Tecnologías Nuevas 🆕
- **Ollama** - LLM local para evaluación con IA
- **MinIO** - Almacenamiento de archivos multimedia
- **Socket.IO** - Comunicación WebSocket bidireccional
- **Whisper** - Transcripción de audio
- **spaCy** - Análisis lingüístico
- **Puppeteer** - Generación de PDFs

### Patrones Implementados 📐
- Event-Driven Architecture (Kafka)
- CQRS (Command Query Responsibility Segregation)
- Repository Pattern
- Service Layer Pattern
- Observer Pattern (WebSocket events)

---

## 11. Monitoreo y Observabilidad

### Implementado ✅
- Kafka UI para monitoreo de mensajes
- Socket.IO Admin UI para WebSocket
- Logs básicos en cada servicio
- Health checks en endpoints `/health`

### Recomendado 📊
- **APM:** New Relic, Datadog, o Elastic APM
- **Logging:** ELK Stack (Elasticsearch, Logstash, Kibana)
- **Tracing:** Jaeger o Zipkin
- **Metrics:** Prometheus + Grafana
- **Alerting:** PagerDuty o Opsgenie

---

## 12. CI/CD y Deployment

### Actual
- Docker Compose para desarrollo local
- Scripts de deployment manual

### Recomendado
- **CI/CD:** GitHub Actions / GitLab CI
- **Container Registry:** Docker Hub / AWS ECR
- **Orchestration:** Kubernetes
- **Cloud:** AWS / GCP / Azure
- **IaC:** Terraform o Pulumi

---

Este diagrama refleja la arquitectura **real implementada** en el proyecto, basada en el análisis del código fuente.
