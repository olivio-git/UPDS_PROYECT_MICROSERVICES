graph TB
    %% Frontend Layer
    subgraph "FRONTEND - React.js + TypeScript"
        A1[Dashboard Admin<br/>Material-UI/Tailwind]
        A2[Panel Académico<br/>Gestión Exámenes]
        A3[Interface Estudiante<br/>Test Taking UI]
        A4[Panel Proctor<br/>Monitoring Console]
    end

    %% API Gateway
    subgraph "API GATEWAY"
        B1[Nginx + Kong<br/>Rate Limiting<br/>Load Balancer<br/>JWT Validation]
    end

    %% Node.js Microservices (Core Business Logic)
    subgraph "MICROSERVICIOS NODE.JS"
        C1[auth-service<br/>JWT + Roles<br/>Express/Fastify]
        C2[user-management<br/>CRUD Usuarios<br/>Express/Fastify]
        C3[exam-service<br/>CRUD Exámenes<br/>Express/Fastify]
        C4[session-manager<br/>Control Sesiones<br/>Express/Fastify]
        C5[report-generator<br/>PDFs + Analytics<br/>Express/Fastify]
        C6[notification-service<br/>Email/SMS<br/>Express/Fastify]
    end

    %% Python AI/ML Services
    subgraph "SERVICIOS IA - PYTHON"
        D1[ai-grading-service<br/>spaCy + Transformers<br/>FastAPI]
        D2[speech-processor<br/>Whisper Local<br/>FastAPI]
        D3[mcer-engine<br/>Scoring Algorithms<br/>FastAPI]
        D4[question-generator<br/>LLM Integration<br/>FastAPI]
    end

    %% Message Broker
    subgraph "KAFKA CLUSTER"
        K1[Kafka Broker 1<br/>Event Streaming]
        K2[Kafka Broker 2<br/>Load Distribution]
        K3[Zookeeper<br/>Coordination]
    end

    %% Database Layer
    subgraph "BASE DE DATOS"
        E1[(MongoDB Primary<br/>usuarios, exámenes<br/>resultados, sesiones)]
        E2[(Redis<br/>Cache + Sessions<br/>Real-time Data)]
        E3[(MinIO/S3<br/>File Storage<br/>Audio, PDFs)]
    end

    %% External Services
    subgraph "SERVICIOS EXTERNOS"
        F1[SMTP Server<br/>Email Delivery]
        F2[File Import API<br/>Excel/CSV Processing]
        F3[Backup Service<br/>Automated Backups]
    end

    %% Monitoring Stack
    subgraph "MONITOREO"
        G1[ELK Stack<br/>Centralized Logging]
        G2[Prometheus + Grafana<br/>Metrics & Alerts]
        G3[Jaeger<br/>Distributed Tracing]
    end

    %% User Flow
    A1 --> B1
    A2 --> B1
    A3 --> B1
    A4 --> B1

    %% API Gateway to Node.js Services
    B1 --> C1
    B1 --> C2
    B1 --> C3
    B1 --> C4
    B1 --> C5
    B1 --> C6

    %% Kafka Event Flow
    C3 --> K1
    C4 --> K1
    C4 --> K1

    K1 --> D1
    K1 --> D2
    K1 --> D3

    D1 --> K2
    D2 --> K2
    D3 --> K2

    K2 --> C5
    K2 --> C6

    %% Database Connections
    C1 --> E1
    C1 --> E2
    C2 --> E1
    C3 --> E1
    C4 --> E1
    C4 --> E2
    C5 --> E1
    C5 --> E3
    C6 --> E1

    %% Python Services to DB
    D1 --> E1
    D2 --> E3
    D3 --> E1
    D4 --> E1

    %% External Integrations
    C6 --> F1
    C5 --> F2
    E1 --> F3

    %% Monitoring Connections
    C1 -.-> G1
    C2 -.-> G1
    C3 -.-> G1
    C4 -.-> G1
    C5 -.-> G1
    C6 -.-> G1
    D1 -.-> G1
    D2 -.-> G1
    D3 -.-> G1
    D4 -.-> G1

    K1 -.-> G2
    K2 -.-> G2
    E1 -.-> G2
    E2 -.-> G2

    %% Styling
    classDef frontend fill:#61dafb,color:#000,stroke:#000,stroke-width:2px
    classDef nodejs fill:#8cc84b,color:#000,stroke:#000,stroke-width:2px
    classDef python fill:#306998,color:#fff,stroke:#fff,stroke-width:2px
    classDef kafka fill:#ff6600,color:#fff,stroke:#fff,stroke-width:2px
    classDef database fill:#4db33d,color:#fff,stroke:#fff,stroke-width:2px
    classDef external fill:#e91e63,color:#fff,stroke:#fff,stroke-width:2px
    classDef monitoring fill:#795548,color:#fff,stroke:#fff,stroke-width:2px

    class A1,A2,A3,A4 frontend
    class C1,C2,C3,C4,C5,C6 nodejs
    class D1,D2,D3,D4 python
    class K1,K2,K3 kafka
    class E1,E2,E3 database
    class F1,F2,F3 external
    class G1,G2,G3 monitoring