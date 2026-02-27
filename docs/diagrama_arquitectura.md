# Diagrama de Arquitectura del Sistema

```mermaid
graph TD
    subgraph Infraestructura
        Zookeeper["Zookeeper"]
        Kafka["Kafka"]
        Redis["Redis"]
        Mongo["MongoDB"]
        Minio["MinIO"]
    end

    subgraph Servicios
        AuthService["Auth Service"]
        UserManagementService["User Management Service"]
        NotificationService["Notification Service"]
        ExamService["Exam Service"]
        SessionManagerService["Session Manager Service"]
        AIGardingService["AI Grading Service"]
    end

    subgraph Herramientas
        KafkaUI["Kafka UI"]
        BullDashboard["Bull Dashboard"]
    end

    Zookeeper --> Kafka
    Redis --> AuthService
    Redis --> UserManagementService
    Redis --> NotificationService
    Redis --> ExamService
    Redis --> SessionManagerService
    Redis --> AIGardingService

    Mongo --> AuthService
    Mongo --> UserManagementService
    Mongo --> NotificationService
    Mongo --> ExamService
    Mongo --> SessionManagerService
    Mongo --> AIGardingService

    Minio --> ExamService

    AuthService --> UserManagementService
    AuthService --> NotificationService
    AuthService --> ExamService
    AuthService --> SessionManagerService

    UserManagementService --> ExamService
    UserManagementService --> SessionManagerService

    NotificationService --> ExamService
    NotificationService --> SessionManagerService

    ExamService --> SessionManagerService

    Kafka --> AuthService
    Kafka --> UserManagementService
    Kafka --> NotificationService
    Kafka --> ExamService
    Kafka --> SessionManagerService
    Kafka --> AIGardingService

    KafkaUI --> Kafka
    BullDashboard --> Redis
```

Este diagrama representa la arquitectura general del sistema, mostrando las dependencias entre los servicios y las tecnologías utilizadas. Puedes visualizarlo utilizando cualquier herramienta compatible con Mermaid, como [Mermaid Live Editor](https://mermaid-js.github.io/mermaid-live-editor/).
