/*
 * Created on Wed Mar 25 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  extractPluginId: vi.fn(),
  getPluginById: vi.fn(),
}));

vi.mock("../../src/utils/pathUtils.js", () => ({
  extractPluginId: (...args: unknown[]) => mocks.extractPluginId(...args),
}));

vi.mock("../../src/utils/musicSourcePluginResolver.js", () => ({
  getPluginById: (...args: unknown[]) => mocks.getPluginById(...args),
}));

import { default as StreamRoute } from "../../src/routes/music/stream.js";

function createResponseMock() {
  return {
    headers: vi.fn().mockReturnThis(),
    header: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

describe("StreamRoute", () => {
  function createRoute() {
    return new StreamRoute({
      pluginManager: {},
      database: {},
      logger: { info: vi.fn(), error: vi.fn() },
    } as any);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails when extractPluginId throws", async () => {
    mocks.extractPluginId.mockImplementation(() => {
      throw new Error("extractPluginId failed");
    });

    const route = createRoute();
    const response = createResponseMock();

    await expect(
      route.handler({ query: { id: "broken-uri" } }, response),
    ).rejects.toThrow("extractPluginId failed");
  });

  it("fails when getPluginById invocation throws", async () => {
    mocks.extractPluginId.mockReturnValue("filesystem");
    mocks.getPluginById.mockRejectedValue(new Error("getPluginById failed"));

    const route = createRoute();
    const response = createResponseMock();

    await expect(
      route.handler({ query: { id: "filesystem://track" } }, response),
    ).rejects.toThrow("getPluginById failed");
  });

  it("returns 404 when route execution fails", async () => {
    mocks.extractPluginId.mockReturnValue("filesystem");
    mocks.getPluginById.mockResolvedValue({
      pluginId: "filesystem",
      plugin: {
        stream: vi.fn().mockRejectedValue(new Error("song error")),
      },
    });

    const route = createRoute();
    const response = createResponseMock();

    await route.handler({ query: { id: "filesystem://track" } }, response);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.send).toHaveBeenCalledWith({ error: "Song not found" });
  });

  it("sends stream on success", async () => {
    const stream = Buffer.from("song-data");
    const streamMock = vi
      .fn()
      .mockResolvedValue([stream, stream.length] as const);
    mocks.extractPluginId.mockReturnValue("filesystem");
    mocks.getPluginById.mockResolvedValue({
      pluginId: "filesystem",
      plugin: {
        stream: streamMock,
      },
    });

    const route = createRoute();
    const response = createResponseMock();

    await route.handler({ query: { id: "filesystem://track" } }, response);

    expect(response.send).toHaveBeenCalledWith(stream);
    expect(streamMock).toHaveBeenCalledWith("filesystem://track", undefined);
    expect(response.status).toHaveBeenCalledWith(200);
  });

  it.each([
    {
      caseName: "extracts stream start from range header with regex",
      rangeHeader: "bytes=12345-99999",
      expectedStart: 12345,
    },
    {
      caseName: "extracts stream start from generic uom range header",
      rangeHeader: "customUnit=42-toDiscard",
      expectedStart: 42,
    },
  ])("$caseName", async ({ rangeHeader, expectedStart }) => {
    const stream = Buffer.from("song-data");
    const streamMock = vi.fn().mockResolvedValue(stream);
    mocks.extractPluginId.mockReturnValue("filesystem");
    mocks.getPluginById.mockResolvedValue({
      pluginId: "filesystem",
      plugin: {
        stream: streamMock,
      },
    });

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(
      {
        query: { id: "filesystem://track" },
        headers: { range: rangeHeader },
      },
      response,
    );

    expect(streamMock).toHaveBeenCalledWith(
      "filesystem://track",
      expectedStart,
    );
  });
});
