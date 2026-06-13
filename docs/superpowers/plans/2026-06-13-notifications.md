# Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a notification capability — backend storage + programmatic send API + REST API with auto-expiry, the filesystem scan emitting notifications, and an admin-ui bell dropdown with unread badge plus a notifications page.

**Architecture:** Backend follows the existing DbModel pattern (`apiKey.ts`, `userSession.ts`): a `NotificationDbModel` class with static command/query methods and an `init(db)` for indexes (MongoDB TTL on `expiresAt`). Admin routes auto-register from `src/routes/admin/` and read `request.username` from the existing session-auth hook. Admin-ui adds Next.js proxy routes mirroring `app/api/logs` and `app/api/admin/api-keys`, rewrites the existing bell component to use real data, and adds a notifications page.

**Tech Stack:** Backend: TypeScript, Fastify 5, MongoDB 7, vitest. Admin-ui: Next.js 16 (App Router), React 19, Tailwind, lucide-react.

**Repositories (both under `claude-feat-notifications/`):**
- Backend: `musicserver-backend` — Tasks 1–7.
- Admin-ui: `musicserver-admin-ui` — Tasks 8–13.

All backend paths below are relative to the `musicserver-backend` repo root; all admin-ui paths are relative to the `musicserver-admin-ui` repo root.

**Run backend tests with:** `npm test` (vitest). Single file: `npx vitest run test/path/file.test.ts`.

---

## Task 1: NotificationDbModel

**Files:**
- Create: `src/types/db/notification.ts`
- Test: `test/types/db/notification.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/types/db/notification.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { NotificationDbModel, init } from "../../../src/types/db/notification.js";

function makeCollection(overrides: Record<string, unknown> = {}) {
  return {
    insertOne: vi.fn().mockResolvedValue({}),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
    }),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    createIndex: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function makeDb(col = makeCollection()) {
  return { db: { collection: vi.fn().mockReturnValue(col) } as any, col };
}

describe("init", () => {
  it("creates a TTL index on expiresAt and supporting indexes", async () => {
    const { db, col } = makeDb();
    await init(db);
    expect(db.collection).toHaveBeenCalledWith("notifications");
    expect(col.createIndex).toHaveBeenCalledWith(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 },
    );
    expect(col.createIndex).toHaveBeenCalledWith({ recipient: 1 });
    expect(col.createIndex).toHaveBeenCalledWith({ createdAt: -1 });
  });
});

describe("NotificationDbModel.sendToUser", () => {
  it("inserts a notification addressed to one user with a default expiry", async () => {
    const { db, col } = makeDb();
    await NotificationDbModel.sendToUser(db, "alice", {
      title: "Hi",
      message: "msg",
      type: "info",
    });
    const inserted = col.insertOne.mock.calls[0][0];
    expect(inserted.recipient).toBe("alice");
    expect(inserted.title).toBe("Hi");
    expect(inserted.type).toBe("info");
    expect(inserted.readBy).toEqual([]);
    expect(inserted.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("NotificationDbModel.sendToAll", () => {
  it("inserts a broadcast notification with null recipient", async () => {
    const { db, col } = makeDb();
    await NotificationDbModel.sendToAll(db, {
      title: "All",
      message: "msg",
      type: "success",
    });
    expect(col.insertOne.mock.calls[0][0].recipient).toBeNull();
  });
});

describe("NotificationDbModel.findForUser", () => {
  it("queries own + broadcast notifications sorted by createdAt desc", async () => {
    const toArray = vi.fn().mockResolvedValue([{ id: "1" }]);
    const sort = vi.fn().mockReturnValue({ toArray });
    const find = vi.fn().mockReturnValue({ sort });
    const { db } = makeDb(makeCollection({ find }));
    const result = await NotificationDbModel.findForUser(db, "alice");
    expect(find).toHaveBeenCalledWith({
      $or: [{ recipient: "alice" }, { recipient: null }],
    });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(result).toHaveLength(1);
  });
});

describe("NotificationDbModel.markRead", () => {
  it("adds the username to readBy and returns true when matched", async () => {
    const { db, col } = makeDb();
    const ok = await NotificationDbModel.markRead(db, "id-1", "alice");
    expect(col.updateOne).toHaveBeenCalledWith(
      { id: "id-1" },
      { $addToSet: { readBy: "alice" } },
    );
    expect(ok).toBe(true);
  });

  it("returns false when no notification matched", async () => {
    const { db } = makeDb(makeCollection({
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 0 }),
    }));
    expect(await NotificationDbModel.markRead(db, "missing", "alice")).toBe(false);
  });
});

describe("NotificationDbModel.deleteById", () => {
  it("returns true when deleted", async () => {
    const { db } = makeDb();
    expect(await NotificationDbModel.deleteById(db, "id-1")).toBe(true);
  });

  it("returns false when not found", async () => {
    const { db } = makeDb(makeCollection({
      deleteOne: vi.fn().mockResolvedValue({ deletedCount: 0 }),
    }));
    expect(await NotificationDbModel.deleteById(db, "missing")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/types/db/notification.test.ts`
Expected: FAIL — cannot find module `notification.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/types/db/notification.ts`:

```ts
/*
 * Created on Sat Jun 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import type { Db } from "mongodb";
import { v4 } from "uuid";
import { MILLISECONDS_PER_DAY } from "../../misc/constants.js";

const COLLECTION_NAME = "notifications";

export type NotificationType = "info" | "success" | "warning" | "error";

export type NotificationInput = {
  title: string;
  message: string;
  type: NotificationType;
};

export class NotificationDbModel {
  id: string = v4();
  recipient: string | null = null;
  title: string = "";
  message: string = "";
  type: NotificationType = "info";
  createdAt: Date = new Date();
  expiresAt: Date = new Date(Date.now() + MILLISECONDS_PER_DAY);
  readBy: string[] = [];

  static async sendToUser(
    db: Db,
    username: string,
    input: NotificationInput,
  ): Promise<void> {
    const model = new NotificationDbModel();
    model.recipient = username;
    model.title = input.title;
    model.message = input.message;
    model.type = input.type;
    await db.collection<NotificationDbModel>(COLLECTION_NAME).insertOne(model);
  }

  static async sendToAll(db: Db, input: NotificationInput): Promise<void> {
    const model = new NotificationDbModel();
    model.recipient = null;
    model.title = input.title;
    model.message = input.message;
    model.type = input.type;
    await db.collection<NotificationDbModel>(COLLECTION_NAME).insertOne(model);
  }

  static async findForUser(
    db: Db,
    username: string,
  ): Promise<NotificationDbModel[]> {
    return db
      .collection<NotificationDbModel>(COLLECTION_NAME)
      .find({ $or: [{ recipient: username }, { recipient: null }] })
      .sort({ createdAt: -1 })
      .toArray();
  }

  static async markRead(
    db: Db,
    id: string,
    username: string,
  ): Promise<boolean> {
    const result = await db
      .collection<NotificationDbModel>(COLLECTION_NAME)
      .updateOne({ id }, { $addToSet: { readBy: username } });
    return result.matchedCount > 0;
  }

  static async deleteById(db: Db, id: string): Promise<boolean> {
    const result = await db
      .collection<NotificationDbModel>(COLLECTION_NAME)
      .deleteOne({ id });
    return result.deletedCount > 0;
  }
}

export async function init(db: Db): Promise<void> {
  const collection = db.collection(COLLECTION_NAME);
  await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await collection.createIndex({ recipient: 1 });
  await collection.createIndex({ createdAt: -1 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/types/db/notification.test.ts`
Expected: PASS (all describes green).

- [ ] **Step 5: Commit**

```bash
git add src/types/db/notification.ts test/types/db/notification.test.ts
git commit -m "feat: add NotificationDbModel with TTL expiry (#100)"
```

---

## Task 2: API schemas

**Files:**
- Create: `src/types/api/notifications.ts`

No test (declarative schema constants; exercised by the route tests in Tasks 3–5).

- [ ] **Step 1: Create the schema file**

Create `src/types/api/notifications.ts`:

```ts
/*
 * Created on Sat Jun 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */

export type NotificationResponse = {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  read: boolean;
};

export const NotificationSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    message: { type: "string" },
    type: { type: "string" },
    createdAt: { type: "string" },
    read: { type: "boolean" },
  },
};

export const NotificationsListSchema = {
  response: {
    200: {
      type: "array",
      items: NotificationSchema,
    },
  },
};

export const NotificationReadSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
};

export const NotificationDeleteSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/api/notifications.ts
git commit -m "feat: add notification API schemas (#100)"
```

---

## Task 3: GET /admin/notifications route

**Files:**
- Create: `src/routes/admin/notificationsList.ts`
- Test: `test/routes/notifications.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/routes/notifications.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findForUser: vi.fn(),
  markRead: vi.fn(),
  deleteById: vi.fn(),
}));

vi.mock("../../src/types/db/notification.js", () => ({
  NotificationDbModel: {
    findForUser: (...a: unknown[]) => mocks.findForUser(...a),
    markRead: (...a: unknown[]) => mocks.markRead(...a),
    deleteById: (...a: unknown[]) => mocks.deleteById(...a),
  },
}));

import { default as NotificationsList } from "../../src/routes/admin/notificationsList.js";

function createResponseMock() {
  return {
    code: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

function createRouteContext() {
  return {
    database: "db-client",
    logger: { info: vi.fn(), error: vi.fn() },
  } as any;
}

describe("NotificationsList route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns notifications for the current user with computed read flag", async () => {
    const createdAt = new Date("2026-06-13T10:00:00.000Z");
    mocks.findForUser.mockResolvedValue([
      {
        id: "n1",
        title: "T",
        message: "M",
        type: "info",
        createdAt,
        recipient: null,
        readBy: ["alice"],
        expiresAt: new Date(),
      },
      {
        id: "n2",
        title: "T2",
        message: "M2",
        type: "success",
        createdAt,
        recipient: "alice",
        readBy: [],
        expiresAt: new Date(),
      },
    ]);

    const route = new NotificationsList(createRouteContext());
    const response = createResponseMock();
    await route.handler({ username: "alice" }, response);

    expect(mocks.findForUser).toHaveBeenCalledWith("db-client", "alice");
    expect(response.send).toHaveBeenCalledWith([
      {
        id: "n1",
        title: "T",
        message: "M",
        type: "info",
        createdAt: "2026-06-13T10:00:00.000Z",
        read: true,
      },
      {
        id: "n2",
        title: "T2",
        message: "M2",
        type: "success",
        createdAt: "2026-06-13T10:00:00.000Z",
        read: false,
      },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/routes/notifications.test.ts`
Expected: FAIL — cannot find module `notificationsList.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/routes/admin/notificationsList.ts`:

```ts
/*
 * Created on Sat Jun 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { NotificationsListSchema } from "../../types/api/notifications.js";
import { NotificationDbModel } from "../../types/db/notification.js";

export default class NotificationsList extends Route {
  method = HttpMethods.GET;
  url = "/admin/notifications";
  schema = NotificationsListSchema;
  requiresAuth = true;

  handler = async (request: any, response: any) => {
    const username = request.username as string;
    const notifications = await NotificationDbModel.findForUser(
      this.getDatabase(),
      username,
    );

    const result = notifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      createdAt:
        n.createdAt instanceof Date ? n.createdAt.toISOString() : n.createdAt,
      read: Array.isArray(n.readBy) && n.readBy.includes(username),
    }));

    response.send(result);
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/routes/notifications.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/notificationsList.ts test/routes/notifications.test.ts
git commit -m "feat: add GET /admin/notifications route (#100)"
```

---

## Task 4: POST /admin/notifications/:id/read route

**Files:**
- Create: `src/routes/admin/notificationRead.ts`
- Test: `test/routes/notifications.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/routes/notifications.test.ts` (add the import next to the existing one, and a new describe block):

```ts
import { default as NotificationRead } from "../../src/routes/admin/notificationRead.js";

describe("NotificationRead route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks the notification read for the current user", async () => {
    mocks.markRead.mockResolvedValue(true);
    const route = new NotificationRead(createRouteContext());
    const response = createResponseMock();
    await route.handler(
      { username: "alice", params: { id: "n1" } },
      response,
    );
    expect(mocks.markRead).toHaveBeenCalledWith("db-client", "n1", "alice");
    expect(response.send).toHaveBeenCalled();
    expect(response.code).not.toHaveBeenCalledWith(404);
  });

  it("responds 404 when the notification does not exist", async () => {
    mocks.markRead.mockResolvedValue(false);
    const route = new NotificationRead(createRouteContext());
    const response = createResponseMock();
    await route.handler(
      { username: "alice", params: { id: "missing" } },
      response,
    );
    expect(response.code).toHaveBeenCalledWith(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/routes/notifications.test.ts`
Expected: FAIL — cannot find module `notificationRead.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/routes/admin/notificationRead.ts`:

```ts
/*
 * Created on Sat Jun 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { NotificationReadSchema } from "../../types/api/notifications.js";
import { NotificationDbModel } from "../../types/db/notification.js";

export default class NotificationRead extends Route {
  method = HttpMethods.POST;
  url = "/admin/notifications/:id/read";
  schema = NotificationReadSchema;
  requiresAuth = true;

  handler = async (request: any, response: any) => {
    const username = request.username as string;
    const updated = await NotificationDbModel.markRead(
      this.getDatabase(),
      request.params.id,
      username,
    );

    if (!updated) {
      response.code(404).send();
      return;
    }

    response.send();
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/routes/notifications.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/notificationRead.ts test/routes/notifications.test.ts
git commit -m "feat: add POST /admin/notifications/:id/read route (#100)"
```

---

## Task 5: DELETE /admin/notifications/:id route

**Files:**
- Create: `src/routes/admin/notificationsDelete.ts`
- Test: `test/routes/notifications.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/routes/notifications.test.ts`:

```ts
import { default as NotificationsDelete } from "../../src/routes/admin/notificationsDelete.js";

describe("NotificationsDelete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes a notification by id without any permission check", async () => {
    mocks.deleteById.mockResolvedValue(true);
    const route = new NotificationsDelete(createRouteContext());
    const response = createResponseMock();
    await route.handler(
      { username: "anyone", params: { id: "n1" } },
      response,
    );
    expect(mocks.deleteById).toHaveBeenCalledWith("db-client", "n1");
    expect(response.send).toHaveBeenCalled();
  });

  it("responds 404 when the notification does not exist", async () => {
    mocks.deleteById.mockResolvedValue(false);
    const route = new NotificationsDelete(createRouteContext());
    const response = createResponseMock();
    await route.handler(
      { username: "anyone", params: { id: "missing" } },
      response,
    );
    expect(response.code).toHaveBeenCalledWith(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/routes/notifications.test.ts`
Expected: FAIL — cannot find module `notificationsDelete.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/routes/admin/notificationsDelete.ts`:

```ts
/*
 * Created on Sat Jun 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { NotificationDeleteSchema } from "../../types/api/notifications.js";
import { NotificationDbModel } from "../../types/db/notification.js";

export default class NotificationsDelete extends Route {
  method = HttpMethods.DELETE;
  url = "/admin/notifications/:id";
  schema = NotificationDeleteSchema;
  requiresAuth = true;

  handler = async (request: any, response: any) => {
    const deleted = await NotificationDbModel.deleteById(
      this.getDatabase(),
      request.params.id,
    );

    if (!deleted) {
      response.code(404).send();
      return;
    }

    response.send();
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/routes/notifications.test.ts`
Expected: PASS (all three route describes).

- [ ] **Step 5: Commit**

```bash
git add src/routes/admin/notificationsDelete.ts test/routes/notifications.test.ts
git commit -m "feat: add DELETE /admin/notifications/:id route (#100)"
```

---

## Task 6: Emit notifications from the filesystem scan

**Files:**
- Modify: `src/plugins/music_sources/filesystem-music-source/scan.ts`
- Test: `test/plugins/scan.test.ts` (add notification mock + assertions)

- [ ] **Step 1: Add the failing test assertions**

In `test/plugins/scan.test.ts`, add to the `vi.hoisted` mocks object a `sendToAll: vi.fn()` entry, then add this mock block next to the other `vi.mock` calls:

```ts
vi.mock("../../src/types/db/notification.js", () => ({
  NotificationDbModel: {
    sendToAll: (...args: unknown[]) => mocks.sendToAll(...args),
  },
}));
```

Then add a new test inside the existing top-level `describe` (after the existing scan tests). It drives a minimal successful scan and asserts the start + completion notifications. Match the existing test's setup for `listFiles`/`parseFile` — here we assume an empty music folder so no files are parsed:

```ts
it("sends start and completion notifications around a scan", async () => {
  mocks.listFiles.mockResolvedValue([]);
  const { FileSystemScan } = await import(
    "../../src/plugins/music_sources/filesystem-music-source/scan.js"
  );
  const context = {
    database: DB_CLIENT,
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn() },
  } as unknown as Context;

  await FileSystemScan.scan(context, PLUGIN_ID, MUSIC_FOLDER, true);

  expect(mocks.sendToAll).toHaveBeenCalledWith(
    DB_CLIENT,
    expect.objectContaining({ title: "Library scan started", type: "info" }),
  );
  expect(mocks.sendToAll).toHaveBeenCalledWith(
    DB_CLIENT,
    expect.objectContaining({
      title: "Library scan completed",
      type: "success",
    }),
  );
});
```

Note: if the existing test file already imports `FileSystemScan` at the top, reuse that import instead of the dynamic `await import` and drop the local import line.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/plugins/scan.test.ts`
Expected: FAIL — `sendToAll` not called (no notifications emitted yet).

- [ ] **Step 3: Implement the scan notifications**

In `src/plugins/music_sources/filesystem-music-source/scan.ts`:

3a. Add the import near the other DbModel imports at the top:

```ts
import { NotificationDbModel } from "../../../types/db/notification.js";
```

3b. Replace the body from `const startTime = Date.now();` through the closing of the `finally` block with the following (adds a `scannedSongs` counter, start/completion/error notifications, and a `catch`):

```ts
    const startTime = Date.now();
    let scannedSongs = 0;
    try {
      logger.info(`Starting scan of music folder ${musicFolder}`);
      await NotificationDbModel.sendToAll(db, {
        title: "Library scan started",
        message: `Scanning ${musicFolder}`,
        type: "info",
      });

      await ArtistDbModel.markAllAsNotExisting(db, pluginId);
      await AlbumDbModel.markAllAsNotExisting(db, pluginId);
      await SongDbModel.markAllAsNotExisting(db, pluginId);

      const files = await listFiles(musicFolder);
      const totalFiles = files.length;
      logger.info(`${totalFiles} files to scan.`);

      for (let filePath of files) {
        try {
          const fileMetadata: IAudioMetadata = await parseFile(filePath);

          const artists = await FileSystemScan.#upsertArtits(
            db,
            pluginId,
            fileMetadata,
            smartMergeArtists,
          );
          const album = await FileSystemScan.#upsertAlbum(
            db,
            pluginId,
            fileMetadata,
            artists,
          );
          await FileSystemScan.#upsertSong(
            db,
            pluginId,
            fileMetadata,
            album,
            artists,
            filePath,
          );
          scannedSongs++;
        } catch (ex: any) {
          if (ex instanceof UnsupportedFileTypeError) {
            logger.debug(
              `Skipping file ${filePath} because of and unsupported format`,
            );
          } else if (ex instanceof CouldNotDetermineFileTypeError) {
            logger.debug(
              `Skipping file ${filePath} because its file type cannot be determined`,
            );
          } else {
            logger.debug(ex);
          }
        }
      }

      await ArtistDbModel.deleteNotExisting(db, pluginId);
      await AlbumDbModel.deleteNotExisting(db, pluginId);
      await SongDbModel.deleteNotExisting(db, pluginId);

      await NotificationDbModel.sendToAll(db, {
        title: "Library scan completed",
        message: `${scannedSongs} tracks indexed`,
        type: "success",
      });
    } catch (ex: any) {
      await NotificationDbModel.sendToAll(db, {
        title: "Library scan failed",
        message: ex?.message ?? "Unknown error",
        type: "error",
      });
      throw ex;
    } finally {
      releaseScanQueue?.();

      const stopTime = Date.now();
      logger.info(
        `Scan of music folder ${musicFolder} completed. Time taken: ${(stopTime - startTime) / 1000}s`,
      );

      FileSystemScan.#artistMap.clear();
      FileSystemScan.#albumMap.clear();
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run test/plugins/scan.test.ts`
Expected: PASS (existing scan tests + the new notification test). If a pre-existing test calls the private upsert methods through `parseFile` mocks, those remain unaffected because the only behavioral change is the added `scannedSongs++` and notification calls.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/music_sources/filesystem-music-source/scan.ts test/plugins/scan.test.ts
git commit -m "feat: emit start/completion/error notifications from scan (#100)"
```

---

## Task 7: ADR — defer user roles for notification delete

**Files:**
- Create: `docs/adr/0006-defer-user-roles-for-notifications.md`

No test (documentation).

- [ ] **Step 1: Write the ADR**

Create `docs/adr/0006-defer-user-roles-for-notifications.md`:

```markdown
# ADR 0006: Defer User Roles for Notification Deletion

## Status

Accepted

## Date

2026-06-13

## Context

The notifications feature lets any authenticated user delete notifications,
including broadcast notifications addressed to all users. The system currently
has no concept of user roles or per-resource authorization: every authenticated
admin user is equivalent.

Adding role-based access control (RBAC) now would be premature while the user
model is a single shared admin account and the feature set is still forming.

## Decision

The `DELETE /admin/notifications/:id` endpoint performs no permission or role
check. Any authenticated user may delete any notification, including
notifications sent to all users.

We accept this temporary trade-off to ship the notifications feature, while
tracking the decision here for visibility and future follow-up.

## Consequences

- The delete endpoint stays simple and unblocked by an authorization model that
  does not yet exist.
- There is no protection against one user removing a broadcast notification that
  is still relevant to others.
- Future work must introduce user roles and revisit authorization on delete (and
  potentially on send) before multi-user, untrusted usage.

## Follow-up

- Introduce a user role model.
- Add authorization policies for notification deletion (e.g. only the recipient
  or an admin role may delete).
- Update this ADR status or create a superseding ADR once RBAC is implemented.
```

- [ ] **Step 2: Commit**

```bash
git add docs/adr/0006-defer-user-roles-for-notifications.md
git commit -m "docs: add ADR 0006 deferring user roles for notifications (#100)"
```

---

## Task 8: Admin-ui — GET proxy route

> Tasks 8–13 are in the `musicserver-admin-ui` repo. There is no test runner configured, so verification uses `npm run lint` per task and `npm run build` at the end (Task 13).

**Files:**
- Create: `src/app/api/admin/notifications/route.ts`

- [ ] **Step 1: Create the proxy route**

Create `src/app/api/admin/notifications/route.ts` (mirrors `app/api/logs/route.ts`):

```ts
import {
  buildMusicServerUrl,
  buildAdminHeaders,
  backendFetch,
} from "@/lib/musicserver-api";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await backendFetch(
      buildMusicServerUrl("/admin/notifications"),
      {
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
          error instanceof Error
            ? error.message
            : "Failed to call musicserver /admin/notifications",
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: no errors for the new file.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/notifications/route.ts
git commit -m "feat: add admin-ui notifications GET proxy (#100)"
```

---

## Task 9: Admin-ui — DELETE proxy route

**Files:**
- Create: `src/app/api/admin/notifications/[id]/route.ts`

- [ ] **Step 1: Create the proxy route**

Create `src/app/api/admin/notifications/[id]/route.ts` (mirrors `app/api/admin/api-keys/[id]/route.ts`):

```ts
import { buildMusicServerUrl, buildAdminHeaders } from "@/lib/musicserver-api";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const response = await fetch(
      buildMusicServerUrl(
        `/admin/notifications/${encodeURIComponent(id)}`,
      ),
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
          error instanceof Error
            ? error.message
            : "Failed to delete notification",
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/notifications/[id]/route.ts"
git commit -m "feat: add admin-ui notification DELETE proxy (#100)"
```

---

## Task 10: Admin-ui — mark-read proxy route

**Files:**
- Create: `src/app/api/admin/notifications/[id]/read/route.ts`

- [ ] **Step 1: Create the proxy route**

Create `src/app/api/admin/notifications/[id]/read/route.ts`:

```ts
import { buildMusicServerUrl, buildAdminHeaders } from "@/lib/musicserver-api";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const response = await fetch(
      buildMusicServerUrl(
        `/admin/notifications/${encodeURIComponent(id)}/read`,
      ),
      {
        method: "POST",
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
          error instanceof Error
            ? error.message
            : "Failed to mark notification read",
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Verify lint passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/notifications/[id]/read/route.ts"
git commit -m "feat: add admin-ui notification mark-read proxy (#100)"
```

---

## Task 11: Admin-ui — shared type + type→style helper

**Files:**
- Create: `src/types/notification.ts`
- Create: `src/lib/notification-style.tsx`

- [ ] **Step 1: Create the shared client type**

Create `src/types/notification.ts`:

```ts
export type NotificationType = "info" | "success" | "warning" | "error";

export type Notification = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
};
```

- [ ] **Step 2: Create the style helper**

Create `src/lib/notification-style.tsx` (uses `lucide-react`, already a dependency):

```tsx
import { Info, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import type { NotificationType } from "@/types/notification";

type NotificationStyle = {
  Icon: typeof Info;
  iconClassName: string;
  badgeClassName: string;
};

const STYLES: Record<NotificationType, NotificationStyle> = {
  info: {
    Icon: Info,
    iconClassName: "text-primary",
    badgeClassName: "bg-primary/10 text-primary",
  },
  success: {
    Icon: CheckCircle,
    iconClassName: "text-green",
    badgeClassName: "bg-green/10 text-green",
  },
  warning: {
    Icon: AlertTriangle,
    iconClassName: "text-yellow-dark",
    badgeClassName: "bg-yellow-light-4 text-yellow-dark",
  },
  error: {
    Icon: XCircle,
    iconClassName: "text-red",
    badgeClassName: "bg-red-light-6 text-red",
  },
};

export function getNotificationStyle(type: NotificationType): NotificationStyle {
  return STYLES[type] ?? STYLES.info;
}
```

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: no errors. (If a referenced Tailwind color class is missing in the theme, fall back to `text-dark`/`text-white` neutral classes — these utilities exist in the NextAdmin theme; verify against `tailwind.config.ts` if lint/build flags one.)

- [ ] **Step 4: Commit**

```bash
git add src/types/notification.ts src/lib/notification-style.tsx
git commit -m "feat: add notification type and style helper (#100)"
```

---

## Task 12: Admin-ui — rewrite bell dropdown + mount in header

**Files:**
- Modify: `src/components/Layouts/header/notification/index.tsx` (full rewrite)
- Modify: `src/components/Layouts/header/index.tsx` (mount `<Notification />`)

- [ ] **Step 1: Rewrite the bell dropdown to use real data**

Replace the entire contents of `src/components/Layouts/header/notification/index.tsx`:

```tsx
"use client";

import {
  Dropdown,
  DropdownContent,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { formatMessageTime } from "@/lib/format-message-time";
import { getNotificationStyle } from "@/lib/notification-style";
import type { Notification } from "@/types/notification";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BellIcon } from "./icons";

export function Notification() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const isMobile = useIsMobile();

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/api/admin/notifications", {
        cache: "no-store",
      });
      if (!response.ok) return;
      setItems((await response.json()) as Notification[]);
    } catch {
      // best-effort: leave the list as-is on transient errors
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = items.filter((item) => !item.read).length;

  const markRead = async (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    try {
      await apiFetch(`/api/admin/notifications/${id}/read`, { method: "POST" });
    } catch {
      // optimistic update already applied; ignore transient failure
    }
  };

  return (
    <Dropdown
      isOpen={isOpen}
      setIsOpen={(open) => {
        setIsOpen(open);
        if (open) void load();
      }}
    >
      <DropdownTrigger
        className="grid size-12 place-items-center rounded-full border bg-gray-2 text-dark outline-none hover:text-primary focus-visible:border-primary focus-visible:text-primary dark:border-dark-4 dark:bg-dark-3 dark:text-white dark:focus-visible:border-primary"
        aria-label="View Notifications"
      >
        <span className="relative">
          <BellIcon />
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute right-0 top-0 z-1 size-2 rounded-full bg-red-light ring-2 ring-gray-2 dark:ring-dark-3",
              )}
            >
              <span className="absolute inset-0 -z-1 animate-ping rounded-full bg-red-light opacity-75" />
            </span>
          )}
        </span>
      </DropdownTrigger>

      <DropdownContent
        align={isMobile ? "end" : "center"}
        className="border border-stroke bg-white px-3.5 py-3 shadow-md dark:border-dark-3 dark:bg-gray-dark min-[350px]:min-w-[20rem]"
      >
        <div className="mb-1 flex items-center justify-between px-2 py-1.5">
          <span className="text-lg font-medium text-dark dark:text-white">
            Notifications
          </span>
          {unreadCount > 0 && (
            <span className="rounded-md bg-primary px-[9px] py-0.5 text-xs font-medium text-white">
              {unreadCount} new
            </span>
          )}
        </div>

        <ul className="mb-3 max-h-[23rem] space-y-1.5 overflow-y-auto">
          {items.length === 0 && (
            <li className="px-2 py-4 text-center text-sm text-dark-5 dark:text-dark-6">
              No notifications
            </li>
          )}
          {items.slice(0, 5).map((item) => {
            const { Icon, iconClassName } = getNotificationStyle(item.type);
            return (
              <li key={item.id} role="menuitem">
                <Link
                  href="/notifications"
                  onClick={() => {
                    if (!item.read) void markRead(item.id);
                    setIsOpen(false);
                  }}
                  className="flex items-center gap-4 rounded-lg px-2 py-1.5 outline-none hover:bg-gray-2 focus-visible:bg-gray-2 dark:hover:bg-dark-3 dark:focus-visible:bg-dark-3"
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full bg-gray-2 dark:bg-dark-3",
                      iconClassName,
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-medium text-dark dark:text-white">
                      {item.title}
                    </strong>
                    <span className="block truncate text-sm font-medium text-dark-5 dark:text-dark-6">
                      {item.message}
                    </span>
                    <span className="text-xs text-dark-5 dark:text-dark-6">
                      {formatMessageTime(item.createdAt)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <Link
          href="/notifications"
          onClick={() => setIsOpen(false)}
          className="block rounded-lg border border-primary p-2 text-center text-sm font-medium tracking-wide text-primary outline-none transition-colors hover:bg-blue-light-5 focus:bg-blue-light-5 focus:text-primary focus-visible:border-primary dark:border-dark-3 dark:text-dark-6 dark:hover:border-dark-5 dark:hover:bg-dark-3 dark:hover:text-dark-7 dark:focus-visible:border-dark-5 dark:focus-visible:bg-dark-3 dark:focus-visible:text-dark-7"
        >
          See all notifications
        </Link>
      </DropdownContent>
    </Dropdown>
  );
}
```

- [ ] **Step 2: Mount the bell in the header**

In `src/components/Layouts/header/index.tsx`:

2a. Add the import next to the other header imports:

```tsx
import { Notification } from "./notification";
```

2b. In the right-hand controls `div`, add `<Notification />` before `<ThemeToggleSwitch />` so the controls block reads:

```tsx
      <div className="flex items-center justify-end gap-2 min-[375px]:gap-4">
        <Notification />

        <ThemeToggleSwitch />

        <div className="shrink-0">
          <UserInfo username={username} />
        </div>
      </div>
```

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Layouts/header/notification/index.tsx src/components/Layouts/header/index.tsx
git commit -m "feat: wire bell dropdown to real notifications and mount in header (#100)"
```

---

## Task 13: Admin-ui — notifications page

**Files:**
- Create: `src/app/(admin)/notifications/page.tsx`
- Create: `src/app/(admin)/notifications/_components/notifications-card.tsx`

- [ ] **Step 1: Create the page shell**

Create `src/app/(admin)/notifications/page.tsx` (mirrors `pages/api-keys/page.tsx`):

```tsx
import type { Metadata } from "next";
import { NotificationsCard } from "./_components/notifications-card";

export const metadata: Metadata = {
  title: "Notifications",
};

export default function NotificationsPage() {
  return (
    <div className="space-y-6">
      <NotificationsCard />
    </div>
  );
}
```

- [ ] **Step 2: Create the card component**

Create `src/app/(admin)/notifications/_components/notifications-card.tsx`:

```tsx
"use client";

import { apiFetch } from "@/lib/api-client";
import { formatMessageTime } from "@/lib/format-message-time";
import { getNotificationStyle } from "@/lib/notification-style";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/notification";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export function NotificationsCard() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await apiFetch("/api/admin/notifications", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Failed to load notifications (${response.status})`);
      }
      setItems((await response.json()) as Notification[]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to load notifications",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    try {
      await apiFetch(`/api/admin/notifications/${id}/read`, { method: "POST" });
    } catch {
      // optimistic update already applied
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await apiFetch(`/api/admin/notifications/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(`Delete failed (${response.status})`);
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete notification");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark dark:shadow-card sm:p-6">
      <h2 className="mb-4 text-2xl font-bold text-dark dark:text-white">
        Notifications
      </h2>

      {error && (
        <p className="mb-4 text-sm font-medium text-red">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-dark-5 dark:text-dark-6">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-dark-5 dark:text-dark-6">
          No notifications
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const { Icon, iconClassName } = getNotificationStyle(item.type);
            return (
              <li
                key={item.id}
                onClick={() => {
                  if (!item.read) void markRead(item.id);
                }}
                className={cn(
                  "flex items-center gap-4 rounded-lg border border-stroke px-4 py-3 dark:border-dark-3",
                  !item.read && "bg-gray-1 dark:bg-dark-2",
                )}
              >
                <span
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-full bg-gray-2 dark:bg-dark-3",
                    iconClassName,
                  )}
                >
                  <Icon className="size-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <strong className="block text-sm font-medium text-dark dark:text-white">
                    {item.title}
                  </strong>
                  <span className="block text-sm text-dark-5 dark:text-dark-6">
                    {item.message}
                  </span>
                  <span className="text-xs text-dark-5 dark:text-dark-6">
                    {formatMessageTime(item.createdAt)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void remove(item.id);
                  }}
                  disabled={deletingId === item.id}
                  aria-label="Delete notification"
                  className="shrink-0 rounded-lg p-2 text-dark-5 outline-none hover:bg-gray-2 hover:text-red focus-visible:bg-gray-2 disabled:opacity-50 dark:text-dark-6 dark:hover:bg-dark-3"
                >
                  <Trash2 className="size-5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify lint passes**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Verify the production build passes**

Run: `npm run build`
Expected: `next build` completes without type or build errors. If a Tailwind color utility from Task 11 is reported as unknown, replace it with the nearest existing theme color and re-run.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(admin)/notifications/page.tsx" "src/app/(admin)/notifications/_components/notifications-card.tsx"
git commit -m "feat: add notifications page with delete and mark-read (#100)"
```

---

## Final verification

- [ ] Backend: run the full suite from the `musicserver-backend` repo root:

Run: `npm test`
Expected: all tests pass, including `test/types/db/notification.test.ts`, `test/routes/notifications.test.ts`, and the updated `test/plugins/scan.test.ts`.

- [ ] Admin-ui: from the `musicserver-admin-ui` repo root:

Run: `npm run lint && npm run build`
Expected: lint clean, build succeeds.

## Spec coverage check

- Programmatic send to one user / all users → `sendToUser` / `sendToAll` (Task 1).
- Store with auto-expiry, default 1 day, configurability deferred → TTL index + `MILLISECONDS_PER_DAY` default (Task 1); deferral noted in spec.
- API for fetching notifications filtered for the user → `GET /admin/notifications` (Task 3).
- API for deleting notifications, no permission check + ADR → `DELETE /admin/notifications/:id` (Task 5) + ADR 0006 (Task 7).
- Scan process is the first consumer → start/completion/error notifications (Task 6); start notification added per follow-up request.
- Admin-ui bell in top bar opening notifications → bell dropdown + "See all" link + page (Tasks 12, 13).
- Style 1, descending order, per-notification delete → notifications card (Task 13); dropdown also descending (backend sorts desc).
- Read tracking + "N new" badge → `readBy` + `markRead` (Tasks 1, 4) and unread badge (Task 12).
