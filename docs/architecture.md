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
            R_BR[POST /music/browse]
            R_SC[POST /music/scan]
            R_ST[GET /music/stream]
            R_AA[GET /music/albumart]
            R_SE[POST /music/search]
            R_PL[GET /admin/plugins]
            R_PS[POST /admin/plugins/start]
            R_PP[POST /admin/plugins/stop]
            R_CG[GET /admin/plugins/:id/config]
            R_CU[PUT /admin/plugins/:id/config]
            R_LG[GET /admin/logs]
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
    R_SE --> PM
    R_PL --> PM
    R_PS --> PM
    R_PP --> PM
    R_CG --> PM
    R_CU --> PM
    FSS --> DB
```

---

- [← README](../README.md)
- [Introduction](./introduction.md)
- [Building Blocks](./building-blocks.md)
- [API Reference](./api-reference.md)
