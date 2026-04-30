[![Unit Tests](https://github.com/fanciulli/musicserver-backend/actions/workflows/unitTests.yml/badge.svg)](https://github.com/fanciulli/musicserver-backend/actions/workflows/unitTests.yml)

# Music Server – Backend

**Music Server** is a lightweight music streaming server built for broad compatibility.
All client interaction is handled through well-defined **REST APIs**, making it easy to integrate
with any HTTP-capable client — whether a web browser, a mobile app, or a third-party application.

This repository contains the **backend** component of the Music Server project.

---

## Table of Contents

- [Music Server – Backend](#music-server--backend)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [Getting Started](#getting-started)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Running the Server](#running-the-server)
  - [API Reference](#api-reference)
  - [Development](#development)
    - [Build](#build)
    - [Tests](#tests)
  - [Documentation](#documentation)

---

## Overview

From day one, the server is built around the concept of **plugins**.
Every music source is a plugin that can be installed without modifying the core server.
This design allows the server to be expanded with new capabilities simply by dropping a new plugin into the configured plugin folder — no rebuild required.

Key technologies:

| Technology     | Role               |
| -------------- | ------------------ |
| **Fastify**    | HTTP framework     |
| **MongoDB**    | Persistent storage |
| **TypeScript** | Language           |
| **Vitest**     | Unit testing       |
| **Docker**.    | Containerization   |

---

## Getting Started

### Prerequisites

- **Node.js**. We develop Music Server using the latest stable version, please use the same. Current version: [25.9.0](https://nodejs.org/en/blog/release/v25.9.0)
- **MongoDB** instance (local or remote)ì

### Installation

```bash
npm install
```

### Running the Server

```bash
npm run start
```

The server listens on `http://localhost:3000` by default.

---

## API Reference

A machine-readable [OpenAPI 3.0 specification](docs/openapi.yaml) is available.
It can be imported into Swagger UI, Postman, or Insomnia.

See [docs/api-reference.md](docs/api-reference.md) for the full endpoint reference.

---

## Development

### Build

```bash
npm run build
```

Output is placed in the `dist/` directory.

### Tests

```bash
# Run tests
npm test

# Run tests with coverage report
npm run test:coverage
```

---

## Documentation

| Document                                           | Description                     |
| -------------------------------------------------- | ------------------------------- |
| [docs/introduction.md](docs/introduction.md)       | Project overview                |
| [docs/architecture.md](docs/architecture.md)       | Architecture diagram and design |
| [docs/building-blocks.md](docs/building-blocks.md) | Component descriptions          |
| [docs/api-reference.md](docs/api-reference.md)     | REST API reference              |
| [docs/openapi.yaml](docs/openapi.yaml)             | OpenAPI 3.0 specification       |
| [docs/adr/](docs/adr/)                             | Architectural Decision Records  |
