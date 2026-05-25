# Session-Based Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add session-token auth to all `/admin` routes while keeping the existing API-key auth for `/music` routes unchanged.

**Architecture:** The backend adds two MongoDB collections (`user_passwords`, `user_sessions`), pure utility functions for scrypt hashing and token generation, a login route at `POST /admin/login` (public), and a **new** Fastify scoped plugin that validates Bearer tokens on all other `/admin` routes. The existing `apiKeyPlugin` for `/music` routes is kept untouched — `routeController` now runs two separate auth plugins: API-key for non-admin routes, session-token for admin routes. The frontend adds Next.js middleware for page-level protection, three `/api/auth/` proxy route handlers that manage the `session_token` HttpOnly cookie, updated admin proxy routes that forward the cookie as a Bearer header, and a change-password form in the profile section.

**Tech Stack:** Fastify 5, TypeScript, MongoDB (native driver), Node.js `crypto` (scrypt + randomBytes), Next.js 16 App Router, React 19, TailwindCSS

**Repos:**
- Backend: `musicserver-backend/` — all paths relative to its root
- Frontend: `musicserver-admin-ui/` — all paths relative to its root

---

## File Map

### Backend — New files
| Path | Responsibility |
|------|---------------|
| `src/utils/sessionAuthUtils.ts` | scrypt hash/verify, token generation/parsing, token hashing |
| `src/utils/loginRateLimiter.ts` | in-memory per-IP failed-attempt counter |
| `src/types/db/userPassword.ts` | `user_passwords` collection model + init (seeds admin user) |
| `src/types/db/userSession.ts` | `user_sessions` collection model + init (TTL index) |
| `src/routes/admin/login.ts` | `POST /admin/login` — public, rate-limited |
| `src/routes/admin/changePassword.ts` | `POST /admin/change-password` — protected |
| `test/utils/sessionAuthUtils.test.ts` | unit tests for auth utils |
| `test/utils/loginRateLimiter.test.ts` | unit tests for rate limiter |

### Backend — Modified files
| Path | Change |
|------|--------|
| `src/routes/routeController.ts` | Keep `apiKeyPlugin` for non-admin routes; **add** session-token scoped plugin for admin routes |
| `src/routes/admin/adminLogs.ts` | `requiresAuth = true` |
| `src/routes/admin/apiKeysCreate.ts` | `requiresAuth = true` |
| `src/routes/admin/apiKeysDelete.ts` | `requiresAuth = true` |
| `src/routes/admin/apiKeysList.ts` | `requiresAuth = true` |
| `src/routes/admin/dbAlbums.ts` | `requiresAuth = true` |
| `src/routes/admin/dbArtists.ts` | `requiresAuth = true` |
| `src/routes/admin/dbSongs.ts` | `requiresAuth = true` |
| `src/routes/admin/dbSummary.ts` | `requiresAuth = true` |
| `src/routes/admin/pluginConfigGet.ts` | `requiresAuth = true` |
| `src/routes/admin/pluginConfigUpdate.ts` | `requiresAuth = true` |
| `src/routes/admin/pluginStart.ts` | `requiresAuth = true` |
| `src/routes/admin/pluginStop.ts` | `requiresAuth = true` |
| `src/routes/admin/plugins.ts` | `requiresAuth = true` |

> **NOT modified:** `src/utils/apiKeyUtils.ts`, `package.json` — `fastify-auth-by-api-key` stays in place for `/music` routes.

### Frontend — New files
| Path | Responsibility |
|------|---------------|
| `src/middleware.ts` | Redirect unauthenticated requests to `/auth/sign-in` |
| `src/app/api/auth/login/route.ts` | Proxy login → set HttpOnly cookie |
| `src/app/api/auth/logout/route.ts` | Clear cookie → redirect to sign-in |
| `src/app/api/auth/change-password/route.ts` | Proxy change-password with token |
| `src/components/Auth/ChangePassword.tsx` | Change-password form component |

### Frontend — Modified files
| Path | Change |
|------|--------|
| `src/lib/musicserver-api.ts` | Add `buildAdminHeaders()` and `buildAdminJsonHeaders()` helpers |
| `src/app/api/admin/api-keys/route.ts` | Use `buildAdminHeaders/JsonHeaders` |
| `src/app/api/admin/api-keys/[id]/route.ts` | Use `buildAdminHeaders/JsonHeaders` |
| `src/app/api/admin/db/artists/route.ts` | Use `buildAdminHeaders` |
| `src/app/api/admin/db/artists/[artistId]/albums/route.ts` | Use `buildAdminHeaders` |
| `src/app/api/admin/db/albums/[albumId]/songs/route.ts` | Use `buildAdminHeaders` |
| `src/app/api/admin/db/summary/route.ts` | Use `buildAdminHeaders` |
| `src/app/api/admin/plugins/route.ts` | Use `buildAdminHeaders` |
| `src/app/api/admin/plugins/[pluginId]/route.ts` | Use `buildAdminHeaders/JsonHeaders` |
| `src/app/api/admin/plugins/start/route.ts` | Use `buildAdminJsonHeaders` |
| `src/app/api/admin/plugins/stop/route.ts` | Use `buildAdminJsonHeaders` |
| `src/app/api/admin/scan/route.ts` | Use `buildAdminJsonHeaders` |
| `src/components/Auth/SigninWithPassword.tsx` | Connect form to `/api/auth/login`, use username field |
| `src/components/Auth/Signin/index.tsx` | Remove Google signin / sign-up link |
| `src/app/profile/page.tsx` | Add `<ChangePassword />` section |

---

## Task 1: Session Auth Utility Functions

**Files:**
- Create: `src/utils/sessionAuthUtils.ts`
- Create: `test/utils/sessionAuthUtils.test.ts`

- [ ] **Step 1.1: Write failing tests**

Create `test/utils/sessionAuthUtils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashToken,
  extractUsernameFromToken,
} from "../../src/utils/sessionAuthUtils.js";

describe("hashPassword", () => {
  it("returns scrypt-formatted string", async () => {
    const hash = await hashPassword("mypassword");
    expect(hash).toMatch(/^scrypt:\d+:\d+:\d+:[0-9a-f]+:[0-9a-f]+$/);
  });

  it("produces different hashes for same password due to random salt", async () => {
    const h1 = await hashPassword("same");
    const h2 = await hashPassword("same");
    expect(h1).not.toBe(h2);
  });
});

describe("verifyPassword", () => {
  it("returns true for correct password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("correct", hash)).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("returns false for malformed hash string", async () => {
    expect(await verifyPassword("any", "not-a-valid-hash")).toBe(false);
  });
});

describe("generateSessionToken", () => {
  it("starts with base64url-encoded username before the dot", () => {
    const token = generateSessionToken("admin");
    const [userPart] = token.split(".");
    expect(Buffer.from(userPart, "base64url").toString("utf8")).toBe("admin");
  });

  it("contains a dot separator", () => {
    expect(generateSessionToken("admin")).toContain(".");
  });

  it("produces different tokens on each call", () => {
    expect(generateSessionToken("admin")).not.toBe(generateSessionToken("admin"));
  });
});

describe("hashToken", () => {
  it("returns a 64-character hex string", () => {
    const h = hashToken("anytoken");
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic for the same input", () => {
    expect(hashToken("x")).toBe(hashToken("x"));
  });

  it("differs for different inputs", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});

describe("extractUsernameFromToken", () => {
  it("extracts the correct username from a generated token", () => {
    const token = generateSessionToken("admin");
    expect(extractUsernameFromToken(token)).toBe("admin");
  });

  it("extracts username with special characters", () => {
    const token = generateSessionToken("user@example.com");
    expect(extractUsernameFromToken(token)).toBe("user@example.com");
  });

  it("returns null for a token without a dot", () => {
    expect(extractUsernameFromToken("nodothere")).toBeNull();
  });
});
```

- [ ] **Step 1.2: Run tests — verify they fail**

```bash
cd musicserver-backend
npm test -- --reporter=verbose test/utils/sessionAuthUtils.test.ts
```

Expected: error `Cannot find module '../../src/utils/sessionAuthUtils.js'`

- [ ] **Step 1.3: Implement `src/utils/sessionAuthUtils.ts`**

```typescript
import {
  scrypt,
  randomBytes,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scryptAsync(password, salt, SCRYPT_KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  })) as Buffer;
  return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N_str, r_str, p_str, saltHex, hashHex] = parts;
  try {
    const N = parseInt(N_str, 10);
    const r = parseInt(r_str, 10);
    const p = parseInt(p_str, 10);
    const salt = Buffer.from(saltHex, "hex");
    const storedHash = Buffer.from(hashHex, "hex");
    const derived = (await scryptAsync(password, salt, storedHash.length, {
      N,
      r,
      p,
    })) as Buffer;
    return timingSafeEqual(derived, storedHash);
  } catch {
    return false;
  }
}

export function generateSessionToken(username: string): string {
  const usernamePart = Buffer.from(username).toString("base64url");
  const randomPart = randomBytes(32).toString("hex");
  return `${usernamePart}.${randomPart}`;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function extractUsernameFromToken(token: string): string | null {
  const dotIndex = token.indexOf(".");
  if (dotIndex === -1) return null;
  try {
    return Buffer.from(token.slice(0, dotIndex), "base64url").toString("utf8");
  } catch {
    return null;
  }
}
```

- [ ] **Step 1.4: Run tests — verify they pass**

```bash
npm test -- --reporter=verbose test/utils/sessionAuthUtils.test.ts
```

Expected: all tests PASS

- [ ] **Step 1.5: Commit**

```bash
git add src/utils/sessionAuthUtils.ts test/utils/sessionAuthUtils.test.ts
git commit -m "feat: add session auth utility functions (scrypt hash, token generation)"
```

---

## Task 2: Login Rate Limiter

**Files:**
- Create: `src/utils/loginRateLimiter.ts`
- Create: `test/utils/loginRateLimiter.test.ts`

- [ ] **Step 2.1: Write failing tests**

Create `test/utils/loginRateLimiter.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import {
  isRateLimited,
  recordFailedAttempt,
  resetAttempts,
} from "../../src/utils/loginRateLimiter.js";

const IP = "1.2.3.4";
const OTHER_IP = "5.6.7.8";

describe("loginRateLimiter", () => {
  beforeEach(() => {
    resetAttempts(IP);
    resetAttempts(OTHER_IP);
  });

  it("is not limited with no prior attempts", () => {
    expect(isRateLimited(IP)).toBe(false);
  });

  it("is not limited after 4 failed attempts", () => {
    for (let i = 0; i < 4; i++) recordFailedAttempt(IP);
    expect(isRateLimited(IP)).toBe(false);
  });

  it("is limited after 5 failed attempts", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(IP);
    expect(isRateLimited(IP)).toBe(true);
  });

  it("stays limited after more than 5 attempts", () => {
    for (let i = 0; i < 8; i++) recordFailedAttempt(IP);
    expect(isRateLimited(IP)).toBe(true);
  });

  it("is no longer limited after resetAttempts", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(IP);
    resetAttempts(IP);
    expect(isRateLimited(IP)).toBe(false);
  });

  it("does not share state between different IPs", () => {
    for (let i = 0; i < 5; i++) recordFailedAttempt(IP);
    expect(isRateLimited(OTHER_IP)).toBe(false);
  });
});
```

- [ ] **Step 2.2: Run tests — verify they fail**

```bash
npm test -- --reporter=verbose test/utils/loginRateLimiter.test.ts
```

Expected: error `Cannot find module '../../src/utils/loginRateLimiter.js'`

- [ ] **Step 2.3: Implement `src/utils/loginRateLimiter.ts`**

```typescript
interface RateLimitEntry {
  count: number;
  resetAt: Date;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

const store = new Map<string, RateLimitEntry>();

export function isRateLimited(ip: string): boolean {
  const entry = store.get(ip);
  if (!entry) return false;
  if (new Date() > entry.resetAt) {
    store.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(ip: string): void {
  const now = new Date();
  const entry = store.get(ip);
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: new Date(now.getTime() + WINDOW_MS) });
  } else {
    entry.count += 1;
  }
}

export function resetAttempts(ip: string): void {
  store.delete(ip);
}
```

- [ ] **Step 2.4: Run tests — verify they pass**

```bash
npm test -- --reporter=verbose test/utils/loginRateLimiter.test.ts
```

Expected: all tests PASS

- [ ] **Step 2.5: Commit**

```bash
git add src/utils/loginRateLimiter.ts test/utils/loginRateLimiter.test.ts
git commit -m "feat: add in-memory login rate limiter (5 attempts / 15 min per IP)"
```

---

## Task 3: UserPassword DB Model

**Files:**
- Create: `src/types/db/userPassword.ts`

- [ ] **Step 3.1: Create `src/types/db/userPassword.ts`**

```typescript
import type { Db } from "mongodb";
import { v4 } from "uuid";
import { hashPassword } from "../../utils/sessionAuthUtils.js";

const COLLECTION_NAME = "user_passwords";

export class UserPasswordDbModel {
  id: string = v4();
  username: string = "";
  passwordHash: string = "";
  createdAt: Date = new Date();

  static async findByUsername(
    db: Db,
    username: string,
  ): Promise<UserPasswordDbModel | undefined> {
    const result = await db
      .collection<UserPasswordDbModel>(COLLECTION_NAME)
      .findOne({ username });
    return result ?? undefined;
  }

  static async updateHash(
    db: Db,
    username: string,
    passwordHash: string,
  ): Promise<void> {
    await db
      .collection<UserPasswordDbModel>(COLLECTION_NAME)
      .updateOne({ username }, { $set: { passwordHash } });
  }

  async insert(db: Db): Promise<void> {
    await db
      .collection<UserPasswordDbModel>(COLLECTION_NAME)
      .insertOne(this);
  }
}

export async function init(db: Db): Promise<void> {
  await db
    .collection(COLLECTION_NAME)
    .createIndex({ username: 1 }, { unique: true });

  const adminExists = await db
    .collection(COLLECTION_NAME)
    .findOne({ username: "admin" });

  if (!adminExists) {
    const model = new UserPasswordDbModel();
    model.username = "admin";
    model.passwordHash = await hashPassword("admin");
    await model.insert(db);
  }
}
```

- [ ] **Step 3.2: Run full test suite — verify nothing breaks**

```bash
npm test
```

Expected: all existing tests still PASS

- [ ] **Step 3.3: Commit**

```bash
git add src/types/db/userPassword.ts
git commit -m "feat: add user_passwords collection model with admin user seed"
```

---

## Task 4: UserSession DB Model

**Files:**
- Create: `src/types/db/userSession.ts`

- [ ] **Step 4.1: Create `src/types/db/userSession.ts`**

```typescript
import type { Db } from "mongodb";
import { v4 } from "uuid";

const COLLECTION_NAME = "user_sessions";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export class UserSessionDbModel {
  id: string = v4();
  username: string = "";
  tokenHash: string = "";
  createdAt: Date = new Date();
  expiresAt: Date = new Date(Date.now() + SESSION_DURATION_MS);

  static async findValid(
    db: Db,
    username: string,
    tokenHash: string,
  ): Promise<UserSessionDbModel | undefined> {
    const result = await db
      .collection<UserSessionDbModel>(COLLECTION_NAME)
      .findOne({ username, tokenHash, expiresAt: { $gt: new Date() } });
    return result ?? undefined;
  }

  static async deleteByUsername(db: Db, username: string): Promise<void> {
    await db
      .collection<UserSessionDbModel>(COLLECTION_NAME)
      .deleteMany({ username });
  }

  async insert(db: Db): Promise<void> {
    await db
      .collection<UserSessionDbModel>(COLLECTION_NAME)
      .insertOne(this);
  }
}

export function init(db: Db): void {
  void db.collection(COLLECTION_NAME).createIndex({ tokenHash: 1 });
  void db
    .collection(COLLECTION_NAME)
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}
```

- [ ] **Step 4.2: Run full test suite — verify nothing breaks**

```bash
npm test
```

Expected: all existing tests still PASS

- [ ] **Step 4.3: Commit**

```bash
git add src/types/db/userSession.ts
git commit -m "feat: add user_sessions collection model with TTL index"
```

---

## Task 5: Login Route

**Files:**
- Create: `src/routes/admin/login.ts`

- [ ] **Step 5.1: Create `src/routes/admin/login.ts`**

```typescript
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { UserPasswordDbModel } from "../../types/db/userPassword.js";
import { UserSessionDbModel } from "../../types/db/userSession.js";
import {
  verifyPassword,
  generateSessionToken,
  hashToken,
} from "../../utils/sessionAuthUtils.js";
import {
  isRateLimited,
  recordFailedAttempt,
  resetAttempts,
} from "../../utils/loginRateLimiter.js";
import type { Context } from "../../types/context.js";

export default class LoginRoute extends Route {
  method = HttpMethods.POST;
  url = "/admin/login";
  requiresAuth = false;
  schema = {
    body: {
      type: "object",
      required: ["username", "password"],
      properties: {
        username: { type: "string" },
        password: { type: "string" },
      },
    },
  };

  constructor(context: Context) {
    super(context);
  }

  handler = async (request: any, response: any) => {
    const ip: string = request.ip ?? "unknown";

    if (isRateLimited(ip)) {
      return response
        .code(429)
        .send({ error: "Too many attempts. Try again later." });
    }

    const { username, password } = request.body as {
      username: string;
      password: string;
    };
    const db = this.getDatabase();

    const user = await UserPasswordDbModel.findByUsername(db, username);

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      recordFailedAttempt(ip);
      return response.code(401).send({ error: "Invalid credentials" });
    }

    resetAttempts(ip);
    await UserSessionDbModel.deleteByUsername(db, username);

    const token = generateSessionToken(username);
    const session = new UserSessionDbModel();
    session.username = username;
    session.tokenHash = hashToken(token);
    await session.insert(db);

    return response.send({ token, expiresAt: session.expiresAt.toISOString() });
  };
}
```

- [ ] **Step 5.2: Run full test suite — verify nothing breaks**

```bash
npm test
```

Expected: all existing tests still PASS

- [ ] **Step 5.3: Commit**

```bash
git add src/routes/admin/login.ts
git commit -m "feat: add POST /admin/login route with rate limiting"
```

---

## Task 6: Change Password Route

**Files:**
- Create: `src/routes/admin/changePassword.ts`

- [ ] **Step 6.1: Create `src/routes/admin/changePassword.ts`**

```typescript
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { UserPasswordDbModel } from "../../types/db/userPassword.js";
import { UserSessionDbModel } from "../../types/db/userSession.js";
import {
  verifyPassword,
  hashPassword,
} from "../../utils/sessionAuthUtils.js";
import type { Context } from "../../types/context.js";

export default class ChangePasswordRoute extends Route {
  method = HttpMethods.POST;
  url = "/admin/change-password";
  requiresAuth = true;
  schema = {
    body: {
      type: "object",
      required: ["currentPassword", "newPassword"],
      properties: {
        currentPassword: { type: "string" },
        newPassword: { type: "string" },
      },
    },
  };

  constructor(context: Context) {
    super(context);
  }

  handler = async (request: any, response: any) => {
    const username: string = (request as any).username;
    const { currentPassword, newPassword } = request.body as {
      currentPassword: string;
      newPassword: string;
    };

    if (newPassword.length < 8) {
      return response
        .code(400)
        .send({ error: "New password must be at least 8 characters" });
    }

    const db = this.getDatabase();
    const user = await UserPasswordDbModel.findByUsername(db, username);

    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return response.code(401).send({ error: "Invalid credentials" });
    }

    const newHash = await hashPassword(newPassword);
    await UserPasswordDbModel.updateHash(db, username, newHash);
    await UserSessionDbModel.deleteByUsername(db, username);

    return response.send({ success: true });
  };
}
```

- [ ] **Step 6.2: Run full test suite — verify nothing breaks**

```bash
npm test
```

Expected: all existing tests still PASS

- [ ] **Step 6.3: Commit**

```bash
git add src/routes/admin/changePassword.ts
git commit -m "feat: add POST /admin/change-password route"
```

---

## Task 7: Protect All Existing Admin Routes

**Files:** 13 existing route files in `src/routes/admin/`

Add `requiresAuth = true;` to each class body. The property should be added after the `schema` or `url` line, following the existing class structure.

- [ ] **Step 7.1: Update `src/routes/admin/adminLogs.ts`**

Add `requiresAuth = true;` after the `schema` line:

```typescript
export default class AdminLogsRoute extends Route {
  method = HttpMethods.GET;
  url = "/admin/logs";
  schema = AdminLogsSchema;
  requiresAuth = true;          // ← add this line
  handler = async (request: any, response: any) => {
```

- [ ] **Step 7.2: Update `src/routes/admin/apiKeysCreate.ts`**

```typescript
export default class ApiKeysCreate extends Route {
  method = HttpMethods.POST;
  url = "/admin/api-keys";
  schema = ApiKeyCreateSchema;
  requiresAuth = true;          // ← add this line
```

- [ ] **Step 7.3: Update `src/routes/admin/apiKeysDelete.ts`**

Open the file and add `requiresAuth = true;` after the `schema` or `url` property.

- [ ] **Step 7.4: Update `src/routes/admin/apiKeysList.ts`**

Open the file and add `requiresAuth = true;` after the `schema` or `url` property.

- [ ] **Step 7.5: Update `src/routes/admin/dbAlbums.ts`**

Open the file and add `requiresAuth = true;` after the `schema` or `url` property.

- [ ] **Step 7.6: Update `src/routes/admin/dbArtists.ts`**

Open the file and add `requiresAuth = true;` after the `schema` or `url` property.

- [ ] **Step 7.7: Update `src/routes/admin/dbSongs.ts`**

Open the file and add `requiresAuth = true;` after the `schema` or `url` property.

- [ ] **Step 7.8: Update `src/routes/admin/dbSummary.ts`**

Open the file and add `requiresAuth = true;` after the `schema` or `url` property.

- [ ] **Step 7.9: Update `src/routes/admin/pluginConfigGet.ts`**

Open the file and add `requiresAuth = true;` after the `schema` or `url` property.

- [ ] **Step 7.10: Update `src/routes/admin/pluginConfigUpdate.ts`**

Open the file and add `requiresAuth = true;` after the `schema` or `url` property.

- [ ] **Step 7.11: Update `src/routes/admin/pluginStart.ts`**

Open the file and add `requiresAuth = true;` after the `schema` or `url` property.

- [ ] **Step 7.12: Update `src/routes/admin/pluginStop.ts`**

Open the file and add `requiresAuth = true;` after the `schema` or `url` property.

- [ ] **Step 7.13: Update `src/routes/admin/plugins.ts`**

Open the file and add `requiresAuth = true;` after the `schema` or `url` property.

- [ ] **Step 7.14: Run full test suite — verify nothing breaks**

```bash
npm test
```

Expected: all existing tests still PASS (requiresAuth is a property; routeController not yet changed)

- [ ] **Step 7.15: Commit**

```bash
git add src/routes/admin/
git commit -m "feat: mark all existing admin routes as requiresAuth = true"
```

---

## Task 8: Update RouteController (Dual-Plugin Approach)

Keep `apiKeyPlugin` for non-admin routes. Add a **second** scoped plugin for admin routes that validates session tokens.

**Files:**
- Modify: `src/routes/routeController.ts`

- [ ] **Step 8.1: Add the session auth utils import**

The existing imports at the top of `src/routes/routeController.ts` include:
```typescript
import { apiKeyPlugin } from "fastify-auth-by-api-key";
import { validateApiKey } from "../utils/apiKeyUtils.js";
```

Keep both. Add below them:
```typescript
import {
  extractUsernameFromToken,
  hashToken,
} from "../utils/sessionAuthUtils.js";
```

- [ ] **Step 8.2: Split `authenticatedRoutes` into two groups**

In `registerRoutes`, replace:
```typescript
const authenticatedRoutes = allRoutes.filter((r) => r.requiresAuth);
```

With:
```typescript
const apiKeyRoutes = allRoutes.filter(
  (r) => r.requiresAuth && !r.url.startsWith("/admin"),
);
const adminRoutes = allRoutes.filter(
  (r) => r.requiresAuth && r.url.startsWith("/admin"),
);
```

- [ ] **Step 8.3: Replace the single authenticated plugin block with two plugin blocks**

Remove the existing:
```typescript
await fastifyInstance.register(async (app) => {
  const db = this.#context!.database;
  await app.register(apiKeyPlugin, {
    checkApiKey: (key: string) => validateApiKey(db, key),
    allowInHeader: true,
    allowAsQueryParameter: true,
  });

  for (const route of authenticatedRoutes) {
    this.#logger.info(
      `Registering authenticated route: [${route.method}] ${route.url}`,
    );
    await this.registerRoute(app, route);
  }
});
```

Replace with these two blocks:

```typescript
await fastifyInstance.register(async (app) => {
  const db = this.#context!.database;
  await app.register(apiKeyPlugin, {
    checkApiKey: (key: string) => validateApiKey(db, key),
    allowInHeader: true,
    allowAsQueryParameter: true,
  });

  for (const route of apiKeyRoutes) {
    this.#logger.info(
      `Registering api-key-auth route: [${route.method}] ${route.url}`,
    );
    await this.registerRoute(app, route);
  }
});

await fastifyInstance.register(async (app) => {
  const db = this.#context!.database;

  app.addHook("onRequest", async (request: any, reply: any) => {
    const authHeader = request.headers["authorization"] as string | undefined;
    const token =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const username = extractUsernameFromToken(token);
    if (!username) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const hash = hashToken(token);
    const session = await db.collection("user_sessions").findOne({
      username,
      tokenHash: hash,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    (request as any).username = username;
  });

  for (const route of adminRoutes) {
    this.#logger.info(
      `Registering session-auth admin route: [${route.method}] ${route.url}`,
    );
    await this.registerRoute(app, route);
  }
});
```

- [ ] **Step 8.4: Run full test suite**

```bash
npm test
```

Expected: all existing tests still PASS (TypeScript compile must succeed too)

- [ ] **Step 8.5: Commit**

```bash
git add src/routes/routeController.ts
git commit -m "feat: add session token plugin for admin routes alongside existing API key plugin"
```

---

## ~~Task 9: Remove fastify-auth-by-api-key~~ — SKIPPED

`fastify-auth-by-api-key` is kept. `/music` routes continue using API key auth unchanged.

---

## Task 10: Add buildAdminHeaders Helper (Frontend)

All subsequent tasks are in the **`musicserver-admin-ui/`** repo.

**Files:**
- Modify: `src/lib/musicserver-api.ts`

- [ ] **Step 10.1: Add auth header helpers to `src/lib/musicserver-api.ts`**

Append to the existing file (keep existing `getMusicServerApiBaseUrl` and `buildMusicServerUrl`):

```typescript
import { cookies } from "next/headers";

export async function buildAdminHeaders(): Promise<HeadersInit> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token")?.value;
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function buildAdminJsonHeaders(): Promise<HeadersInit> {
  return {
    ...(await buildAdminHeaders()),
    "Content-Type": "application/json",
  };
}
```

- [ ] **Step 10.2: Verify TypeScript compiles**

```bash
cd musicserver-admin-ui
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 10.3: Commit**

```bash
git add src/lib/musicserver-api.ts
git commit -m "feat: add buildAdminHeaders helper to forward session token to backend"
```

---

## Task 11: Update All Admin Proxy Routes (Frontend)

Update all 11 files in `src/app/api/admin/` to use `buildAdminHeaders` / `buildAdminJsonHeaders`.

**Files:** 11 proxy route files

The pattern for every GET handler changes from:
```typescript
headers: { Accept: "application/json" },
```
To:
```typescript
headers: await buildAdminHeaders(),
```

The pattern for every POST/DELETE handler changes from:
```typescript
headers: { "Content-Type": "application/json", Accept: "application/json" },
```
To:
```typescript
headers: await buildAdminJsonHeaders(),
```

Add `import { buildMusicServerUrl, buildAdminHeaders, buildAdminJsonHeaders } from "@/lib/musicserver-api";` at the top of each file (replace the existing import of `buildMusicServerUrl`).

- [ ] **Step 11.1: Update `src/app/api/admin/plugins/route.ts`**

Full updated file:

```typescript
import { buildMusicServerUrl, buildAdminHeaders } from "@/lib/musicserver-api";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(buildMusicServerUrl("/admin/plugins"), {
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
            : "Failed to call musicserver /admin/plugins",
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 11.2: Update `src/app/api/admin/api-keys/route.ts`**

```typescript
import {
  buildMusicServerUrl,
  buildAdminHeaders,
  buildAdminJsonHeaders,
} from "@/lib/musicserver-api";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(buildMusicServerUrl("/admin/api-keys"), {
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
          error instanceof Error ? error.message : "Failed to fetch API keys",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await fetch(buildMusicServerUrl("/admin/api-keys"), {
      method: "POST",
      cache: "no-store",
      headers: await buildAdminJsonHeaders(),
      body: JSON.stringify(body),
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
          error instanceof Error ? error.message : "Failed to create API key",
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 11.3: Update `src/app/api/admin/api-keys/[id]/route.ts`**

This file has only a DELETE handler. Full updated file:

```typescript
import { buildMusicServerUrl, buildAdminHeaders } from "@/lib/musicserver-api";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const response = await fetch(
      buildMusicServerUrl(`/admin/api-keys/${encodeURIComponent(id)}`),
      {
        method: "DELETE",
        cache: "no-store",
        headers: await buildAdminHeaders(),
      },
    );
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
          error instanceof Error ? error.message : "Failed to delete API key",
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 11.4: Update `src/app/api/admin/db/summary/route.ts`**

Open the file. Replace the `headers` in the fetch call with `headers: await buildAdminHeaders()`. Update the import line.

- [ ] **Step 11.5: Update `src/app/api/admin/db/artists/route.ts`**

Open the file. Replace headers with `await buildAdminHeaders()`. Update import.

- [ ] **Step 11.6: Update `src/app/api/admin/db/artists/[artistId]/albums/route.ts`**

Open the file. Replace headers with `await buildAdminHeaders()`. Update import.

- [ ] **Step 11.7: Update `src/app/api/admin/db/albums/[albumId]/songs/route.ts`**

Open the file. Replace headers with `await buildAdminHeaders()`. Update import.

- [ ] **Step 11.8: Update `src/app/api/admin/plugins/[pluginId]/route.ts`**

Open the file. For GET: `await buildAdminHeaders()`. For POST/PUT/PATCH: `await buildAdminJsonHeaders()`. Update import.

- [ ] **Step 11.9: Update `src/app/api/admin/plugins/start/route.ts`**

Open the file. Replace headers with `await buildAdminJsonHeaders()`. Update import.

- [ ] **Step 11.10: Update `src/app/api/admin/plugins/stop/route.ts`**

Open the file. Replace headers with `await buildAdminJsonHeaders()`. Update import.

- [ ] **Step 11.11: Update `src/app/api/admin/scan/route.ts`**

Open the file. Replace headers with `await buildAdminJsonHeaders()`. Update import.

- [ ] **Step 11.12: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 11.13: Commit**

```bash
git add src/app/api/admin/
git commit -m "feat: forward session token as Bearer header in all admin proxy routes"
```

---

## Task 12: Next.js Middleware

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 12.1: Create `src/middleware.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith("/auth/");
  const isApiAuthRoute = pathname.startsWith("/api/auth/");
  const hasToken = request.cookies.has("session_token");

  if (isAuthPage || isApiAuthRoute) {
    if (isAuthPage && hasToken) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!hasToken) {
    return NextResponse.redirect(new URL("/auth/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images|css|fonts|js).*)",
  ],
};
```

- [ ] **Step 12.2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 12.3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add Next.js middleware for session-based page protection"
```

---

## Task 13: Auth API Route Handlers

**Files:**
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/change-password/route.ts`

- [ ] **Step 13.1: Create `src/app/api/auth/login/route.ts`**

```typescript
import { buildMusicServerUrl } from "@/lib/musicserver-api";
import { NextRequest, NextResponse } from "next/server";

const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await fetch(buildMusicServerUrl("/admin/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { token } = (await response.json()) as { token: string };

    const res = NextResponse.json({ success: true });
    res.cookies.set("session_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    return res;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Login failed",
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 13.2: Create `src/app/api/auth/logout/route.ts`**

```typescript
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.redirect(
    new URL("/auth/sign-in", process.env.NEXTAUTH_URL ?? "http://localhost:3001"),
  );
  response.cookies.set("session_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
```

- [ ] **Step 13.3: Create `src/app/api/auth/change-password/route.ts`**

```typescript
import { buildMusicServerUrl } from "@/lib/musicserver-api";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("session_token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const response = await fetch(
      buildMusicServerUrl("/admin/change-password"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      return new NextResponse(text, {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set("session_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to change password",
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 13.4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 13.5: Commit**

```bash
git add src/app/api/auth/
git commit -m "feat: add auth API routes (login sets cookie, logout clears it, change-password proxies)"
```

---

## Task 14: Update Sign-In Components

**Files:**
- Modify: `src/components/Auth/SigninWithPassword.tsx`
- Modify: `src/components/Auth/Signin/index.tsx`

- [ ] **Step 14.1: Replace `src/components/Auth/SigninWithPassword.tsx`**

```tsx
"use client";

import { UserIcon, PasswordIcon } from "@/assets/icons";
import React, { useState } from "react";
import InputGroup from "../FormElements/InputGroup";
import { useRouter } from "next/navigation";

export default function SigninWithPassword() {
  const router = useRouter();
  const [data, setData] = useState({ username: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({ ...data, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        router.push("/");
        router.refresh();
      } else {
        const json = await response.json().catch(() => ({}));
        setError(json.error ?? "Login failed");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <InputGroup
        type="text"
        label="Username"
        className="mb-4 [&_input]:py-[15px]"
        placeholder="Enter your username"
        name="username"
        handleChange={handleChange}
        value={data.username}
        icon={<UserIcon />}
      />

      <InputGroup
        type="password"
        label="Password"
        className="mb-5 [&_input]:py-[15px]"
        placeholder="Enter your password"
        name="password"
        handleChange={handleChange}
        value={data.password}
        icon={<PasswordIcon />}
      />

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mb-4.5">
        <button
          type="submit"
          disabled={loading}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-primary p-4 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Sign In
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
          )}
        </button>
      </div>
    </form>
  );
}
```

> **Note on icons:** `UserIcon` and `PasswordIcon` are both exported from `src/assets/icons.tsx`.

- [ ] **Step 14.2: Replace `src/components/Auth/Signin/index.tsx`**

```tsx
import SigninWithPassword from "../SigninWithPassword";

export default function Signin() {
  return <SigninWithPassword />;
}
```

- [ ] **Step 14.3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

If `UsernameIcon` is missing, find the correct icon name and fix the import.

- [ ] **Step 14.4: Commit**

```bash
git add src/components/Auth/
git commit -m "feat: connect sign-in form to backend login API with error handling"
```

---

## Task 15: Change Password Component and Profile Page

**Files:**
- Create: `src/components/Auth/ChangePassword.tsx`
- Modify: `src/app/profile/page.tsx`

- [ ] **Step 15.1: Create `src/components/Auth/ChangePassword.tsx`**

```tsx
"use client";

import React, { useState } from "react";

export default function ChangePassword() {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (form.newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });

      if (response.ok) {
        setSuccess(true);
        setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setTimeout(() => {
          window.location.href = "/auth/sign-in";
        }, 2000);
      } else {
        const json = await response.json().catch(() => ({}));
        setError(json.error ?? "Failed to change password");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-[10px] bg-white p-6 shadow-1 dark:bg-gray-dark dark:shadow-card">
      <h3 className="mb-6 text-lg font-semibold text-dark dark:text-white">
        Change Password
      </h3>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
            Current Password
          </label>
          <input
            type="password"
            name="currentPassword"
            value={form.currentPassword}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white dark:focus:border-primary"
            placeholder="Enter current password"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
            New Password
          </label>
          <input
            type="password"
            name="newPassword"
            value={form.newPassword}
            onChange={handleChange}
            required
            minLength={8}
            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white dark:focus:border-primary"
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-dark dark:text-white">
            Confirm New Password
          </label>
          <input
            type="password"
            name="confirmPassword"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-stroke bg-transparent px-4 py-3 text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white dark:focus:border-primary"
            placeholder="Repeat new password"
          />
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}

        {success && (
          <p className="rounded-lg bg-green-50 px-4 py-2 text-sm text-green-600 dark:bg-green-900/20 dark:text-green-400">
            Password changed. Redirecting to login...
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-white transition hover:bg-opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Update Password
          {loading && (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
          )}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 15.2: Add `<ChangePassword />` to `src/app/profile/page.tsx`**

At the top of the file, add:
```tsx
import ChangePassword from "@/components/Auth/ChangePassword";
```

At the end of the returned JSX, before the closing `</div>` of the outer wrapper (`mx-auto w-full max-w-[970px]`), add:

```tsx
<div className="mt-6">
  <ChangePassword />
</div>
```

- [ ] **Step 15.3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 15.4: Commit**

```bash
git add src/components/Auth/ChangePassword.tsx src/app/profile/page.tsx
git commit -m "feat: add change password form to profile page"
```

---

## Manual Smoke Test Checklist

After all tasks are complete, start both servers and verify:

```bash
# Terminal 1
cd musicserver-backend && npm start

# Terminal 2
cd musicserver-admin-ui && npm run dev
```

- [ ] Open `http://localhost:3001` — redirects to `/auth/sign-in` (no logged-in state)
- [ ] Login with `admin` / `admin` — redirects to dashboard
- [ ] Refresh page — stays on dashboard (cookie persists)
- [ ] Navigate to `/profile` — change-password form visible
- [ ] Try changing password with wrong current password — error shown
- [ ] Change password to a new one (≥8 chars) — redirect to sign-in
- [ ] Login with old password — fails with "Invalid credentials"
- [ ] Login with new password — succeeds
- [ ] Admin proxy API calls work (e.g., plugins page loads data)
- [ ] Clear cookie manually in DevTools → page redirects to sign-in
- [ ] Rate limit: submit login with wrong credentials 5 times — 6th attempt returns 429
