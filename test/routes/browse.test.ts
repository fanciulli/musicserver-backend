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
  getPluginManager: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock("../../src/server/musicServer.js", () => ({
  musicServerInstance: {
    getPluginManager: () => mocks.getPluginManager(),
    getDatabase: () => mocks.getDatabase(),
  },
}));

vi.mock("../../src/utils/pathUtils.js", () => ({
  extractPluginId: (...args: unknown[]) => mocks.extractPluginId(...args),
}));

vi.mock("../../src/utils/musicSourcePluginResolver.js", () => ({
  getPluginById: (...args: unknown[]) => mocks.getPluginById(...args),
}));

import { default as BrowseRoute } from "../../src/routes/music/browse.js";

function createResponseMock() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

describe("BrowseRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPluginManager.mockReturnValue({});
    mocks.getDatabase.mockReturnValue({ client: {} });
  });

  it.each(["/", ""])("sends browser root when path is %s", async (path) => {
    const plugins = [
      {
        id: "filesystem",
        name: "Filesystem",
        category: "music_sources",
      },
      {
        id: "disabled-plugin",
        name: "Disabled Plugin",
        category: "music_sources",
      },
    ];
    const pluginManager = {
      getPluginsInCategory: vi.fn().mockReturnValue(plugins),
    };
    const findOne = vi.fn().mockImplementation(({ pluginId }) => {
      if (pluginId === "filesystem") {
        return { status: "started" };
      }

      return { status: "stopped" };
    });
    const databaseClient = {
      collection: vi.fn().mockReturnValue({ findOne }),
    };

    mocks.getPluginManager.mockReturnValue(pluginManager);
    mocks.getDatabase.mockReturnValue({ client: databaseClient });

    const route = new BrowseRoute();
    const response = createResponseMock();

    const browsePathInPluginSpy = vi.spyOn(route, "browsePathInPlugin");

    await route.handler({ body: { path } }, response);

    expect(pluginManager.getPluginsInCategory).toHaveBeenCalledOnce();
    expect(databaseClient.collection).toHaveBeenCalledWith("plugins");
    expect(findOne).toHaveBeenCalledTimes(2);

    const sentPayload = response.send.mock.calls[0][0];
    expect(sentPayload).toHaveLength(1);
    expect(sentPayload[0]).toMatchObject({
      id: "filesystem://",
      type: "folder",
      metadata: {
        name: "Filesystem",
      },
    });
    expect(browsePathInPluginSpy).not.toHaveBeenCalled();
  });

  it("fails when extractPluginId throws", async () => {
    mocks.extractPluginId.mockImplementation(() => {
      throw new Error("extractPluginId failed");
    });

    const route = new BrowseRoute();
    const response = createResponseMock();

    await expect(
      route.handler({ body: { path: "broken-path" } }, response),
    ).rejects.toThrow("extractPluginId failed");
  });

  it("sends error when getPluginById returns an error", async () => {
    mocks.extractPluginId.mockReturnValue("filesystem");
    mocks.getPluginById.mockResolvedValue({
      pluginId: "filesystem",
      error: {
        status: 409,
        message: "Plugin filesystem is not started",
      },
    });

    const route = new BrowseRoute();
    const response = createResponseMock();

    await route.handler({ body: { path: "filesystem://albums" } }, response);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.send).toHaveBeenCalledWith({
      error: "Plugin filesystem is not started",
    });
  });

  it("fails when route execution throws in plugin.browse", async () => {
    mocks.extractPluginId.mockReturnValue("filesystem");
    mocks.getPluginById.mockResolvedValue({
      pluginId: "filesystem",
      plugin: {
        browse: vi.fn().mockRejectedValue(new Error("browse failed")),
      },
    });

    const route = new BrowseRoute();
    const response = createResponseMock();

    await expect(
      route.handler({ body: { path: "filesystem://albums" } }, response),
    ).rejects.toThrow("browse failed");
  });

  it("sends browse response on success", async () => {
    const songs = [{ uri: "filesystem://track-1" }];
    mocks.extractPluginId.mockReturnValue("filesystem");
    mocks.getPluginById.mockResolvedValue({
      pluginId: "filesystem",
      plugin: {
        browse: vi.fn().mockResolvedValue(songs),
      },
    });

    const route = new BrowseRoute();
    const response = createResponseMock();

    await route.handler({ body: { path: "filesystem://albums" } }, response);

    expect(response.send).toHaveBeenCalledWith(songs);
    expect(response.status).not.toHaveBeenCalled();
  });
});
