# Notifications — Design

Issue: [fanciulli/musicserver-backend#100](https://github.com/fanciulli/musicserver-backend/issues/100)

Date: 2026-06-13

## Summary

Add a notification capability spanning the backend and the admin-ui. Notifications
can target a single user or all users, are stored in MongoDB, and expire
automatically after a configurable amount of time (default 1 day). The backend
exposes a programmatic API (used first by the filesystem scan process) and a REST
API for fetching, marking-as-read, and deleting notifications. The admin-ui shows a
bell icon with an unread badge and dropdown in the top bar plus a dedicated
notifications page, both following Style 1 from the NextAdmin reference.

Spans two repositories:
- `musicserver-backend` — data model, programmatic send API, REST API, TTL expiry, scan integration, ADR.
- `musicserver-admin-ui` — bell dropdown with unread badge, notifications page, API proxy routes.

## Backend

### Data model — `src/types/db/notification.ts`

Collection `notifications`. Follows the existing DbModel pattern (`userSession.ts`,
`apiKey.ts`): a class with public fields, static query/command methods, and an
`init(db)` for indexes.

```ts
class NotificationDbModel {
  id: string;                                       // uuid v4
  recipient: string | null;                         // username, null = all users (broadcast)
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  createdAt: Date;
  expiresAt: Date;                                  // default createdAt + MILLISECONDS_PER_DAY
  readBy: string[];                                 // usernames that marked it read
}
```

Read state is tracked per user via `readBy` (a single boolean cannot represent
read state for a broadcast notification read independently by many users).

Static methods (the programmatic send API used by plugins / scan):

- `sendToUser(db, username, { title, message, type })` — inserts a notification with `recipient = username`.
- `sendToAll(db, { title, message, type })` — inserts a notification with `recipient = null`.
- `findForUser(db, username)` — `recipient == username OR recipient == null`, sorted by `createdAt` descending.
- `markRead(db, id, username)` — `$addToSet` `username` into `readBy`.
- `deleteById(db, id)` — hard delete by `id`, no permission check.
- `init(db)` — TTL index on `expiresAt` (`expireAfterSeconds: 0`), plus indexes on `recipient` and `createdAt` (desc).

Default expiry uses the existing `MILLISECONDS_PER_DAY` constant in
`src/misc/constants.ts`. Music Server configurability of the expiry is deferred to
another PR (per the issue).

### REST API

Admin routes (session-auth; `request.username` is provided by the existing
`onRequest` hook in `routeController.ts`). Route files auto-registered from
`src/routes/admin/`, schemas in `src/types/api/notifications.ts`.

- `GET /admin/notifications` (`notificationsList.ts`) — returns `findForUser` results mapped to
  `{ id, title, message, type, createdAt, read }`, where `read = username ∈ readBy` (computed server-side).
- `POST /admin/notifications/:id/read` (`notificationRead.ts`) — marks the notification read for the current user.
- `DELETE /admin/notifications/:id` (`notificationsDelete.ts`) — hard delete by id. No permission/role check: any user may delete any notification, including broadcasts (per the issue). Returns 404 if not found.

### Scan integration

In `FileSystemScan.scan` (`src/plugins/music_sources/filesystem-music-source/scan.ts`):

- At the start of the scan (after acquiring the scan queue / before processing): `sendToAll(db, { title: "Library scan started", message: "Scanning <musicFolder>", type: "info" })`.
- On successful completion (end of the `try`, before/within `finally`): `sendToAll(db, { title: "Library scan completed", message: "<N> tracks indexed", type: "success" })`, where `<N>` is the number of songs processed.
- On a fatal scan error: `sendToAll(db, { title: "Library scan failed", message: <error message>, type: "error" })`.

`scan()` is fire-and-forget (not awaited by the route), so notification sends
happen inside `FileSystemScan.scan` itself.

### ADR

`docs/adr/0006-defer-user-roles-for-notifications.md` (next free ADR number).
Records that notification delete performs no permission/role check — any user can
delete notifications addressed to all users — because the system currently has no
concept of user roles. Status: Accepted. Follow-up: introduce RBAC and re-evaluate
delete authorization.

## Admin-ui

NextAdmin (Next.js App Router). Server routes proxy to the backend using
`buildMusicServerUrl` + `buildAdminHeaders` (`src/lib/musicserver-api.ts`); client
components call them through `apiFetch` (`src/lib/api-client.ts`) which handles
session expiry.

### API proxy routes

Mirror the existing proxy pattern (e.g. `app/api/logs/route.ts`, `app/api/admin/api-keys/`):

- `src/app/api/admin/notifications/route.ts` — `GET`.
- `src/app/api/admin/notifications/[id]/route.ts` — `DELETE`.
- `src/app/api/admin/notifications/[id]/read/route.ts` — `POST`.

### Bell + dropdown

Rewrite `src/components/Layouts/header/notification/index.tsx`:

- Fetch real data from `/api/admin/notifications`.
- Unread badge "N new" where N = count of items with `read == false`; the ping dot shows when N > 0.
- Style 1 list: an icon chosen by `type` (info/success/warning/error → icon + color), title, message, and relative time via `src/lib/format-message-time.ts`.
- Clicking an item marks it read (`POST /api/admin/notifications/:id/read`) and updates local state.
- "See all notifications" links to the notifications page.

Mount `<Notification />` in `src/components/Layouts/header/index.tsx` (it is
currently not rendered).

### Notifications page

- `src/app/(admin)/notifications/page.tsx` — page shell with metadata.
- `src/app/(admin)/notifications/_components/notifications-card.tsx` — full list, Style 1, descending by `createdAt`, per-row delete (`DELETE /api/admin/notifications/:id`), click-to-mark-read.

A shared helper maps `type` → icon + color for both the dropdown and the page.

## Read-state behavior

- `read` is per user (`readBy`).
- Marking read happens when the user clicks a single item (in the dropdown and on the page).
- The bell badge "N new" counts unread items for the current user.

## Testing

- Backend (vitest): unit tests for `NotificationDbModel` (mocked `Db`, mirroring `test/types/db/apiKey.test.ts`); route tests mirroring existing `test/routes/*`; `test/plugins/scan.test.ts` updated to assert `sendToAll` is called at scan start and completion.
- Admin-ui: no test runner is configured in the repo; verification via `next build` and `next lint`.

## Out of scope

- Music Server configurability of the expiry duration (separate PR per the issue).
- User roles / RBAC and authorization on delete (tracked by ADR 0006).
