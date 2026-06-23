# Music Server Configurability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Settings section to view/edit Music Server configuration parameters, persisted in MongoDB, exposed via token-protected `GET`/`PUT /admin/config` and rendered in the Admin UI (string→text, boolean→toggle, `40x`→error modal).

**Architecture:** Backend defines a config *registry* (single source of truth for key/label/type/default/validation), a `serverConfig` Mongo collection (one doc per key), and a `configService` that merges registry+storage for reads and validates+persists for writes. Two route classes mirror the existing `pluginConfigGet`/`pluginConfigUpdate` pair. The Admin UI adds a sidebar item, a BFF proxy route, and a client Settings form that mirrors the existing `plugins-card` config-modal pattern.

**Tech Stack:** Backend — TypeScript, Fastify, MongoDB driver, Vitest. UI — Next.js (App Router), React 19, Tailwind. No UI test infra exists; UI tasks verify with `npm run build` + `npm run lint`.

**Two repos:**
- Backend: `/Users/massimilianofanciulli/Sviluppo/Volumio/MusicServer/musicserver-backend` (Tasks 1–7)
- Admin UI: `/Users/massimilianofanciulli/Sviluppo/Volumio/MusicServer/musicserver-admin-ui` (Tasks 8–11)

Run backend commands from the backend repo, UI commands from the UI repo.

---

## File Structure

**Backend (create):**
- `src/misc/configRegistry.ts` — registry definitions + validators (source of truth)
- `src/types/db/serverConfig.ts` — Mongo model, collection `serverConfig`
- `src/utils/configService.ts` — merge (read) + validate/persist (write)
- `src/types/api/config.ts` — Fastify schemas + response types
- `src/routes/admin/configGet.ts` — `GET /admin/config`
- `src/routes/admin/configUpdate.ts` — `PUT /admin/config`
- Tests: `test/misc/configRegistry.test.ts`, `test/types/db/serverConfig.test.ts`, `test/utils/configService.test.ts`, `test/routes/config.test.ts`

**Admin UI (create/modify):**
- Create: `src/app/api/admin/config/route.ts` — BFF GET+PUT proxy
- Modify: `src/components/Layouts/sidebar/data/index.ts` — add Settings nav item
- Create: `src/app/(admin)/settings/page.tsx` + `src/app/(admin)/settings/_components/settings-form.tsx`

---

## Task 1: Config registry

**Files:**
- Create: `src/misc/configRegistry.ts`
- Test: `test/misc/configRegistry.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/misc/configRegistry.test.ts`:

```typescript
/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, expect, it } from "vitest";
import {
  CONFIG_REGISTRY,
  getDefinition,
  getAllDefinitions,
} from "../../src/misc/configRegistry.js";

describe("configRegistry", () => {
  it("seeds one string and one boolean test parameter", () => {
    const keys = getAllDefinitions().map((d) => d.key).sort();
    expect(keys).toEqual(["test.boolean", "test.string"]);
    expect(getDefinition("test.string")?.type).toBe("string");
    expect(getDefinition("test.boolean")?.type).toBe("boolean");
  });

  it("returns undefined for an unknown key", () => {
    expect(getDefinition("nope.missing")).toBeUndefined();
  });

  it("test.string rejects empty/non-string and accepts non-empty", () => {
    const def = getDefinition("test.string")!;
    expect(def.validate("hello")).toBeNull();
    expect(def.validate("")).toBe("Test String must not be empty");
    expect(def.validate(123)).toBe("Test String must be a string");
  });

  it("test.boolean accepts booleans and rejects non-boolean", () => {
    const def = getDefinition("test.boolean")!;
    expect(def.validate(true)).toBeNull();
    expect(def.validate(false)).toBeNull();
    expect(def.validate("true")).toBe("Test Boolean must be a boolean");
  });

  it("exposes registry as the same array reference via getAllDefinitions", () => {
    expect(getAllDefinitions()).toBe(CONFIG_REGISTRY);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/misc/configRegistry.test.ts`
Expected: FAIL — cannot find module `../../src/misc/configRegistry.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/misc/configRegistry.ts`:

```typescript
/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
export type ConfigType = "string" | "boolean";

export type ConfigValue = string | boolean;

export interface ConfigParamDefinition {
  key: string;
  label: string;
  type: ConfigType;
  defaultValue: ConfigValue;
  // Returns an error message if the value is invalid, or null if valid.
  validate: (value: unknown) => string | null;
}

export const CONFIG_REGISTRY: ConfigParamDefinition[] = [
  {
    key: "test.string",
    label: "Test String",
    type: "string",
    defaultValue: "",
    validate: (value: unknown): string | null => {
      if (typeof value !== "string") {
        return "Test String must be a string";
      }
      if (value.trim().length === 0) {
        return "Test String must not be empty";
      }
      return null;
    },
  },
  {
    key: "test.boolean",
    label: "Test Boolean",
    type: "boolean",
    defaultValue: false,
    validate: (value: unknown): string | null => {
      if (typeof value !== "boolean") {
        return "Test Boolean must be a boolean";
      }
      return null;
    },
  },
];

export function getAllDefinitions(): ConfigParamDefinition[] {
  return CONFIG_REGISTRY;
}

export function getDefinition(
  key: string,
): ConfigParamDefinition | undefined {
  return CONFIG_REGISTRY.find((d) => d.key === key);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/misc/configRegistry.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/misc/configRegistry.ts test/misc/configRegistry.test.ts
git commit -m "feat: add server config registry with test params (#101)"
```

---

## Task 2: ServerConfig DB model

**Files:**
- Create: `src/types/db/serverConfig.ts`
- Test: `test/types/db/serverConfig.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/types/db/serverConfig.test.ts`:

```typescript
/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ServerConfigDBModel } from "../../../src/types/db/serverConfig.js";

describe("ServerConfigDBModel", () => {
  let collectionMock: {
    find: ReturnType<typeof vi.fn>;
    updateOne: ReturnType<typeof vi.fn>;
  };
  let dbMock: { collection: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    collectionMock = {
      find: vi.fn(),
      updateOne: vi.fn().mockResolvedValue(undefined),
    };
    dbMock = {
      collection: vi.fn().mockReturnValue(collectionMock),
    };
  });

  it("findAll returns all stored config documents", async () => {
    const docs = [
      { key: "test.string", value: "hello" },
      { key: "test.boolean", value: true },
    ];
    collectionMock.find.mockReturnValue({
      toArray: vi.fn().mockResolvedValue(docs),
    });

    const result = await ServerConfigDBModel.findAll(dbMock as any);

    expect(dbMock.collection).toHaveBeenCalledWith("serverConfig");
    expect(collectionMock.find).toHaveBeenCalledWith({});
    expect(result).toEqual(docs);
  });

  it("upsertMany upserts each entry by key", async () => {
    await ServerConfigDBModel.upsertMany(dbMock as any, [
      { key: "test.string", value: "hi" },
      { key: "test.boolean", value: false },
    ]);

    expect(dbMock.collection).toHaveBeenCalledWith("serverConfig");
    expect(collectionMock.updateOne).toHaveBeenCalledTimes(2);
    expect(collectionMock.updateOne).toHaveBeenNthCalledWith(
      1,
      { key: "test.string" },
      { $set: { key: "test.string", value: "hi" } },
      { upsert: true },
    );
    expect(collectionMock.updateOne).toHaveBeenNthCalledWith(
      2,
      { key: "test.boolean" },
      { $set: { key: "test.boolean", value: false } },
      { upsert: true },
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/types/db/serverConfig.test.ts`
Expected: FAIL — cannot find module `serverConfig.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/types/db/serverConfig.ts`:

```typescript
/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";
import type { ConfigValue } from "../../misc/configRegistry.js";

const COLLECTION_NAME = "serverConfig";

export interface ServerConfigEntry {
  key: string;
  value: ConfigValue;
}

export class ServerConfigDBModel {
  static async findAll(db: Db): Promise<ServerConfigEntry[]> {
    const collection = db.collection<ServerConfigEntry>(COLLECTION_NAME);
    return collection.find({}).toArray();
  }

  static async upsertMany(
    db: Db,
    entries: ServerConfigEntry[],
  ): Promise<void> {
    const collection = db.collection<ServerConfigEntry>(COLLECTION_NAME);
    for (const entry of entries) {
      await collection.updateOne(
        { key: entry.key },
        { $set: { key: entry.key, value: entry.value } },
        { upsert: true },
      );
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/types/db/serverConfig.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/types/db/serverConfig.ts test/types/db/serverConfig.test.ts
git commit -m "feat: add serverConfig Mongo model (#101)"
```

---

## Task 3: Config service

**Files:**
- Create: `src/utils/configService.ts`
- Test: `test/utils/configService.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/utils/configService.test.ts`:

```typescript
/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAll: vi.fn(),
  upsertMany: vi.fn(),
}));

vi.mock("../../src/types/db/serverConfig.js", () => ({
  ServerConfigDBModel: {
    findAll: (...args: unknown[]) => mocks.findAll(...args),
    upsertMany: (...args: unknown[]) => mocks.upsertMany(...args),
  },
}));

import { getConfig, updateConfig } from "../../src/utils/configService.js";

describe("configService.getConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsertMany.mockResolvedValue(undefined);
  });

  it("merges stored values over defaults and includes label+type", async () => {
    mocks.findAll.mockResolvedValue([{ key: "test.string", value: "stored" }]);

    const result = await getConfig("db" as any);

    expect(result).toEqual([
      {
        key: "test.string",
        label: "Test String",
        type: "string",
        value: "stored",
      },
      {
        key: "test.boolean",
        label: "Test Boolean",
        type: "boolean",
        value: false,
      },
    ]);
  });

  it("falls back to default when a key is not stored", async () => {
    mocks.findAll.mockResolvedValue([]);

    const result = await getConfig("db" as any);

    expect(result.find((e) => e.key === "test.string")?.value).toBe("");
    expect(result.find((e) => e.key === "test.boolean")?.value).toBe(false);
  });
});

describe("configService.updateConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findAll.mockResolvedValue([]);
    mocks.upsertMany.mockResolvedValue(undefined);
  });

  it("rejects an unknown key without persisting", async () => {
    const result = await updateConfig("db" as any, { "bad.key": "x" });

    expect(result).toEqual({ error: "Unknown configuration key: bad.key" });
    expect(mocks.upsertMany).not.toHaveBeenCalled();
  });

  it("returns the validation error for an invalid value without persisting", async () => {
    const result = await updateConfig("db" as any, { "test.string": "" });

    expect(result).toEqual({ error: "Test String must not be empty" });
    expect(mocks.upsertMany).not.toHaveBeenCalled();
  });

  it("persists valid values and returns the merged config", async () => {
    mocks.findAll.mockResolvedValue([{ key: "test.string", value: "ok" }]);

    const result = await updateConfig("db" as any, {
      "test.string": "ok",
      "test.boolean": true,
    });

    expect(mocks.upsertMany).toHaveBeenCalledWith("db", [
      { key: "test.string", value: "ok" },
      { key: "test.boolean", value: true },
    ]);
    expect(result).toEqual([
      { key: "test.string", label: "Test String", type: "string", value: "ok" },
      {
        key: "test.boolean",
        label: "Test Boolean",
        type: "boolean",
        value: false,
      },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/utils/configService.test.ts`
Expected: FAIL — cannot find module `configService.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/utils/configService.ts`:

```typescript
/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import type { Db } from "mongodb";
import {
  getAllDefinitions,
  getDefinition,
  type ConfigType,
  type ConfigValue,
} from "../misc/configRegistry.js";
import { ServerConfigDBModel } from "../types/db/serverConfig.js";

export interface ConfigItem {
  key: string;
  label: string;
  type: ConfigType;
  value: ConfigValue;
}

export interface ConfigUpdateError {
  error: string;
}

export async function getConfig(db: Db): Promise<ConfigItem[]> {
  const stored = await ServerConfigDBModel.findAll(db);
  const storedByKey = new Map(stored.map((e) => [e.key, e.value]));

  return getAllDefinitions().map((def) => ({
    key: def.key,
    label: def.label,
    type: def.type,
    value: storedByKey.has(def.key)
      ? (storedByKey.get(def.key) as ConfigValue)
      : def.defaultValue,
  }));
}

export async function updateConfig(
  db: Db,
  values: Record<string, unknown>,
): Promise<ConfigItem[] | ConfigUpdateError> {
  const entries: { key: string; value: ConfigValue }[] = [];

  for (const [key, value] of Object.entries(values)) {
    const def = getDefinition(key);
    if (!def) {
      return { error: `Unknown configuration key: ${key}` };
    }

    const validationError = def.validate(value);
    if (validationError !== null) {
      return { error: validationError };
    }

    entries.push({ key, value: value as ConfigValue });
  }

  await ServerConfigDBModel.upsertMany(db, entries);
  return getConfig(db);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/utils/configService.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/configService.ts test/utils/configService.test.ts
git commit -m "feat: add config service for merge + validation (#101)"
```

---

## Task 4: API schemas and response types

**Files:**
- Create: `src/types/api/config.ts`

No standalone test (schemas are exercised by the route tests in Task 6). This task is a single commit.

- [ ] **Step 1: Create the schemas/types file**

Create `src/types/api/config.ts`:

```typescript
/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import type { ConfigType, ConfigValue } from "../../misc/configRegistry.js";

export class ConfigItemResponse {
  key: string = "";
  label: string = "";
  type: ConfigType = "string";
  value: ConfigValue = "";
}

const configItemJsonSchema = {
  type: "object",
  properties: {
    key: { type: "string" },
    label: { type: "string" },
    type: { type: "string", enum: ["string", "boolean"] },
    value: { type: ["string", "boolean"] },
  },
};

export const ConfigGetSchema = {
  response: {
    200: {
      type: "array",
      items: configItemJsonSchema,
    },
  },
};

export const ConfigUpdateSchema = {
  body: {
    type: "object",
    required: ["values"],
    properties: {
      values: {
        type: "object",
        additionalProperties: { type: ["string", "boolean"] },
      },
    },
  },
  response: {
    200: {
      type: "array",
      items: configItemJsonSchema,
    },
    400: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
  },
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run build`
Expected: build succeeds, no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/api/config.ts
git commit -m "feat: add config API schemas and response types (#101)"
```

---

## Task 5: GET /admin/config route

**Files:**
- Create: `src/routes/admin/configGet.ts`
- Test: `test/routes/config.test.ts` (created here; extended in Task 6)

- [ ] **Step 1: Write the failing test**

Create `test/routes/config.test.ts`:

```typescript
/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock("../../src/utils/configService.js", () => ({
  getConfig: (...args: unknown[]) => mocks.getConfig(...args),
  updateConfig: (...args: unknown[]) => mocks.updateConfig(...args),
}));

import { default as ConfigGetRoute } from "../../src/routes/admin/configGet.js";

function createResponseMock() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

function createRouteContext() {
  return {
    database: mocks.getDatabase(),
    logger: { info: vi.fn(), error: vi.fn() },
  } as any;
}

describe("Config GET route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabase.mockReturnValue("db-client");
  });

  it("uses GET /admin/config and requires auth", () => {
    const route = new ConfigGetRoute(createRouteContext());
    expect(route.url).toBe("/admin/config");
    expect(route.method).toBe("GET");
    expect(route.requiresAuth).toBe(true);
  });

  it("returns the merged config from the service", async () => {
    const config = [
      { key: "test.string", label: "Test String", type: "string", value: "" },
    ];
    mocks.getConfig.mockResolvedValue(config);

    const route = new ConfigGetRoute(createRouteContext());
    const response = createResponseMock();

    await route.handler({}, response);

    expect(mocks.getConfig).toHaveBeenCalledWith("db-client");
    expect(response.send).toHaveBeenCalledWith(config);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/routes/config.test.ts`
Expected: FAIL — cannot find module `configGet.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/routes/admin/configGet.ts`:

```typescript
/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { ConfigGetSchema } from "../../types/api/config.js";
import { getConfig } from "../../utils/configService.js";

export default class ConfigGetRoute extends Route {
  method = HttpMethods.GET;
  url = "/admin/config";
  schema = ConfigGetSchema;
  requiresAuth = true;

  handler = async (_request: any, response: any) => {
    const db = this.getDatabase();
    const config = await getConfig(db);
    response.send(config);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/routes/config.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/configGet.ts test/routes/config.test.ts
git commit -m "feat: add GET /admin/config route (#101)"
```

---

## Task 6: PUT /admin/config route

**Files:**
- Create: `src/routes/admin/configUpdate.ts`
- Modify: `test/routes/config.test.ts` (add the PUT describe block)

- [ ] **Step 1: Write the failing test**

Append this `describe` block to `test/routes/config.test.ts` (after the existing GET describe block, before EOF), and add the import line `import { default as ConfigUpdateRoute } from "../../src/routes/admin/configUpdate.js";` next to the existing `ConfigGetRoute` import at the top:

```typescript
describe("Config PUT route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabase.mockReturnValue("db-client");
  });

  it("uses PUT /admin/config and requires auth", () => {
    const route = new ConfigUpdateRoute(createRouteContext());
    expect(route.url).toBe("/admin/config");
    expect(route.method).toBe("PUT");
    expect(route.requiresAuth).toBe(true);
  });

  it("returns updated config on success", async () => {
    const updated = [
      { key: "test.string", label: "Test String", type: "string", value: "ok" },
    ];
    mocks.updateConfig.mockResolvedValue(updated);

    const route = new ConfigUpdateRoute(createRouteContext());
    const response = createResponseMock();

    await route.handler(
      { body: { values: { "test.string": "ok" } } },
      response,
    );

    expect(mocks.updateConfig).toHaveBeenCalledWith("db-client", {
      "test.string": "ok",
    });
    expect(response.send).toHaveBeenCalledWith(updated);
    expect(response.status).not.toHaveBeenCalled();
  });

  it("returns 400 with the error message when validation fails", async () => {
    mocks.updateConfig.mockResolvedValue({
      error: "Test String must not be empty",
    });

    const route = new ConfigUpdateRoute(createRouteContext());
    const response = createResponseMock();

    await route.handler({ body: { values: { "test.string": "" } } }, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith({
      error: "Test String must not be empty",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/routes/config.test.ts`
Expected: FAIL — cannot find module `configUpdate.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/routes/admin/configUpdate.ts`:

```typescript
/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { ConfigUpdateSchema } from "../../types/api/config.js";
import { updateConfig } from "../../utils/configService.js";

export default class ConfigUpdateRoute extends Route {
  method = HttpMethods.PUT;
  url = "/admin/config";
  schema = ConfigUpdateSchema;
  requiresAuth = true;

  handler = async (request: any, response: any) => {
    const db = this.getDatabase();
    const values = (request.body?.values ?? {}) as Record<string, unknown>;

    const result = await updateConfig(db, values);
    if ("error" in result) {
      response.status(400).send({ error: result.error });
      return;
    }

    response.send(result);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/routes/config.test.ts`
Expected: PASS (4 tests total in file).

- [ ] **Step 5: Run the full backend suite + build**

Run: `npm test && npm run build`
Expected: all tests pass; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/routes/admin/configUpdate.ts test/routes/config.test.ts
git commit -m "feat: add PUT /admin/config route (#101)"
```

---

## Task 7: Backend manual verification (optional but recommended)

**Files:** none (verification only).

- [ ] **Step 1: Confirm route registration wiring**

The route classes auto-register because their `url` begins with `/admin` and `requiresAuth = true` (see `src/routes/routeController.ts` — `adminRoutes` filter + session-token `onRequest` hook). No registration code change is needed. Confirm by reading `registerRoutes` and verifying both new files live under `src/routes/admin/`.

- [ ] **Step 2: Commit nothing**

No changes; proceed to the UI tasks.

---

## Task 8: Admin UI — BFF proxy route

> Run all remaining commands from the **admin UI** repo:
> `/Users/massimilianofanciulli/Sviluppo/Volumio/MusicServer/musicserver-admin-ui`

**Files:**
- Create: `src/app/api/admin/config/route.ts`

- [ ] **Step 1: Create the BFF route**

Create `src/app/api/admin/config/route.ts` (mirrors `src/app/api/admin/notifications/route.ts`, adds PUT):

```typescript
import {
  buildMusicServerUrl,
  buildAdminHeaders,
  buildAdminJsonHeaders,
  backendFetch,
} from "@/lib/musicserver-api";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await backendFetch(buildMusicServerUrl("/admin/config"), {
      cache: "no-store",
      headers: await buildAdminHeaders(),
    });

    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to call musicserver /admin/config",
      },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.text();

    const response = await backendFetch(buildMusicServerUrl("/admin/config"), {
      method: "PUT",
      cache: "no-store",
      headers: await buildAdminJsonHeaders(),
      body,
    });

    const text = await response.text();

    return new NextResponse(text, {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to call musicserver /admin/config",
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds (the route compiles).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/config/route.ts
git commit -m "feat: add /api/admin/config BFF proxy (#101)"
```

---

## Task 9: Admin UI — sidebar nav item

**Files:**
- Modify: `src/components/Layouts/sidebar/data/index.ts`

- [ ] **Step 1: Add the Settings item to the SETTINGS section**

In `src/components/Layouts/sidebar/data/index.ts`:

1. Add `SlidersHorizontal` to the existing `lucide-react` import:

```typescript
import { Database, Settings, Logs, KeyRound, ToyBrick, SlidersHorizontal } from "lucide-react";
```

2. Add this object as the **first** item in the `SETTINGS` section's `items` array (before `Plugins`):

```typescript
      {
        title: "Settings",
        url: "/settings",
        icon: SlidersHorizontal,
        items: [],
      },
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/Layouts/sidebar/data/index.ts
git commit -m "feat: add Settings nav item to sidebar (#101)"
```

---

## Task 10: Admin UI — Settings page + form component

**Files:**
- Create: `src/app/(admin)/settings/page.tsx`
- Create: `src/app/(admin)/settings/_components/settings-form.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/(admin)/settings/page.tsx`:

```typescript
import { SettingsForm } from "./_components/settings-form";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <SettingsForm />
    </div>
  );
}
```

- [ ] **Step 2: Create the form component**

Create `src/app/(admin)/settings/_components/settings-form.tsx`. It mirrors the `plugins-card.tsx` fetch + save + error-modal pattern (label left, widget right, same line; string→text, boolean→toggle; `40x`→modal):

```typescript
"use client";

import { apiFetch } from "@/lib/api-client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ConfigType = "string" | "boolean";

type ConfigItem = {
  key: string;
  label: string;
  type: ConfigType;
  value: string | boolean;
};

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function SettingsForm() {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<boolean>(false);

  const loadConfig = useCallback(async () => {
    setLoadError(null);

    try {
      const response = await apiFetch("/api/admin/config", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Failed to load configuration (${response.status})`);
      }

      const data = (await response.json()) as ConfigItem[];
      setItems(data);
      setValues(
        Object.fromEntries(data.map((item) => [item.key, item.value])),
      );
    } catch (error) {
      setLoadError(toErrorMessage(error, "Failed to load configuration"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const setValue = useCallback((key: string, value: string | boolean) => {
    setSavedNotice(false);
    setValues((previous) => ({ ...previous, [key]: value }));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setModalError(null);
    setSavedNotice(false);

    try {
      const response = await apiFetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message =
          (payload && typeof payload.error === "string" && payload.error) ||
          `Failed to save configuration (${response.status})`;
        setModalError(message);
        return;
      }

      const data = payload as ConfigItem[];
      setItems(data);
      setValues(
        Object.fromEntries(data.map((item) => [item.key, item.value])),
      );
      setSavedNotice(true);
    } catch (error) {
      setModalError(toErrorMessage(error, "Failed to save configuration"));
    } finally {
      setSaving(false);
    }
  }, [values]);

  return (
    <section className="rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card sm:p-7.5">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-dark dark:text-white">
          Settings
        </h2>
        <p className="mt-1 text-sm text-dark-4 dark:text-dark-6">
          Music Server configuration parameters.
        </p>
      </div>

      {loadError && (
        <div className="mb-4 rounded-lg border border-[#D34053]/30 bg-[#D34053]/10 px-3 py-2 text-sm text-[#D34053]">
          {loadError}
        </div>
      )}

      {savedNotice && (
        <div className="mb-4 rounded-lg border border-[#219653]/30 bg-[#219653]/10 px-3 py-2 text-sm text-[#219653]">
          Configuration saved.
        </div>
      )}

      {loading ? (
        <p className="text-sm text-dark-4 dark:text-dark-6">
          Loading configuration...
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-dark-4 dark:text-dark-6">
          No configuration parameters found.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const value = values[item.key];

            if (item.type === "boolean") {
              return (
                <label
                  key={item.key}
                  className="flex cursor-pointer items-center gap-3"
                >
                  <span className="w-1/3 shrink-0 text-sm font-semibold text-dark dark:text-white">
                    {item.label}
                  </span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={value === true}
                      onChange={(event) =>
                        setValue(item.key, event.target.checked)
                      }
                    />
                    <div className="h-8 w-14 rounded-full bg-gray-3 peer-checked:bg-primary dark:bg-[#5A616B]" />
                    <div className="absolute left-1 top-1 size-6 rounded-full bg-white transition peer-checked:translate-x-full" />
                  </div>
                </label>
              );
            }

            return (
              <label
                key={item.key}
                className="flex items-center gap-3"
              >
                <span className="w-1/3 shrink-0 text-sm font-semibold text-dark dark:text-white">
                  {item.label}
                </span>
                <input
                  type="text"
                  className="w-2/3 rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                  value={typeof value === "string" ? value : ""}
                  onChange={(event) => setValue(item.key, event.target.value)}
                />
              </label>
            );
          })}

          <div className="pt-2">
            <button
              disabled={saving}
              onClick={() => void save()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      )}

      {modalError !== null &&
        createPortal(
          <div
            className="fixed inset-0 z-99999 flex items-center justify-center bg-dark/60 px-4"
            onClick={() => setModalError(null)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="config-error-title"
              className="w-full max-w-md rounded-[10px] border border-stroke bg-white p-6 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card"
              onClick={(event) => event.stopPropagation()}
            >
              <h3
                id="config-error-title"
                className="text-lg font-semibold text-[#D34053]"
              >
                Invalid configuration
              </h3>
              <p className="mt-3 text-sm text-dark dark:text-white">
                {modalError}
              </p>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setModalError(null)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
```

- [ ] **Step 2: Verify build + lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, lint passes.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/settings/page.tsx" "src/app/(admin)/settings/_components/settings-form.tsx"
git commit -m "feat: add Settings page with config form (#101)"
```

---

## Task 11: End-to-end manual verification

**Files:** none (verification only).

- [ ] **Step 1: Start backend + UI and exercise the flow**

With MongoDB running, start the backend (`npm start` in the backend repo) and the UI (`npm run dev` in the UI repo). Sign in to the Admin UI.

- [ ] **Step 2: Verify the happy path**

Click **Settings** in the sidebar. Confirm two rows render: "Test String" (text input) and "Test Boolean" (toggle), each with the label on the left and the widget on the right, same line. Enter a non-empty string, toggle the boolean, click **Save**. Expect the "Configuration saved." notice. Reload the page and confirm the values persisted.

- [ ] **Step 3: Verify the error path**

Clear the "Test String" field (empty), click **Save**. Expect the error modal showing "Test String must not be empty" and no save. Close the modal.

- [ ] **Step 4: Done**

No code changes in this task. The feature is complete.

---

## Notes for the implementer

- Backend route classes self-register via `RouteController`; nothing else needs editing for the routes to be live.
- `MONGO_URI` is intentionally NOT configurable (chicken-and-egg: config lives in Mongo). Do not add it to the registry.
- Stored config values are NOT yet consumed by the running server — that startup wiring is a separate future issue, by design.
- Commit after every task (backend and UI commits land in their respective repos).
