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
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

describe("StreamRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails when extractPluginId throws", async () => {
    mocks.extractPluginId.mockImplementation(() => {
      throw new Error("extractPluginId failed");
    });

    const route = new StreamRoute();
    const response = createResponseMock();

    await expect(
      route.handler({ query: { id: "broken-uri" } }, response),
    ).rejects.toThrow("extractPluginId failed");
  });

  it("fails when getPluginById invocation throws", async () => {
    mocks.extractPluginId.mockReturnValue("filesystem");
    mocks.getPluginById.mockRejectedValue(new Error("getPluginById failed"));

    const route = new StreamRoute();
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

    const route = new StreamRoute();
    const response = createResponseMock();

    await route.handler({ query: { id: "filesystem://track" } }, response);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.send).toHaveBeenCalledWith({ error: "Song not found" });
  });

  it("sends stream on success", async () => {
    const stream = Buffer.from("song-data");
    mocks.extractPluginId.mockReturnValue("filesystem");
    mocks.getPluginById.mockResolvedValue({
      pluginId: "filesystem",
      plugin: {
        stream: vi.fn().mockResolvedValue(stream),
      },
    });

    const route = new StreamRoute();
    const response = createResponseMock();

    await route.handler({ query: { id: "filesystem://track" } }, response);

    expect(response.send).toHaveBeenCalledWith(stream);
    expect(response.status).not.toHaveBeenCalled();
  });
});
