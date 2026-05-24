import { beforeEach, describe, expect, it, vi } from "vitest";

const pinoMock = vi.hoisted(() => vi.fn());

vi.mock("pino", () => {
  const factory = Object.assign((...args) => pinoMock(...args), {
    transport: vi.fn(),
  });
  return { default: factory };
});

describe("createDatabaseLogger", () => {
  let insertOneMock;
  let collectionMock;
  let dbMock;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    insertOneMock = vi.fn().mockResolvedValue({});
    collectionMock = { insertOne: insertOneMock };
    dbMock = { collection: vi.fn().mockReturnValue(collectionMock) };
    pinoMock.mockReturnValue({ info: vi.fn() });
  });

  it("creates a pino logger with a writable stream", async () => {
    const { createDatabaseLogger } = await import("../../src/server/loggingMongoTransport.js");
    createDatabaseLogger("fastify", dbMock);
    expect(pinoMock).toHaveBeenCalledWith(expect.any(Object));
  });

  it("writes a parsed pino line to the logs collection", async () => {
    const { createDatabaseLogger } = await import("../../src/server/loggingMongoTransport.js");

    let capturedStream;
    pinoMock.mockImplementation((stream) => {
      capturedStream = stream;
      return { info: vi.fn() };
    });

    createDatabaseLogger("fastify", dbMock);

    const line = JSON.stringify({ time: 1716112800000, level: 30, msg: "request received" });
    await new Promise((resolve) => capturedStream.write(line + "\n", "utf8", resolve));

    expect(dbMock.collection).toHaveBeenCalledWith("logs");
    expect(insertOneMock).toHaveBeenCalledWith({
      logId: "fastify",
      timestamp: new Date(1716112800000),
      level: "info",
      message: "request received",
    });
  });

  it("maps pino numeric levels to string names", async () => {
    const { createDatabaseLogger } = await import("../../src/server/loggingMongoTransport.js");

    let capturedStream;
    pinoMock.mockImplementation((stream) => { capturedStream = stream; return {}; });
    createDatabaseLogger("main", dbMock);

    const cases = [
      { level: 60, expected: "fatal" },
      { level: 50, expected: "error" },
      { level: 40, expected: "warn" },
      { level: 30, expected: "info" },
      { level: 20, expected: "debug" },
      { level: 10, expected: "trace" },
    ];

    for (const { level, expected } of cases) {
      insertOneMock.mockClear();
      const line = JSON.stringify({ time: Date.now(), level, msg: "test" });
      await new Promise((resolve) => capturedStream.write(line + "\n", "utf8", resolve));
      expect(insertOneMock).toHaveBeenCalledWith(expect.objectContaining({ level: expected }));
    }
  });

  it("silently skips malformed (non-JSON) lines", async () => {
    const { createDatabaseLogger } = await import("../../src/server/loggingMongoTransport.js");

    let capturedStream;
    pinoMock.mockImplementation((stream) => { capturedStream = stream; return {}; });
    createDatabaseLogger("main", dbMock);

    await new Promise((resolve) => capturedStream.write("not-json\n", "utf8", resolve));

    expect(insertOneMock).not.toHaveBeenCalled();
  });
});
