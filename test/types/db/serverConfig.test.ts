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
