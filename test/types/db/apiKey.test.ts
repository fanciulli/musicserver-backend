/*
 * Created on Thu May 22 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, it, expect, vi } from "vitest";
import { ApiKeyDbModel, init } from "../../../src/types/db/apiKey.js";

function makeDb(findOneResult: unknown = null, deleteResult = { deletedCount: 1 }) {
  const collection = {
    findOne: vi.fn().mockResolvedValue(findOneResult),
    find: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
    insertOne: vi.fn().mockResolvedValue({}),
    deleteOne: vi.fn().mockResolvedValue(deleteResult),
    createIndex: vi.fn().mockResolvedValue({}),
  };
  return { db: { collection: vi.fn().mockReturnValue(collection) }, _col: collection } as any;
}

describe("init", () => {
  it("creates an index on keyHash", () => {
    const createIndex = vi.fn();
    const db = { collection: vi.fn().mockReturnValue({ createIndex }) } as any;
    init(db);
    expect(db.collection).toHaveBeenCalledWith("apiKeys");
    expect(createIndex).toHaveBeenCalledWith({ keyHash: 1 });
  });
});

describe("ApiKeyDbModel.findByHash", () => {
  it("queries by keyHash and returns model", async () => {
    const now = new Date();
    const { db, _col } = makeDb({ id: "1", name: "test", keyHash: "abc", keyPrefix: "ms_", createdAt: now, expiresAt: null });
    const result = await ApiKeyDbModel.findByHash(db as any, "abc");
    expect(_col.findOne).toHaveBeenCalledWith({ keyHash: "abc" });
    expect(result).toBeDefined();
  });

  it("returns undefined when not found", async () => {
    const { db } = makeDb(null);
    const result = await ApiKeyDbModel.findByHash(db as any, "missing");
    expect(result).toBeUndefined();
  });
});

describe("ApiKeyDbModel.findAll", () => {
  it("returns all records without keyHash field", async () => {
    const toArray = vi.fn().mockResolvedValue([{ id: "1", name: "k" }]);
    const project = vi.fn().mockReturnValue({ toArray });
    const find = vi.fn().mockReturnValue({ project });
    const col = { find };
    const db = { collection: vi.fn().mockReturnValue(col) } as any;
    const result = await ApiKeyDbModel.findAll(db);
    expect(find).toHaveBeenCalled();
    expect(project).toHaveBeenCalledWith({ keyHash: 0 });
    expect(result).toHaveLength(1);
  });
});

describe("ApiKeyDbModel.deleteById", () => {
  it("returns true when deleted", async () => {
    const { db } = makeDb(null, { deletedCount: 1 });
    const result = await ApiKeyDbModel.deleteById(db as any, "some-id");
    expect(result).toBe(true);
  });

  it("returns false when not found", async () => {
    const { db } = makeDb(null, { deletedCount: 0 });
    const result = await ApiKeyDbModel.deleteById(db as any, "missing-id");
    expect(result).toBe(false);
  });
});

describe("ApiKeyDbModel.insert", () => {
  it("calls insertOne with the model", async () => {
    const col = { insertOne: vi.fn().mockResolvedValue({}) };
    const db = { collection: vi.fn().mockReturnValue(col) } as any;
    const model = new ApiKeyDbModel();
    model.id = "x";
    model.name = "test";
    await model.insert(db);
    expect(col.insertOne).toHaveBeenCalledWith(model);
  });
});
