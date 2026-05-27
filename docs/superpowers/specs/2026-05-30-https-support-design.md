# HTTPS Support Design

**Date:** 2026-05-30  
**Scope:** `musicserver-backend`, `musicserver-admin-ui`, `musicserver/docker-compose.yml`

---

## Overview

Add opt-in HTTPS support to both subprojects. When enabled, HTTP is disabled entirely. Certificates can be user-provided or auto-generated as self-signed on startup.

---

## Configuration

Both subprojects use identical env vars:

| Variable | Default | Description |
|---|---|---|
| `HTTPS_ENABLED` | `false` | Set to `true` to enable HTTPS |
| `TLS_CERT_PATH` | `config/certs/server.crt` | Path to PEM certificate |
| `TLS_KEY_PATH` | `config/certs/server.key` | Path to PEM private key |

HTTPS is disabled by default. HTTP and HTTPS share the same port (`3000` backend, `3001` admin-ui).

---

## Architecture

### Shared Pattern

Each subproject gets a `tlsManager` module with:

- `loadTlsConfig(): Promise<{ key: Buffer, cert: Buffer } | null>` — returns `null` if `HTTPS_ENABLED !== 'true'`
- `ensureCert(certPath, keyPath)` — loads existing cert files, or generates self-signed if missing
- `generateSelfSigned()` — RSA-2048 + SHA-256, CN=`musicserver`, validity 825 days, using `@peculiar/x509`

Cert directory is created recursively if it does not exist.

### Backend (`musicserver-backend`)

- New module: `src/tls/tlsManager.ts`
- `musicServer.ts` calls `loadTlsConfig()` in `#startFastify()`
- If HTTPS: passes `{ https: { key, cert } }` to `fastify()` constructor
- If HTTP: `fastify()` called as today, no change
- Port stays `3000` in both modes

### Admin-UI (`musicserver-admin-ui`)

- New module: `src/lib/tls/tlsManager.ts` (same logic as backend)
- New file: `server.ts` (project root) — custom Node.js server replacing `next start`
  - Calls `loadTlsConfig()`
  - HTTPS: `https.createServer({ key, cert }, nextHandler).listen(3001)`
  - HTTP: `http.createServer(nextHandler).listen(3001)`
- `package.json` `start` script: `node server.js` (compiled from `server.ts`)
- Port stays `3001` in both modes

### Dependency

`@peculiar/x509` added to both `package.json`.

---

## Docker

### `docker-compose.yml` changes

- Add env vars to both services with commented example for user-provided certs:
  ```yaml
  environment:
    - HTTPS_ENABLED=false
    - TLS_CERT_PATH=/app/config/certs/server.crt
    - TLS_KEY_PATH=/app/config/certs/server.key
  ```
- Add commented volume mount example:
  ```yaml
  # volumes:
  #   - /path/to/your/certs:/app/config/certs
  ```
- `MUSICSERVER_API_BASE_URL` updated with commented HTTPS example
- Port mappings unchanged: `3000:3000` and `3001:3001`

### Cert persistence in Docker

- If no volume mounted: auto-generated cert lives inside container, lost on restart (ephemeral, acceptable for dev)
- If user mounts host dir: cert persists across restarts

### Dockerfile changes (both)

Add `RUN mkdir -p /app/config/certs` so the dir exists even without a volume mount.

---

## Error Handling

| Condition | Behavior |
|---|---|
| Cert dir missing | Create recursively, then generate cert |
| Cert write fails (permissions) | Log error, `process.exit(1)`: `"HTTPS enabled but cannot write cert to <path>"` |
| Cert exists but corrupt/unreadable | Log error, `process.exit(1)`: `"TLS cert at <path> is invalid"` |
| `HTTPS_ENABLED=true`, path vars absent | Use defaults, attempt auto-generation |

---

## Testing

- Unit tests for `tlsManager`:
  - Mock filesystem: verify cert generated when files missing
  - Mock filesystem: verify existing cert loaded without regeneration
  - Simulate corrupt cert file: verify expected error thrown
- Existing test suites run in HTTP mode — no changes needed

---

## Out of Scope

- HTTP-to-HTTPS redirect
- Let's Encrypt / ACME integration
- mTLS / client certificate auth
- Changes to auth logic, routes, or API key handling
