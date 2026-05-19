import { beforeEach, describe, expect, it, vi } from "vitest";
import { LogLineDbModel } from "../../../src/types/db/logLine.js";

describe("LogLineDbModel.query", () => {
  let toArrayMock: ReturnType<typeof vi.fn>;
  let sortMock: ReturnType<typeof vi.fn>;
  let skipMock: ReturnType<typeof vi.fn>;
  let limitMock: ReturnType<typeof vi.fn>;
  let findMock: ReturnType<typeof vi.fn>;
  let countDocumentsMock: ReturnType<typeof vi.fn>;
  let collectionMock: { find: ReturnType<typeof vi.fn>; countDocuments: ReturnType<typeof vi.fn> };
  let dbMock: { collection: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    toArrayMock = vi.fn().mockResolvedValue([]);
    limitMock = vi.fn().mockReturnValue({ toArray: toArrayMock });
    skipMock = vi.fn().mockReturnValue({ limit: limitMock });
    sortMock = vi.fn().mockReturnValue({ skip: skipMock });
    findMock = vi.fn().mockReturnValue({ sort: sortMock });
    countDocumentsMock = vi.fn().mockResolvedValue(0);
    collectionMock = { find: findMock, countDocuments: countDocumentsMock };
    dbMock = { collection: vi.fn().mockReturnValue(collectionMock) };
  });

  it("queries the logs collection", async () => {
    await LogLineDbModel.query(dbMock as any, { logId: "main" });
    expect(dbMock.collection).toHaveBeenCalledWith("logs");
  });

  it("filters by logId", async () => {
    await LogLineDbModel.query(dbMock as any, { logId: "fastify" });
    expect(findMock).toHaveBeenCalledWith(expect.objectContaining({ logId: "fastify" }));
  });

  it("filters by level when provided", async () => {
    await LogLineDbModel.query(dbMock as any, { logId: "main", level: "error" });
    expect(findMock).toHaveBeenCalledWith(expect.objectContaining({ level: "error" }));
  });

  it("omits level from filter when not provided", async () => {
    await LogLineDbModel.query(dbMock as any, { logId: "main" });
    const filter = findMock.mock.calls[0][0];
    expect(filter).not.toHaveProperty("level");
  });

  it("filters by date range when from and to are provided", async () => {
    const from = new Date("2026-05-01T00:00:00Z");
    const to = new Date("2026-05-19T23:59:59Z");
    await LogLineDbModel.query(dbMock as any, { logId: "main", from, to });
    expect(findMock).toHaveBeenCalledWith(
      expect.objectContaining({ timestamp: { $gte: from, $lte: to } })
    );
  });

  it("sorts results by timestamp descending", async () => {
    await LogLineDbModel.query(dbMock as any, { logId: "main" });
    expect(sortMock).toHaveBeenCalledWith({ timestamp: -1 });
  });

  it("uses page 1 and limit 50 by default", async () => {
    await LogLineDbModel.query(dbMock as any, { logId: "main" });
    expect(skipMock).toHaveBeenCalledWith(0);
    expect(limitMock).toHaveBeenCalledWith(50);
  });

  it("applies page and limit for pagination", async () => {
    await LogLineDbModel.query(dbMock as any, { logId: "main", page: 3, limit: 20 });
    expect(skipMock).toHaveBeenCalledWith(40);
    expect(limitMock).toHaveBeenCalledWith(20);
  });

  it("returns mapped LogLineDbModel instances and total count", async () => {
    toArrayMock.mockResolvedValue([
      { logId: "main", timestamp: new Date("2026-05-19T10:00:00Z"), level: "info", message: "started" },
    ]);
    countDocumentsMock.mockResolvedValue(1);

    const result = await LogLineDbModel.query(dbMock as any, { logId: "main" });

    expect(result.total).toBe(1);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toBeInstanceOf(LogLineDbModel);
    expect(result.entries[0].message).toBe("started");
  });
});

describe("LogLineDbModel.insert", () => {
  it("inserts the instance into the logs collection", async () => {
    const insertOneMock = vi.fn().mockResolvedValue({});
    const collectionMock = { insertOne: insertOneMock };
    const dbMock = { collection: vi.fn().mockReturnValue(collectionMock) };

    const entry = new LogLineDbModel();
    entry.logId = "main";
    entry.timestamp = new Date("2026-05-19T10:00:00Z");
    entry.level = "info";
    entry.message = "hello";

    await entry.insert(dbMock as any);

    expect(dbMock.collection).toHaveBeenCalledWith("logs");
    expect(insertOneMock).toHaveBeenCalledWith(entry);
  });
});

describe("LogLineDbModel.fromJson", () => {
  it("maps all four fields from a plain object", () => {
    const ts = new Date("2026-05-19T10:00:00Z");
    const result = LogLineDbModel.fromJson({
      logId: "fastify",
      timestamp: ts,
      level: "warn",
      message: "slow request",
    });

    expect(result).toBeInstanceOf(LogLineDbModel);
    expect(result.logId).toBe("fastify");
    expect(result.timestamp).toBe(ts);
    expect(result.level).toBe("warn");
    expect(result.message).toBe("slow request");
  });
});
