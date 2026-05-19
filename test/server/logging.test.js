/*
 * Created on Sat Apr 18 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Logger", () => {
  let insertOneMock;
  let collectionMock;
  let dbMock;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    insertOneMock = vi.fn().mockResolvedValue({});
    collectionMock = { insertOne: insertOneMock };
    dbMock = { collection: vi.fn().mockReturnValue(collectionMock) };
  });

  it("buffers log entries before setDatabase is called", async () => {
    const { Logger } = await import("../../src/server/logging.js");
    const logger = new Logger();

    logger.info("startup message");
    logger.error("startup error");

    expect(insertOneMock).not.toHaveBeenCalled();
  });

  it("flushes buffered entries to DB on setDatabase", async () => {
    const { Logger } = await import("../../src/server/logging.js");
    const logger = new Logger();

    logger.info("before db");
    logger.error("also before db");

    logger.setDatabase(dbMock);

    // allow async flush
    await new Promise((r) => setTimeout(r, 0));

    expect(dbMock.collection).toHaveBeenCalledWith("logs");
    expect(insertOneMock).toHaveBeenCalledTimes(2);
    expect(insertOneMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: "info", message: "before db", logId: "main" })
    );
    expect(insertOneMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: "error", message: "also before db", logId: "main" })
    );

    // verify buffer was cleared — post-setDatabase write is direct (not re-flushed)
    logger.info("after db");
    await new Promise((r) => setTimeout(r, 0));
    expect(insertOneMock).toHaveBeenCalledTimes(3);
  });

  it("writes info directly to DB after setDatabase", async () => {
    const { Logger } = await import("../../src/server/logging.js");
    const logger = new Logger();
    logger.setDatabase(dbMock);

    logger.info("direct info");

    await new Promise((r) => setTimeout(r, 0));

    expect(insertOneMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: "info", message: "direct info", logId: "main" })
    );
  });

  it("writes error directly to DB after setDatabase", async () => {
    const { Logger } = await import("../../src/server/logging.js");
    const logger = new Logger();
    logger.setDatabase(dbMock);

    logger.error("direct error");

    await new Promise((r) => setTimeout(r, 0));

    expect(insertOneMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: "error", message: "direct error", logId: "main" })
    );
  });

  it("writes debug directly to DB after setDatabase", async () => {
    const { Logger } = await import("../../src/server/logging.js");
    const logger = new Logger();
    logger.setDatabase(dbMock);

    logger.debug("direct debug");

    await new Promise((r) => setTimeout(r, 0));

    expect(insertOneMock).toHaveBeenCalledWith(
      expect.objectContaining({ level: "debug", message: "direct debug", logId: "main" })
    );
  });

  it("inserts entries with a timestamp", async () => {
    const { Logger } = await import("../../src/server/logging.js");
    const logger = new Logger();
    logger.setDatabase(dbMock);

    logger.info("timestamped");

    await new Promise((r) => setTimeout(r, 0));

    const [doc] = insertOneMock.mock.calls[0];
    expect(doc.timestamp).toBeInstanceOf(Date);
  });
});
