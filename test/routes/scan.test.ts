/*
 * Created on Wed Mar 25 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPluginById: vi.fn(),
}));

vi.mock("../../src/utils/musicSourcePluginResolver.js", () => ({
  getPluginById: (...args: unknown[]) => mocks.getPluginById(...args),
}));

import { default as ScanRoute } from "../../src/routes/music/scan.js";

function createResponseMock() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

describe("ScanRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails when getPluginById invocation throws", async () => {
    mocks.getPluginById.mockRejectedValue(new Error("getPluginById failed"));

    const route = new ScanRoute();
    const response = createResponseMock();

    await expect(
      route.handler({ body: { id: "filesystem" } }, response),
    ).rejects.toThrow("getPluginById failed");
  });

  it("returns resolver error when plugin is not available", async () => {
    mocks.getPluginById.mockResolvedValue({
      pluginId: "filesystem",
      error: {
        status: 404,
        message: "Plugin filesystem not found",
      },
    });

    const route = new ScanRoute();
    const response = createResponseMock();

    await route.handler({ body: { id: "filesystem" } }, response);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.send).toHaveBeenCalledWith({
      error: "Plugin filesystem not found",
    });
  });

  it("fails when route execution throws in plugin.scan", async () => {
    mocks.getPluginById.mockResolvedValue({
      pluginId: "filesystem",
      plugin: {
        scan: vi.fn().mockRejectedValue(new Error("scan failed")),
      },
    });

    const route = new ScanRoute();
    const response = createResponseMock();

    await expect(
      route.handler({ body: { id: "filesystem" } }, response),
    ).rejects.toThrow("scan failed");
  });

  it("sends success response when scan completes", async () => {
    mocks.getPluginById.mockResolvedValue({
      pluginId: "filesystem",
      plugin: {
        scan: vi.fn().mockResolvedValue(undefined),
      },
    });

    const route = new ScanRoute();
    const response = createResponseMock();

    await route.handler({ body: { id: "filesystem" } }, response);

    expect(response.send).toHaveBeenCalledWith({ status: "Scan completed" });
    expect(response.status).not.toHaveBeenCalled();
  });
});
