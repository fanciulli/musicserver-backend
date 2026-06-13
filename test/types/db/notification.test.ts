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

describe("NotificationDbModel.send", () => {
  it("inserts a notification addressed to one user with a default expiry", async () => {
    const { db, col } = makeDb();
    await NotificationDbModel.send(db, "alice", {
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

  it("inserts a broadcast notification when recipient is null", async () => {
    const { db, col } = makeDb();
    await NotificationDbModel.send(db, null, {
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
