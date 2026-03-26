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
  });

  it("uses /admin prefix for plugins routes", () => {
    expect(new PluginsRoute().url).toBe("/admin/plugins");
    expect(new PluginStopRoute().url).toBe("/admin/plugins/stop");
    expect(new PluginStartRoute().url).toBe("/admin/plugins/start");
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
});
