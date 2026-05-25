# Session-Based Authentication — Design Spec

**Date:** 2026-05-25  
**Scope:** musicserver-backend + musicserver-admin-ui  
**Branch:** dev-security

---

## Overview

Replace the existing `fastify-auth-by-api-key` mechanism on `/admin` routes with a session-token-based authentication system. The admin UI logs in with username/password, receives a short-lived token stored in an HttpOnly cookie, and all subsequent API calls carry that token. The backend validates the token on every protected `/admin` request.

---

## Architecture

```
Browser
  │  (HttpOnly cookie: session_token=<token>; Secure; SameSite=Strict)
  ▼
Next.js (port 3001)
  ├── src/middleware.ts              ← route guard: redirect to /auth/sign-in if no cookie
  ├── /auth/sign-in                  ← login page (standalone layout, no sidebar)
  ├── /profile                       ← includes change-password form
  └── /api/auth/login/route.ts       ← sets HttpOnly cookie, proxies to backend
      /api/auth/logout/route.ts       ← clears cookie
      /api/auth/change-password/route.ts
      /api/admin/**/route.ts          ← all existing proxies: extract cookie → Bearer header
  │
  ▼
Fastify backend (port 3000)
  ├── POST /admin/login               ← public, rate-limited
  └── [scoped Fastify plugin]
        onRequest hook: validateSessionToken
        ├── POST /admin/change-password
        └── GET/POST/DELETE /admin/...  (all existing admin routes)
```

---

## Backend Changes

### New DB model: `src/types/db/userPassword.ts`

Collection: `user_passwords`

```ts
{
  id: string           // uuid v4
  username: string     // unique index
  passwordHash: string // format: "scrypt:<N>:<r>:<p>:<saltHex>:<hashHex>"
  createdAt: Date
}
```

- Unique index on `username`
- `init(db)` function:
  1. Creates unique index
  2. Seeds default admin user if not exists: `username=admin`, `password=admin` (hashed)

### New DB model: `src/types/db/userSession.ts`

Collection: `user_sessions`

```ts
{
  id: string           // uuid v4
  username: string     // index (non-unique)
  tokenHash: string    // sha256 of full token; indexed
  createdAt: Date
  expiresAt: Date      // createdAt + 8h; TTL index for auto-cleanup
}
```

- Index on `tokenHash`
- TTL index on `expiresAt` (MongoDB auto-deletes expired docs)

### New utility: `src/utils/sessionAuthUtils.ts`

Functions:
- `hashPassword(password: string): Promise<string>` — scrypt with 16-byte random salt; encodes as `"scrypt:N:r:p:<saltHex>:<hashHex>"`
- `verifyPassword(password: string, storedHash: string): Promise<boolean>` — parses encoded hash, runs scrypt, timing-safe compare
- `generateSessionToken(username: string): string` — `base64url(username) + "." + randomBytes(32).hex`
- `hashToken(token: string): string` — sha256 of full token
- `extractUsernameFromToken(token: string): string | null` — splits on `.`, base64-decodes prefix

### New rate limiter: `src/utils/loginRateLimiter.ts`

In-memory `Map<string, {count: number, resetAt: Date}>`. Per-IP tracking.
- Max: 5 failed attempts per 15 minutes
- On exceed: 429 with `Retry-After` header
- On successful login: resets counter for that IP

### New route: `src/routes/admin/login.ts`

```
POST /admin/login
requiresAuth = false
```

Request body:
```json
{ "username": "string", "password": "string" }
```

Response 200:
```json
{ "token": "string", "expiresAt": "ISO8601" }
```

Response 401: `{ "error": "Invalid credentials" }` (same message for unknown user AND wrong password — OWASP)  
Response 429: `{ "error": "Too many attempts" }`

Logic:
1. Check rate limiter for request IP
2. Find user in `user_passwords` by username
3. `verifyPassword(body.password, user.passwordHash)` — if false or user not found: increment rate limit, return 401
4. Delete existing sessions for this username (single active session policy)
5. Generate token, store hash in `user_sessions` with `expiresAt = now + 8h`
6. Reset rate limiter for IP
7. Return `{ token, expiresAt }`

### New route: `src/routes/admin/changePassword.ts`

```
POST /admin/change-password
requiresAuth = true (session token)
```

Request body:
```json
{ "currentPassword": "string", "newPassword": "string" }
```

Response 200: `{ "success": true }`  
Response 400: `{ "error": "New password must be at least 8 characters" }`  
Response 401: `{ "error": "Invalid credentials" }`

Logic:
1. Extract username from request (injected by auth hook from token)
2. Verify `currentPassword` against stored hash
3. Validate `newPassword` length >= 8
4. Update `passwordHash` in `user_passwords`
5. Delete all sessions for this user (force re-login)

### Modified: `src/routes/routeController.ts`

Keep `apiKeyPlugin` for non-admin authenticated routes (e.g. `/music`). Add a **second** scoped plugin for admin routes. Split `authenticatedRoutes` into `apiKeyRoutes` (non-admin) and `adminRoutes` (`/admin/*`):

```ts
// Login: public (requiresAuth = false) — registered outside both plugins

// Plugin 1: API key auth for /music and other non-admin routes
await fastifyInstance.register(async (app) => {
  await app.register(apiKeyPlugin, {
    checkApiKey: (key) => validateApiKey(db, key),
    allowInHeader: true,
    allowAsQueryParameter: true,
  });
  for (const route of apiKeyRoutes) { await registerRoute(app, route); }
});

// Plugin 2: Session token auth for /admin/* routes
await fastifyInstance.register(async (app) => {
  app.addHook('onRequest', async (request, reply) => {
    const authHeader = request.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) { reply.code(401).send({ error: 'Unauthorized' }); return; }
    const username = extractUsernameFromToken(token);
    if (!username) { reply.code(401).send({ error: 'Unauthorized' }); return; }
    const hash = hashToken(token);
    const session = await db.collection('user_sessions').findOne({
      username, tokenHash: hash, expiresAt: { $gt: new Date() }
    });
    if (!session) { reply.code(401).send({ error: 'Unauthorized' }); return; }
    (request as any).username = username;
  });
  for (const route of adminRoutes) { await registerRoute(app, route); }
});
```

---

## Frontend Changes

### New: `src/app/auth/layout.tsx`

Standalone layout (overrides root layout's Sidebar+Header for auth pages):

```tsx
export default function AuthLayout({ children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-2 dark:bg-[#020d1a]">
      {children}
    </main>
  );
}
```

### Modified: `src/components/Auth/SigninWithPassword.tsx`

- Remove Google signin, "Sign Up" link, "Forgot Password" link
- Replace `email` field with `username` field (admin panel uses username not email)
- On submit: POST to `/api/auth/login` with `{username, password}`
- On success: `router.push('/')` (redirect to dashboard)
- On error: display error message inline
- Loading state during fetch

### Modified: `src/components/Auth/Signin/index.tsx`

Remove Google signin button and divider, keep only `SigninWithPassword`.

### New: `src/app/api/auth/login/route.ts`

```ts
POST /api/auth/login
```

1. Forward `{username, password}` to `POST http://backend/admin/login`
2. On success: set cookie `session_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=<8h in seconds>`
3. Return `{ success: true }` (do NOT return token to browser JS)
4. On error: forward status + error message

### New: `src/app/api/auth/logout/route.ts`

```ts
POST /api/auth/logout
```

1. Clear `session_token` cookie (set expired)
2. Return redirect to `/auth/sign-in`

### New: `src/app/api/auth/change-password/route.ts`

```ts
POST /api/auth/change-password
```

1. Extract token from cookie
2. Forward `{currentPassword, newPassword}` to `POST http://backend/admin/change-password` with `Authorization: Bearer <token>`
3. On success: clear session cookie (backend invalidated it), redirect to login
4. On error: forward error

### Modified: `src/middleware.ts` (new file)

```ts
export function middleware(request: NextRequest) {
  const isAuthPage = request.nextUrl.pathname.startsWith('/auth');
  const isApiAuth = request.nextUrl.pathname.startsWith('/api/auth');
  const hasToken = request.cookies.has('session_token');

  if (!isAuthPage && !isApiAuth && !hasToken) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  }
  if (isAuthPage && hasToken) {
    return NextResponse.redirect(new URL('/', request.url));
  }
}

export const config = { matcher: ['/((?!_next|favicon.ico|images|css|fonts).*)'] };
```

### Modified: all `src/app/api/admin/**/route.ts`

Each proxy extracts the cookie and forwards as Bearer header:

```ts
const token = request.cookies.get('session_token')?.value;
const headers: HeadersInit = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};
```

### New: `src/components/Auth/ChangePassword.tsx`

Client component with form: `currentPassword`, `newPassword`, `confirmNewPassword`.
Validates `newPassword === confirmNewPassword` client-side before submit.
POST to `/api/auth/change-password`.
On success: shows confirmation, clears form.

### Modified: `src/app/profile/page.tsx`

Add `<ChangePassword />` component below existing profile content in a new card section.

---

## OWASP Compliance Summary

| Control | Implementation |
|---------|---------------|
| Password storage | `crypto.scrypt` with 16-byte random salt (OWASP: use adaptive hash) |
| Token entropy | `crypto.randomBytes(32)` = 256 bits (OWASP: min 128 bits) |
| Token transport | HttpOnly cookie — not accessible from JS (OWASP: prevent XSS theft) |
| Cookie flags | `Secure; SameSite=Strict` (OWASP: prevent CSRF + eavesdropping) |
| Brute force | 5 failed attempts / 15 min / IP → 429 (OWASP: account lockout) |
| Timing attack | `crypto.timingSafeEqual` for hash comparison |
| Generic errors | "Invalid credentials" regardless of reason (OWASP: no enumeration) |
| Session expiry | 8h TTL; logout clears server-side session (OWASP: session termination) |
| Password policy | Minimum 8 characters, validated server-side |
| Token in logs | Never log raw tokens; only log username (OWASP: sensitive data exposure) |

---

## File Inventory

### Backend (`musicserver-backend/src/`)

New files:
- `types/db/userPassword.ts`
- `types/db/userSession.ts`
- `utils/sessionAuthUtils.ts`
- `utils/loginRateLimiter.ts`
- `routes/admin/login.ts`
- `routes/admin/changePassword.ts`

Modified files:
- `routes/routeController.ts` — keep apiKeyPlugin for non-admin routes; add session token scoped plugin for `/admin/*` routes
- `routes/admin/adminLogs.ts` — set `requiresAuth = true`
- `routes/admin/apiKeysCreate.ts` — set `requiresAuth = true`
- `routes/admin/apiKeysDelete.ts` — set `requiresAuth = true`
- `routes/admin/apiKeysList.ts` — set `requiresAuth = true`
- `routes/admin/dbAlbums.ts` — set `requiresAuth = true`
- `routes/admin/dbArtists.ts` — set `requiresAuth = true`
- `routes/admin/dbSongs.ts` — set `requiresAuth = true`
- `routes/admin/dbSummary.ts` — set `requiresAuth = true`
- `routes/admin/pluginConfigGet.ts` — set `requiresAuth = true`
- `routes/admin/pluginConfigUpdate.ts` — set `requiresAuth = true`
- `routes/admin/pluginStart.ts` — set `requiresAuth = true`
- `routes/admin/pluginStop.ts` — set `requiresAuth = true`
- `routes/admin/plugins.ts` — set `requiresAuth = true`

> **Note:** All existing admin routes currently default to `requiresAuth = false`. They must be flipped to `true` so they are wrapped by the session-token scoped plugin and protected by the auth hook.

### Frontend (`musicserver-admin-ui/src/`)

New files:
- `app/auth/layout.tsx`
- `app/api/auth/login/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/change-password/route.ts`
- `middleware.ts`
- `components/Auth/ChangePassword.tsx`

Modified files:
- `components/Auth/SigninWithPassword.tsx`
- `components/Auth/Signin/index.tsx`
- `app/profile/page.tsx`
- `app/api/admin/**/route.ts` (all proxy routes — add Authorization header from cookie)

---

## Open Questions / Notes

- `fastify-auth-by-api-key` is **kept** — it continues to protect `/music` routes via API key auth.
- "Remember me" checkbox removed from login (8h fixed expiry; no persistent sessions for security).
- Multi-session support not implemented (each login invalidates previous session for that user).
- No password reset flow (out of scope).
