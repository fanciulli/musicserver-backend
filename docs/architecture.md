# Music Server – Architecture

The following diagram shows the main building blocks of the server and the relationships between them.

```mermaid
graph TD
    subgraph Clients
        C1[REST Client<br/>Browser / App]
    end

    subgraph Core["Core Server (Fastify)"]
        RC[RouteController]
        MS[MusicServer]
        DB[(MongoDB)]

        subgraph Routes
            direction TB
            R_HZ[GET /healthz]
            R_BR[POST /browse]
            R_SC[POST /scan]
            R_ST[GET /stream]
            R_AA[GET /albumart]
            R_PL[GET /plugins]
            R_PS[POST /plugins/start]
            R_PP[POST /plugins/stop]
        end
    end

    subgraph PluginSystem["Plugin System"]
        PM[PluginManager]

        subgraph MusicSources["Music Source Plugins"]
            FSS[Filesystem<br/>Music Source]
            P2[Future Plugin…]
        end
    end

    C1 -- HTTP --> RC
    RC --> Routes
    MS --> RC
    MS --> DB
    MS --> PM
    PM --> MusicSources
    R_BR --> PM
    R_SC --> PM
    R_ST --> PM
    R_AA --> PM
    R_PL --> PM
    R_PS --> PM
    R_PP --> PM
    FSS --> DB
```

---

- [Introduction](./introduction.md)
- [Building Blocks](./building-blocks.md)
- [API Reference](./api-reference.md)
