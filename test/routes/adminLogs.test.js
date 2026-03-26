import { join } from "path";
import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { readdirMock, readFileMock } = vi.hoisted(() => ({
  readdirMock: vi.fn(),
  readFileMock: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  readdir: readdirMock,
  readFile: readFileMock,
}));

import { default as AdminLogsRoute } from "../../src/routes/admin/adminLogs.js";

function createResponseMock() {
  return {
    type: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

describe("AdminLogsRoute", () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.setSystemTime(new Date("2026-03-21T10:00:00.000Z"));
  });

  it("reads the .1.log file when it is the only available file", async () => {
    readdirMock.mockResolvedValue(["main.2026-03-21.1.log"]);
    readFileMock.mockResolvedValue("main log content");

    const route = new AdminLogsRoute();
    const response = createResponseMock();

    await route.handler({ query: { id: "main" } }, response);

    expect(readFileMock).toHaveBeenCalledWith(
      join("logs", "main.2026-03-21.1.log"),
      "utf-8",
    );
    expect(response.type).toHaveBeenCalledWith("text/plain");
    expect(response.send).toHaveBeenCalledWith("main log content");
    expect(response.status).not.toHaveBeenCalled();
  });

  it("reads the latest rolled file when multiple files are available", async () => {
    readdirMock.mockResolvedValue([
      "main.2026-03-21.2.log",
      "main.2026-03-21.1.log",
      "main.2026-03-21.3.log",
    ]);
    readFileMock.mockResolvedValue("latest main log content");

    const route = new AdminLogsRoute();
    const response = createResponseMock();

    await route.handler({ query: { id: "main" } }, response);

    expect(readFileMock).toHaveBeenCalledWith(
      join("logs", "main.2026-03-21.3.log"),
      "utf-8",
    );
    expect(response.type).toHaveBeenCalledWith("text/plain");
    expect(response.send).toHaveBeenCalledWith("latest main log content");
    expect(response.status).not.toHaveBeenCalled();
  });
});
