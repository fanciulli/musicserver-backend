/*
 * Created on Sat Apr 18 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logLineQuery: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock("../../../src/types/db/logLine.js", () => ({
  LogLineDbModel: {
    query: (...args) => mocks.logLineQuery(...args),
  },
}));

import { default as AdminLogsRoute } from "../../../src/routes/admin/adminLogs.js";

function createResponseMock() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

function createContext(db = "db-client") {
  mocks.getDatabase.mockReturnValue(db);
  return {
    database: mocks.getDatabase(),
    logger: { info: vi.fn(), error: vi.fn() },
  };
}

describe("AdminLogsRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.logLineQuery.mockResolvedValue({ entries: [], total: 0 });
  });

  describe("URL contract", () => {
    it("uses /admin/logs", () => {
      const route = new AdminLogsRoute(createContext());
      expect(route.url).toBe("/admin/logs");
    });
  });

  describe("GET /admin/logs — basic query", () => {
    it("queries LogLineDbModel with logId from request", async () => {
      const route = new AdminLogsRoute(createContext());
      const response = createResponseMock();

      await route.handler({ query: { id: "main" } }, response);

      expect(mocks.logLineQuery).toHaveBeenCalledWith(
        "db-client",
        expect.objectContaining({ logId: "main" }),
      );
    });

    it("returns entries and total in response", async () => {
      const entries = [
        {
          logId: "main",
          timestamp: new Date(),
          level: "info",
          message: "hello",
        },
      ];
      mocks.logLineQuery.mockResolvedValue({ entries, total: 1 });

      const route = new AdminLogsRoute(createContext());
      const response = createResponseMock();

      await route.handler({ query: { id: "main" } }, response);

      expect(response.send).toHaveBeenCalledWith({ entries, total: 1 });
    });
  });

  describe("GET /admin/logs — optional filters", () => {
    it("passes level filter when provided", async () => {
      const route = new AdminLogsRoute(createContext());
      await route.handler(
        { query: { id: "main", level: "error" } },
        createResponseMock(),
      );
      expect(mocks.logLineQuery).toHaveBeenCalledWith(
        "db-client",
        expect.objectContaining({ level: "error" }),
      );
    });

    it("passes from/to as Date objects when provided", async () => {
      const route = new AdminLogsRoute(createContext());
      await route.handler(
        {
          query: {
            id: "main",
            from: "2026-05-01T00:00:00Z",
            to: "2026-05-19T23:59:59Z",
          },
        },
        createResponseMock(),
      );
      expect(mocks.logLineQuery).toHaveBeenCalledWith(
        "db-client",
        expect.objectContaining({
          from: new Date("2026-05-01T00:00:00Z"),
          to: new Date("2026-05-19T23:59:59Z"),
        }),
      );
    });

    it("passes page and limit when provided", async () => {
      const route = new AdminLogsRoute(createContext());
      await route.handler(
        { query: { id: "main", page: "2", limit: "25" } },
        createResponseMock(),
      );
      expect(mocks.logLineQuery).toHaveBeenCalledWith(
        "db-client",
        expect.objectContaining({ page: 2, limit: 25 }),
      );
    });
  });

  describe("GET /admin/logs — error handling", () => {
    it("returns 500 when LogLineDbModel.query throws", async () => {
      mocks.logLineQuery.mockRejectedValue(new Error("DB connection lost"));

      const route = new AdminLogsRoute(createContext());
      const response = createResponseMock();

      await route.handler({ query: { id: "main" } }, response);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.send).toHaveBeenCalledWith({
        error: "Failed to retrieve logs",
      });
    });
  });
});
