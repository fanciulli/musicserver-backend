# HTTPS Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in HTTPS support to `musicserver-backend` and `musicserver-admin-ui`, with auto-generated self-signed certs when none are provided.

**Architecture:** Both subprojects share the same env var contract (`HTTPS_ENABLED`, `TLS_CERT_PATH`, `TLS_KEY_PATH`) and cert management pattern. The backend wires TLS into Fastify's constructor options; the admin-ui replaces `next start` with a custom Node.js HTTPS server wrapping Next.js's request handler. Certs are generated with `@peculiar/x509` (WebCrypto-based, no native binary deps) and written to a config dir that can be volume-mounted by the user.

**Tech Stack:** Fastify 5, Next.js 16 (standalone), `@peculiar/x509`, Node.js 25, vitest, TypeScript ESM, Docker, pm2-runtime.

---

## File Map

### musicserver-backend

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/tls/tlsManager.ts` | Load env, ensure cert exists, generate self-signed if missing |
| Create | `test/tls/tlsManager.test.ts` | Unit tests for tlsManager |
| Modify | `src/server/musicServer.ts` | Call `loadTlsConfig()` and pass TLS options to Fastify |
| Modify | `package.json` | Add `@peculiar/x509` dependency |
| Modify | `Dockerfile` | Add `mkdir -p /app/dist/config/certs` |

### musicserver-admin-ui

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `src/lib/tls/tlsManager.ts` | Same cert logic as backend |
| Create | `server.ts` (project root) | Custom HTTP/HTTPS Node.js server wrapping Next.js |
| Create | `tsconfig.server.json` | Compile `server.ts` and `src/lib/tls/tlsManager.ts` to JS |
| Modify | `package.json` | Add `@peculiar/x509`; update `start` script |
| Modify | `Dockerfile` | Compile server.ts; copy compiled files; add `mkdir` for certs |

### musicserver (docker-compose)

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `docker-compose.yml` | Add HTTPS env vars and commented cert volume example |

---

## Task 1: Add @peculiar/x509 and create backend tlsManager

**Files:**
- Modify: `musicserver-backend/package.json`
- Create: `musicserver-backend/src/tls/tlsManager.ts`
- Create: `musicserver-backend/test/tls/tlsManager.test.ts`

- [ ] **Step 1: Install @peculiar/x509 in backend**

```bash
cd /path/to/musicserver-backend
npm install @peculiar/x509
```

Expected: `@peculiar/x509` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Write the failing tests**

Create `test/tls/tlsManager.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockAccess = vi.fn();
const mockReadFile = vi.fn();
const mockMkdir = vi.fn();
const mockWriteFile = vi.fn();

vi.mock("node:fs/promises", () => ({
  access: (...args: unknown[]) => mockAccess(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

const mockCreateSelfSigned = vi.fn();

vi.mock("@peculiar/x509", () => ({
  X509CertificateGenerator: {
    createSelfSigned: (...args: unknown[]) => mockCreateSelfSigned(...args),
  },
}));

import { loadTlsConfig } from "../../src/tls/tlsManager.js";

const FAKE_CERT = "-----BEGIN CERTIFICATE-----\nMOCK\n-----END CERTIFICATE-----\n";
const FAKE_KEY = "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n";

describe("loadTlsConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns null when HTTPS_ENABLED is not set", async () => {
    vi.stubEnv("HTTPS_ENABLED", "false");
    const result = await loadTlsConfig();
    expect(result).toBeNull();
  });

  it("returns null when HTTPS_ENABLED is absent", async () => {
    delete process.env.HTTPS_ENABLED;
    const result = await loadTlsConfig();
    expect(result).toBeNull();
  });

  it("loads existing cert and key files when HTTPS_ENABLED=true", async () => {
    vi.stubEnv("HTTPS_ENABLED", "true");
    vi.stubEnv("TLS_CERT_PATH", "/certs/server.crt");
    vi.stubEnv("TLS_KEY_PATH", "/certs/server.key");

    mockAccess.mockResolvedValue(undefined);
    mockReadFile.mockImplementation((path: string) => {
      if (path === "/certs/server.crt") return Promise.resolve(Buffer.from(FAKE_CERT));
      if (path === "/certs/server.key") return Promise.resolve(Buffer.from(FAKE_KEY));
    });

    const result = await loadTlsConfig();

    expect(result).not.toBeNull();
    expect(result!.cert.toString()).toBe(FAKE_CERT);
    expect(result!.key.toString()).toBe(FAKE_KEY);
    expect(mockCreateSelfSigned).not.toHaveBeenCalled();
  });

  it("auto-generates cert when files are missing", async () => {
    vi.stubEnv("HTTPS_ENABLED", "true");
    vi.stubEnv("TLS_CERT_PATH", "/certs/server.crt");
    vi.stubEnv("TLS_KEY_PATH", "/certs/server.key");

    mockAccess.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);

    const fakePrivateKey = {} as CryptoKey;
    vi.stubGlobal("crypto", {
      subtle: {
        generateKey: vi.fn().mockResolvedValue({
          privateKey: fakePrivateKey,
          publicKey: {} as CryptoKey,
        }),
        exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
      },
    });

    mockCreateSelfSigned.mockResolvedValue({
      toString: vi.fn().mockReturnValue(FAKE_CERT),
    });

    const result = await loadTlsConfig();

    expect(result).not.toBeNull();
    expect(mockMkdir).toHaveBeenCalledWith("/certs", { recursive: true });
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
cd /path/to/musicserver-backend
npm test -- test/tls/tlsManager.test.ts
```

Expected: FAIL — `Cannot find module '../../src/tls/tlsManager.js'`

- [ ] **Step 4: Create src/tls/tlsManager.ts**

```typescript
import * as fs from "node:fs/promises";
import path from "node:path";
import * as x509 from "@peculiar/x509";

const DEFAULT_CERT_PATH = "config/certs/server.crt";
const DEFAULT_KEY_PATH = "config/certs/server.key";
const CERT_VALIDITY_DAYS = 825;

export interface TlsConfig {
  key: Buffer;
  cert: Buffer;
}

export async function loadTlsConfig(): Promise<TlsConfig | null> {
  if (process.env.HTTPS_ENABLED !== "true") {
    return null;
  }

  const certPath = process.env.TLS_CERT_PATH ?? DEFAULT_CERT_PATH;
  const keyPath = process.env.TLS_KEY_PATH ?? DEFAULT_KEY_PATH;

  return ensureCert(certPath, keyPath);
}

async function ensureCert(certPath: string, keyPath: string): Promise<TlsConfig> {
  try {
    await fs.access(certPath);
    await fs.access(keyPath);
    const cert = await fs.readFile(certPath);
    const key = await fs.readFile(keyPath);
    return { cert, key };
  } catch {
    console.warn(
      `[TLS] Cert not found at ${certPath}. Generating self-signed certificate.`
    );
    return generateAndPersist(certPath, keyPath);
  }
}

async function generateAndPersist(certPath: string, keyPath: string): Promise<TlsConfig> {
  const alg: RsaHashedKeyGenParams = {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256",
    publicExponent: new Uint8Array([1, 0, 1]),
    modulusLength: 2048,
  };

  const keys = await crypto.subtle.generateKey(alg, true, ["sign", "verify"]);

  const notBefore = new Date();
  const notAfter = new Date(Date.now() + CERT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

  const cert = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=musicserver",
    notBefore,
    notAfter,
    signingAlgorithm: alg,
    keys,
  });

  const certPem = cert.toString("pem");

  const pkcs8Der = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
  const b64 = Buffer.from(pkcs8Der).toString("base64");
  const lines = b64.match(/.{1,64}/g)!.join("\n");
  const keyPem = `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`;

  const certDir = path.dirname(certPath);
  try {
    await fs.mkdir(certDir, { recursive: true });
    await fs.writeFile(certPath, certPem, { encoding: "utf8" });
    await fs.writeFile(keyPath, keyPem, { encoding: "utf8" });
  } catch (err) {
    console.error(`[TLS] Cannot write cert to ${certPath}: ${err}`);
    process.exit(1);
  }

  return { cert: Buffer.from(certPem), key: Buffer.from(keyPem) };
}
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd /path/to/musicserver-backend
npm test -- test/tls/tlsManager.test.ts
```

Expected: PASS — 4 tests passing.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/tls/tlsManager.ts test/tls/tlsManager.test.ts
git commit -m "feat(tls): add tlsManager with self-signed cert auto-generation"
```

---

## Task 2: Wire TLS into Fastify (backend)

**Files:**
- Modify: `musicserver-backend/src/server/musicServer.ts`

- [ ] **Step 1: Update #startFastify in musicServer.ts**

Replace the `#startFastify` method with:

```typescript
async #startFastify() {
  const logger = createDatabaseLogger("fastify", this.#database!.client!);
  const tlsConfig = await loadTlsConfig();

  this.#fastifyInstance = fastify({
    loggerInstance: logger,
    ...(tlsConfig ? { https: tlsConfig } : {}),
  }) as unknown as FastifyInstance;

  const context = new Context(
    this.#logger!,
    this.#pluginManager!,
    this.#database!.client!,
  );
  const rc = new RouteController(this.#logger!, context);
  await rc.registerRoutes(this.#fastifyInstance);

  this.#fastifyInstance!.listen({ port: 3000, host: "0.0.0.0" }, (err) => {
    if (err) {
      this.#fastifyInstance!.log.error(err);
      process.exit(1);
    }
  });
}
```

Add the import at the top of `musicServer.ts`:

```typescript
import { loadTlsConfig } from "../tls/tlsManager.js";
```

- [ ] **Step 2: Run all tests**

```bash
cd /path/to/musicserver-backend
npm test
```

Expected: PASS — all existing tests plus the new tlsManager tests.

- [ ] **Step 3: Commit**

```bash
git add src/server/musicServer.ts
git commit -m "feat(tls): wire TLS config into Fastify server"
```

---

## Task 3: Update backend Dockerfile

**Files:**
- Modify: `musicserver-backend/Dockerfile`

- [ ] **Step 1: Add cert directory creation to Dockerfile**

In the `runtime` stage, after `RUN mkdir -p /app/dist/logs`, add:

```dockerfile
RUN mkdir -p /app/dist/config/certs
```

The full runtime stage should look like:

```dockerfile
FROM node:25-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g pm2

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

WORKDIR /app/dist

RUN mkdir -p /app/dist/logs
RUN mkdir -p /app/dist/config/certs

EXPOSE 3000

CMD ["pm2-runtime", "start", "index.js", "--name", "musicserver", "--instances", "1"]
```

- [ ] **Step 2: Build the Docker image to verify**

```bash
cd /path/to/musicserver-backend
docker build -t musicserver-backend:tls-test .
```

Expected: BUILD SUCCESS.

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat(tls): create cert dir in Docker image"
```

---

## Task 4: Add @peculiar/x509 and create admin-ui tlsManager

**Files:**
- Modify: `musicserver-admin-ui/package.json`
- Create: `musicserver-admin-ui/src/lib/tls/tlsManager.ts`

- [ ] **Step 1: Install @peculiar/x509 in admin-ui**

```bash
cd /path/to/musicserver-admin-ui
npm install @peculiar/x509
```

Expected: `@peculiar/x509` appears in `dependencies` in `package.json`.

- [ ] **Step 2: Create src/lib/tls/tlsManager.ts**

```typescript
import * as fs from "node:fs/promises";
import path from "node:path";
import * as x509 from "@peculiar/x509";

const DEFAULT_CERT_PATH = "config/certs/server.crt";
const DEFAULT_KEY_PATH = "config/certs/server.key";
const CERT_VALIDITY_DAYS = 825;

export interface TlsConfig {
  key: Buffer;
  cert: Buffer;
}

export async function loadTlsConfig(): Promise<TlsConfig | null> {
  if (process.env.HTTPS_ENABLED !== "true") {
    return null;
  }

  const certPath = process.env.TLS_CERT_PATH ?? DEFAULT_CERT_PATH;
  const keyPath = process.env.TLS_KEY_PATH ?? DEFAULT_KEY_PATH;

  return ensureCert(certPath, keyPath);
}

async function ensureCert(certPath: string, keyPath: string): Promise<TlsConfig> {
  try {
    await fs.access(certPath);
    await fs.access(keyPath);
    const cert = await fs.readFile(certPath);
    const key = await fs.readFile(keyPath);
    return { cert, key };
  } catch {
    console.warn(
      `[TLS] Cert not found at ${certPath}. Generating self-signed certificate.`
    );
    return generateAndPersist(certPath, keyPath);
  }
}

async function generateAndPersist(certPath: string, keyPath: string): Promise<TlsConfig> {
  const alg: RsaHashedKeyGenParams = {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256",
    publicExponent: new Uint8Array([1, 0, 1]),
    modulusLength: 2048,
  };

  const keys = await crypto.subtle.generateKey(alg, true, ["sign", "verify"]);

  const notBefore = new Date();
  const notAfter = new Date(Date.now() + CERT_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

  const cert = await x509.X509CertificateGenerator.createSelfSigned({
    serialNumber: "01",
    name: "CN=musicserver",
    notBefore,
    notAfter,
    signingAlgorithm: alg,
    keys,
  });

  const certPem = cert.toString("pem");

  const pkcs8Der = await crypto.subtle.exportKey("pkcs8", keys.privateKey);
  const b64 = Buffer.from(pkcs8Der).toString("base64");
  const lines = b64.match(/.{1,64}/g)!.join("\n");
  const keyPem = `-----BEGIN PRIVATE KEY-----\n${lines}\n-----END PRIVATE KEY-----\n`;

  const certDir = path.dirname(certPath);
  try {
    await fs.mkdir(certDir, { recursive: true });
    await fs.writeFile(certPath, certPem, { encoding: "utf8" });
    await fs.writeFile(keyPath, keyPem, { encoding: "utf8" });
  } catch (err) {
    console.error(`[TLS] Cannot write cert to ${certPath}: ${err}`);
    process.exit(1);
  }

  return { cert: Buffer.from(certPem), key: Buffer.from(keyPem) };
}
```

- [ ] **Step 3: Verify TypeScript compilation**

```bash
cd /path/to/musicserver-admin-ui
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /path/to/musicserver-admin-ui
git add package.json package-lock.json src/lib/tls/tlsManager.ts
git commit -m "feat(tls): add tlsManager with self-signed cert auto-generation"
```

---

## Task 5: Create custom server.ts for admin-ui

**Files:**
- Create: `musicserver-admin-ui/server.ts`
- Create: `musicserver-admin-ui/tsconfig.server.json`

- [ ] **Step 1: Create tsconfig.server.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": ".",
    "rootDir": ".",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": [
    "server.ts",
    "src/lib/tls/tlsManager.ts"
  ]
}
```

- [ ] **Step 2: Create server.ts**

```typescript
import { createServer as createHttpsServer } from "node:https";
import { createServer as createHttpServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { loadTlsConfig } from "./src/lib/tls/tlsManager.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = parseInt(process.env.PORT ?? "3001", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

await app.prepare();

const tlsConfig = await loadTlsConfig();

const requestHandler = async (
  req: Parameters<typeof handle>[0],
  res: Parameters<typeof handle>[1]
) => {
  try {
    const parsedUrl = parse(req!.url!, true);
    await handle(req, res, parsedUrl);
  } catch (err) {
    console.error("Error handling request", req!.url, err);
    res!.statusCode = 500;
    res!.end("internal server error");
  }
};

if (tlsConfig) {
  createHttpsServer(tlsConfig, requestHandler).listen(port, hostname, () => {
    console.log(`> Ready on https://${hostname}:${port}`);
  });
} else {
  createHttpServer(requestHandler).listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
}
```

- [ ] **Step 3: Compile server.ts to verify no TypeScript errors**

```bash
cd /path/to/musicserver-admin-ui
npx tsc -p tsconfig.server.json
```

Expected: Produces `server.js` and `src/lib/tls/tlsManager.js` with no errors. Clean up with `rm server.js src/lib/tls/tlsManager.js`.

- [ ] **Step 4: Commit**

```bash
git add server.ts tsconfig.server.json
git commit -m "feat(tls): add custom HTTPS server for Next.js"
```

---

## Task 6: Update admin-ui package.json start script and Dockerfile

**Files:**
- Modify: `musicserver-admin-ui/package.json`
- Modify: `musicserver-admin-ui/Dockerfile`

- [ ] **Step 1: Update start script in package.json**

Change the `start` script from:

```json
"start": "next start -p 3001"
```

to:

```json
"start": "node server.js"
```

- [ ] **Step 2: Update Dockerfile**

Replace the entire Dockerfile with:

```dockerfile
FROM node:25-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build
RUN npx tsc -p tsconfig.server.json

FROM node:25-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN npm install -g pm2

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/src/lib/tls ./src/lib/tls/

RUN mkdir -p /app/config/certs

EXPOSE 3001

CMD ["pm2-runtime", "server.js"]
```

Key changes vs original:
- Builder stage: adds `RUN npx tsc -p tsconfig.server.json` after `npm run build`
- Runner stage: adds `COPY --from=builder /app/server.js ./server.js` (overwrites standalone's server.js with custom one)
- Runner stage: adds `COPY --from=builder /app/src/lib/tls ./src/lib/tls/`
- Runner stage: adds `RUN mkdir -p /app/config/certs`

- [ ] **Step 3: Build Docker image to verify**

```bash
cd /path/to/musicserver-admin-ui
docker build -t musicserver-admin-ui:tls-test .
```

Expected: BUILD SUCCESS.

- [ ] **Step 4: Commit**

```bash
git add package.json Dockerfile
git commit -m "feat(tls): update start script and Dockerfile for custom HTTPS server"
```

---

## Task 7: Update docker-compose.yml

**Files:**
- Modify: `musicserver/docker-compose.yml`

- [ ] **Step 1: Update docker-compose.yml**

Replace the file content with:

```yaml
services:
  musicserver-backend:
    image: ghcr.io/fanciulli/musicserver-backend:latest
    container_name: backend
    ports:
      - "3000:3000"
    volumes:
      - "/Volumes/My Passport/Musica:/data/music"
      # Mount a host directory containing server.crt and server.key to enable HTTPS:
      # - /path/to/your/certs:/app/dist/config/certs
    environment:
      - MONGO_URI=mongodb://music-server-mongo:27017
      - HTTPS_ENABLED=false
      - TLS_CERT_PATH=/app/dist/config/certs/server.crt
      - TLS_KEY_PATH=/app/dist/config/certs/server.key
    restart: unless-stopped

  musicserver-admin-ui:
    image: ghcr.io/fanciulli/musicserver-admin-ui:latest
    container_name: admin-ui
    ports:
      - "3001:3001"
    volumes:
      # Mount a host directory containing server.crt and server.key to enable HTTPS:
      # - /path/to/your/certs:/app/config/certs
    environment:
      - MUSICSERVER_API_BASE_URL=http://musicserver-backend:3000
      # When HTTPS_ENABLED=true on backend, change the above to:
      # - MUSICSERVER_API_BASE_URL=https://musicserver-backend:3000
      - HTTPS_ENABLED=false
      - TLS_CERT_PATH=/app/config/certs/server.crt
      - TLS_KEY_PATH=/app/config/certs/server.key
    restart: unless-stopped

  music-server-mongo:
    image: mongo:7.0
    container_name: mongodb
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db
    restart: unless-stopped

volumes:
  mongo_data:
```

- [ ] **Step 2: Validate compose file**

```bash
cd /path/to/musicserver
docker compose config
```

Expected: Prints the resolved config with no errors.

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(tls): add HTTPS env vars and cert volume comments to docker-compose"
```

---

## Verification

After all tasks complete:

- [ ] **Backend HTTP mode**: `HTTPS_ENABLED=false npm start` → server starts, `curl http://localhost:3000/healthz` responds.
- [ ] **Backend HTTPS mode**: `HTTPS_ENABLED=true npm start` → cert generated at `config/certs/`, `curl -k https://localhost:3000/healthz` responds.
- [ ] **Admin-UI HTTP mode**: `HTTPS_ENABLED=false npm start` → server starts on port 3001.
- [ ] **Admin-UI HTTPS mode**: `HTTPS_ENABLED=true npm start` → cert generated, `https://localhost:3001` accessible (accept self-signed warning).
- [ ] **All backend tests pass**: `npm test` in `musicserver-backend`.
