# Music Server – Building Blocks

| Component | Location | Responsibility |
|---|---|---|
| **MusicServer** | `src/server/music_server.ts` | Top-level orchestrator. Boots the database, the Fastify HTTP server, and the plugin system in sequence. |
| **Database** | `src/server/database.ts` | Wraps the MongoDB connection. Initialises all collection models at startup. |
| **RouteController** | `src/routes/routeController.ts` | Iterates over every `Route` instance and registers it with the Fastify instance. |
| **Route (abstract)** | `src/types/route.ts` | Base class for all HTTP handlers. Each concrete route declares its method, URL, optional JSON schema, and `handler` logic. |
| **PluginManager** | `src/plugins/pluginManager.ts` | Discovers plugin directories under `$PLUGIN_DIR`, dynamically imports each `index.js`, persists plugin state in MongoDB, and manages the plugin lifecycle. |
| **Plugin (abstract)** | `src/types/plugins/plugin.ts` | Base class every plugin must extend. Defines `id`, `name`, `category`, `start()`, and `stop()`. |
| **MusicSourcePlugin (abstract)** | `src/types/plugins/music_sources.ts` | Extends `Plugin` with the four music-specific operations: `scan()`, `browse()`, `stream()`, and `getAlbumArt()`. |
| **Filesystem Music Source** | `src/plugins/music_sources/filesystem-music-source/` | Reference plugin implementation. Recursively scans a local directory for audio files, parses metadata with `music-metadata`, stores results in MongoDB, and serves audio streams directly from disk. |
| **MongoDB Collections** | `src/types/db/` | Four collections – `plugins`, `songs`, `albums`, `artists` – hold all persistent state. |
