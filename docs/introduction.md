# Music Server – Introduction

**Music Server** is a lightweight, self-hosted music streaming server built for broad compatibility.
All client interaction is handled through well-defined **REST APIs**, making it easy to integrate
with any HTTP-capable client — whether a web browser, a mobile app, or a third-party application.

From day one, the server is built around the concept of **plugins**.
Every music source is a plugin that can be added at runtime without modifying the core server.
This design allows the server to be expanded with new capabilities simply by dropping a new plugin
directory into the configured plugin folder — no rebuild required.

---

## Environment Variables

| Variable    | Required | Default                     | Description               |
| ----------- | -------- | --------------------------- | ------------------------- |
| `MONGO_URI` | No       | `mongodb://localhost:27017` | MongoDB connection string |

---

- [← README](../README.md)
- [Architecture](./architecture.md)
- [Building Blocks](./building-blocks.md)
- [API Reference](./api-reference.md)
