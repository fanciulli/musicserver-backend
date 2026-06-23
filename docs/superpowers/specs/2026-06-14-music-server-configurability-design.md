# Music Server Configurability — Design

Issue: [fanciulli/musicserver-backend#101](https://github.com/fanciulli/musicserver-backend/issues/101)
Date: 2026-06-14

## Goal

Add a Settings section where Music Server configuration parameters can be viewed and
edited. Configuration is retrieved from the backend (label + type + current value per
parameter), edited in the Admin UI, and saved back. Values persist in MongoDB across
reboots. Invalid values produce a `40x` response whose error message is shown to the
user in a modal.

## Scope decisions

- **Generic registry, start small.** The backend defines a config *registry* (the single
  source of truth for keys/labels/types/defaults/validation). It is seeded with two
  generic test parameters — one `string`, one `boolean` — to exercise both UI widgets and
  the validation/error path. Real parameters are added later by extending the registry.
- **Save only, no runtime wiring.** This issue builds the registry, storage, `GET`/`PUT`
  APIs, and UI. The running server does **not** yet read these stored values; wiring
  config into startup is a separate future issue. No live reload, per the issue.
- **Only `string` and `boolean` types** are supported (text edit / toggle).

### Seed parameters

| key            | label        | type    | default | validation             |
| -------------- | ------------ | ------- | ------- | ---------------------- |
| `test.string`  | Test String  | string  | `""`    | non-empty string       |
| `test.boolean` | Test Boolean | boolean | `false` | must be a boolean      |

The non-empty validation on `test.string` exercises the `40x` error-modal path (saving an
empty value fails).

## Backend (musicserver-backend)

### 1. Config registry — `src/misc/configRegistry.ts`

The single source of truth. An array of parameter definitions:

```
type ConfigType = "string" | "boolean";

interface ConfigParamDefinition {
  key: string;
  label: string;
  type: ConfigType;
  defaultValue: string | boolean;
  // returns an error message string if invalid, or null if valid
  validate: (value: unknown) => string | null;
}
```

Seeded with `test.string` and `test.boolean` as above. Helpers: `getDefinition(key)`,
`getAllDefinitions()`.

### 2. Storage — `src/types/db/serverConfig.ts`

Collection `serverConfig`, one document per key: `{ key: string, value: string | boolean }`.
Mirrors `PluginConfigDBModel`:

- `findAll(db): Promise<ServerConfigDBModel[]>`
- `upsertMany(db, entries: { key, value }[]): Promise<void>` — upsert each by `key`.

### 3. Service — `src/utils/configService.ts`

- `getConfig(db)` → for each registry definition, look up the stored value (fallback to
  `defaultValue`) and return `[{ key, label, type, value }]`.
- `updateConfig(db, values: Record<string, unknown>)`:
  - For each incoming entry: reject unknown keys; run the registry `validate`. On the first
    failure return `{ error: <message> }`.
  - On success: `upsertMany` the validated values, then return the merged config in the same
    shape as `getConfig`.

### 4. Routes + schemas

- `src/types/api/config.ts` — Fastify schemas (`ConfigGetSchema`, `ConfigUpdateSchema`) and
  response types, following `src/types/api/plugins.ts` style.
- `src/routes/admin/configGet.ts` — `GET /admin/config`, `requiresAuth = true`.
- `src/routes/admin/configUpdate.ts` — `PUT /admin/config`, `requiresAuth = true`. On
  validation failure: `response.status(400).send({ error })`, mirroring
  `src/routes/admin/pluginConfigUpdate.ts`.

Both routes register automatically behind the session-token `onRequest` hook because their
URL begins with `/admin` (see `RouteController.registerRoutes`).

`GET /admin/config` response body:

```
[ { "key": "test.string",  "label": "Test String",  "type": "string",  "value": "" },
  { "key": "test.boolean", "label": "Test Boolean", "type": "boolean", "value": false } ]
```

`PUT /admin/config` request body: `{ "values": { "test.string": "abc", "test.boolean": true } }`.
Success → `200` with the same array shape as `GET`. Invalid → `400` `{ "error": "<message>" }`.

### 5. Backend tests (vitest)

- Registry validators (valid + invalid cases for each seed param).
- `configService.getConfig` merge (stored value overrides default; missing → default).
- `configService.updateConfig` (valid persist; unknown key rejected; invalid value → error).
- Both route handlers (auth path is shared infra; test the handler logic incl. `400` body).

## Admin UI (musicserver-admin-ui)

### 6. Sidebar nav

Add to the existing `SETTINGS` section in
`src/components/Layouts/sidebar/data/index.ts`:

```
{ title: "Settings", url: "/settings", icon: SlidersHorizontal, items: [] }
```

(`SlidersHorizontal` from `lucide-react`.)

### 7. BFF proxy — `src/app/api/admin/config/route.ts`

`GET` and `PUT` handlers proxying to backend `/admin/config`, attaching the bearer token via
`buildAdminHeaders` / `buildAdminJsonHeaders`, and **passing the backend status + body
through unchanged** (mirrors `src/app/api/admin/notifications/route.ts`). This ensures the
backend's `40x` status and `{ error }` body reach the client intact.

### 8. Settings page — `src/app/(admin)/settings/page.tsx` + `_components/`

Client component:

- On load, `GET /api/admin/config`; render one **row per parameter**: label on the left,
  widget on the right, **same line**.
  - `string` → text input.
  - `boolean` → toggle.
- **Save** button → `PUT /api/admin/config` with `{ values }`.
  - `200` → update local state / show success.
  - `40x` → read `error` from the response body → show **error modal dialog**.

### Data flow

Browser → Next BFF (`/api/admin/config`, adds token) → backend `/admin/config` → MongoDB.
Validation error `400 { error }` flows back through the BFF unchanged → client modal.

## Error handling

- Backend validation failure → `400 { error: "<message>" }` (first failing param's message).
- BFF passes status + body through verbatim.
- Client surfaces `error` text in a modal; no save is persisted.

## Out of scope

- Reading stored config into the running server / startup wiring (future issue).
- Live update / backend reload.
- Parameter types beyond `string` and `boolean`.
- Real configuration parameters (only the two test params for now).
