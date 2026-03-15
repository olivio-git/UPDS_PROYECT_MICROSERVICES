# Diagrama de Componentes del Servicio Auth-Service

```mermaid
graph TD
    subgraph Auth-Service
        A["index.ts"]
        B["Controladores"]
        C["Rutas"]
        D["Middleware"]
        E["Base de Datos"]
        F["Servicios"]
        G["Esquemas"]
        H["Repositorios"]
    end

    A --> B
    A --> C
    A --> D
    A --> F
    C --> D
    C --> F
    F --> H
    F --> E
    G --> C
    G --> F

    subgraph External Systems
        I["Cliente"]
        J["Otros Microservicios"]
    end

    I --> C
    J --> C
    F --> J
```

Este diagrama representa los principales componentes del servicio `auth-service` y sus interacciones. Puedes visualizarlo utilizando cualquier herramienta compatible con Mermaid, como [Mermaid Live Editor](https://mermaid-js.github.io/mermaid-live-editor/).
