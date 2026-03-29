/*
 * Created on Wed Mar 25 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPluginManager: vi.fn(),
  getDatabase: vi.fn(),
  find: vi.fn(),
  setStatus: vi.fn(),
  getPluginConfiguration: vi.fn(),
  updatePluginConfiguration: vi.fn(),
}));

vi.mock("../../src/server/musicServer.js", () => ({
  musicServerInstance: {
    getPluginManager: () => mocks.getPluginManager(),
    getDatabase: () => mocks.getDatabase(),
  },
}));

vi.mock("../../src/types/db/plugin.js", () => ({
  PluginDBModel: {
    find: (...args: unknown[]) => mocks.find(...args),
    setStatus: (...args: unknown[]) => mocks.setStatus(...args),
  },
  PluginStatus: {
    DISABLED: "disabled",
    STOPPED: "stopped",
    STARTED: "started",
  },
}));

import { default as PluginStartRoute } from "../../src/routes/admin/pluginStart.js";
import { default as PluginStopRoute } from "../../src/routes/admin/pluginStop.js";
import { default as PluginConfigGetRoute } from "../../src/routes/admin/pluginConfigGet.js";
import { default as PluginConfigUpdateRoute } from "../../src/routes/admin/pluginConfigUpdate.js";
import { default as PluginsRoute } from "../../src/routes/admin/plugins.js";

function createResponseMock() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

describe("Plugins routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabase.mockReturnValue({ client: "db-client" });
    mocks.getPluginManager.mockReturnValue({
      getPluginConfiguration: (...args: unknown[]) =>
        mocks.getPluginConfiguration(...args),
      updatePluginConfiguration: (...args: unknown[]) =>
        mocks.updatePluginConfiguration(...args),
    });
  });

  it("uses /admin prefix for plugins routes", () => {
    expect(new PluginsRoute().url).toBe("/admin/plugins");
    expect(new PluginStopRoute().url).toBe("/admin/plugins/stop");
    expect(new PluginStartRoute().url).toBe("/admin/plugins/start");
    expect(new PluginConfigGetRoute().url).toBe(
      "/admin/plugins/:pluginId/config",
    );
    expect(new PluginConfigUpdateRoute().url).toBe(
      "/admin/plugins/:pluginId/config",
    );
  });

  it("returns installed plugins with DISABLED fallback when DB status is missing", async () => {
    mocks.getPluginManager.mockReturnValue({
      getAllPlugins: vi
        .fn()
        .mockReturnValue([
          { id: "p1", name: "Plugin One", category: "music_sources" },
        ]),
    });
    mocks.find.mockResolvedValue(undefined);

    const route = new PluginsRoute();
    const response = createResponseMock();

    await route.handler({}, response);

    expect(mocks.find).toHaveBeenCalledWith("db-client", "music_sources", "p1");
    expect(response.send).toHaveBeenCalledWith([
      {
        id: "p1",
        name: "Plugin One",
        category: "music_sources",
        status: "disabled",
      },
    ]);
  });

  it("returns 404 when stopping a missing plugin", async () => {
    mocks.getPluginManager.mockReturnValue({
      getPluginById: vi.fn().mockReturnValue(undefined),
    });

    const route = new PluginStopRoute();
    const response = createResponseMock();

    await route.handler({ body: { pluginId: "missing" } }, response);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.send).toHaveBeenCalledWith({
      error: "Plugin missing not found",
    });
    expect(mocks.setStatus).not.toHaveBeenCalled();
  });

  it("stops plugin and stores STOPPED status on success", async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    mocks.getPluginManager.mockReturnValue({
      getPluginById: vi.fn().mockReturnValue({
        id: "p1",
        category: "music_sources",
        stop,
      }),
    });
    mocks.setStatus.mockResolvedValue(undefined);

    const route = new PluginStopRoute();
    const response = createResponseMock();

    await route.handler({ body: { pluginId: "p1" } }, response);

    expect(stop).toHaveBeenCalledTimes(1);
    expect(mocks.setStatus).toHaveBeenCalledWith(
      "db-client",
      "music_sources",
      "p1",
      "stopped",
    );
    expect(response.send).toHaveBeenCalledWith({ status: "Plugin stopped" });
  });

  it("returns 404 when starting a missing plugin", async () => {
    mocks.getPluginManager.mockReturnValue({
      getPluginById: vi.fn().mockReturnValue(undefined),
    });

    const route = new PluginStartRoute();
    const response = createResponseMock();

    await route.handler({ body: { pluginId: "missing" } }, response);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.send).toHaveBeenCalledWith({
      error: "Plugin missing not found",
    });
    expect(mocks.setStatus).not.toHaveBeenCalled();
  });

  it("starts plugin and stores STARTED status on success", async () => {
    const start = vi.fn().mockResolvedValue(undefined);
    mocks.getPluginManager.mockReturnValue({
      getPluginById: vi.fn().mockReturnValue({
        id: "p1",
        category: "music_sources",
        start,
      }),
    });
    mocks.setStatus.mockResolvedValue(undefined);

    const route = new PluginStartRoute();
    const response = createResponseMock();

    await route.handler({ body: { pluginId: "p1" } }, response);

    expect(start).toHaveBeenCalledTimes(1);
    expect(mocks.setStatus).toHaveBeenCalledWith(
      "db-client",
      "music_sources",
      "p1",
      "started",
    );
    expect(response.send).toHaveBeenCalledWith({ status: "Plugin started" });
  });

  it("returns plugin configuration on GET config success", async () => {
    mocks.getPluginConfiguration.mockResolvedValue({
      pluginId: "p1",
      settings: {
        variables: [{ musicFolder: "string" }],
        values: {
          musicFolder: "/music/library",
        },
      },
    });

    const route = new PluginConfigGetRoute();
    const response = createResponseMock();

    await route.handler({ params: { pluginId: "p1" } }, response);

    expect(mocks.getPluginConfiguration).toHaveBeenCalledWith("p1");
    expect(response.send).toHaveBeenCalledWith({
      pluginId: "p1",
      settings: {
        variables: [{ musicFolder: "string" }],
        values: {
          musicFolder: "/music/library",
        },
      },
    });
  });

  it("returns 404 on GET config when plugin is missing", async () => {
    mocks.getPluginConfiguration.mockResolvedValue({
      pluginId: "missing",
      error: {
        status: 404,
        message: "Plugin missing not found",
      },
    });

    const route = new PluginConfigGetRoute();
    const response = createResponseMock();

    await route.handler({ params: { pluginId: "missing" } }, response);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.send).toHaveBeenCalledWith({
      error: "Plugin missing not found",
    });
  });

  it("updates plugin configuration on PUT config success", async () => {
    mocks.updatePluginConfiguration.mockResolvedValue({
      pluginId: "p1",
      settings: {
        variables: [{ musicFolder: "string" }],
        values: {
          musicFolder: "/mnt/music",
        },
      },
    });

    const route = new PluginConfigUpdateRoute();
    const response = createResponseMock();

    await route.handler(
      {
        params: { pluginId: "p1" },
        body: {
          settings: {
            musicFolder: "/mnt/music",
          },
        },
      },
      response,
    );

    expect(mocks.updatePluginConfiguration).toHaveBeenCalledWith("p1", {
      musicFolder: "/mnt/music",
    });
    expect(response.send).toHaveBeenCalledWith({
      pluginId: "p1",
      settings: {
        variables: [{ musicFolder: "string" }],
        values: {
          musicFolder: "/mnt/music",
        },
      },
    });
  });

  it("returns 400 on PUT config validation error", async () => {
    mocks.updatePluginConfiguration.mockResolvedValue({
      pluginId: "p1",
      error: {
        status: 400,
        message: "musicFolder must be a non-empty string",
      },
    });

    const route = new PluginConfigUpdateRoute();
    const response = createResponseMock();

    await route.handler(
      {
        params: { pluginId: "p1" },
        body: {
          settings: {
            musicFolder: "",
          },
        },
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith({
      error: "musicFolder must be a non-empty string",
    });
  });
});
