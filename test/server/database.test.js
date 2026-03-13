import { beforeEach, describe, expect, it, vi } from "vitest";

const { mongoClientConstructorSpy, connectMock, dbMock } = vi.hoisted(() => ({
  mongoClientConstructorSpy: vi.fn(),
  connectMock: vi.fn(),
  dbMock: vi.fn(),
}));

const { listFilesMock } = vi.hoisted(() => ({
  listFilesMock: vi.fn(),
}));

vi.mock("../../src/utils/fsUtils.js", () => ({
  listFiles: listFilesMock,
}));

vi.mock("mongodb", () => {
  class MockMongoClient {
    constructor(uri, options) {
      mongoClientConstructorSpy(uri, options);
    }

    connect() {
      return connectMock();
    }

    db(name) {
      return dbMock(name);
    }
  }

  return {
    MongoClient: MockMongoClient,
  };
});

import { Database } from "../../src/server/database.js";

describe("Database.connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listFilesMock.mockResolvedValue([]);
  });

  it("connects successfully and assigns the db client", async () => {
    const fakeDb = { client: { close: vi.fn() } };
    connectMock.mockResolvedValue(undefined);
    dbMock.mockReturnValue(fakeDb);

    const database = new Database();
    await expect(database.connect()).resolves.toBeUndefined();

    expect(mongoClientConstructorSpy).toHaveBeenCalledWith(
      "mongodb://localhost:27017",
      {
        connectTimeoutMS: 5000,
        serverSelectionTimeoutMS: 5000,
      },
    );
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(dbMock).toHaveBeenCalledWith("music-server");
    expect(database.client).toBe(fakeDb);
  });

  it("throws when MongoDB connection fails", async () => {
    const connectError = new Error("connection failed");
    connectMock.mockRejectedValue(connectError);

    const database = new Database();

    await expect(database.connect()).rejects.toThrow("connection failed");
    expect(dbMock).not.toHaveBeenCalled();
  });
});

describe("Database.start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listFilesMock.mockResolvedValue([]);
  });

  it("returns true when connection and model init succeed", async () => {
    const fakeDb = { client: { close: vi.fn() } };
    connectMock.mockResolvedValue(undefined);
    dbMock.mockReturnValue(fakeDb);

    const database = new Database();

    await expect(database.start()).resolves.toBe(true);
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(listFilesMock).toHaveBeenCalledTimes(1);
  });

  it("returns false when connection fails", async () => {
    connectMock.mockRejectedValue(new Error("connection failed"));

    const database = new Database();

    await expect(database.start()).resolves.toBe(false);
    expect(listFilesMock).not.toHaveBeenCalled();
  });
});

describe("Database.disconnect", () => {
  it("closes the underlying MongoDB client", async () => {
    const closeMock = vi.fn().mockResolvedValue(undefined);
    const database = new Database();
    database.client = {
      client: { close: closeMock },
    };

    await expect(database.disconnect()).resolves.toBeUndefined();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
