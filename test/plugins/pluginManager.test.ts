/*
 * Created on Mon Mar 23 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPluginId,
  withPluginFixtures,
  loadPluginManager,
  EXPECTED_CONFIG_RESPONSE,
} from "../utils/pluginTestUtils.js";
import path from "node:path";

const spies = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  listFolderNames: vi.fn(),
  assertPluginIsRegisteredInDB: vi.fn(),
  findPluginModel: vi.fn(),
  findPluginConfig: vi.fn(),
  upsertPluginConfig: vi.fn(),
}));

vi.mock("../../src/utils/fsUtils.js", () => ({
  listFolderNames: (...args: unknown[]) => spies.listFolderNames(...args),
}));

vi.mock("../../src/types/db/plugin.js", () => ({
  PluginDBModel: {
    assertPluginIsRegisteredInDB: (...args: unknown[]) =>
      spies.assertPluginIsRegisteredInDB(...args),
    find: (...args: unknown[]) => spies.findPluginModel(...args),
  },
  PluginStatus: {
    STARTED: "started",
  },
}));

vi.mock("../../src/types/db/pluginConfig.js", () => ({
  PluginConfigDBModel: {
    findByPluginId: (...args: unknown[]) => spies.findPluginConfig(...args),
    upsertSettings: (...args: unknown[]) => spies.upsertPluginConfig(...args),
  },
}));

describe("PluginManager", () => {
  const testContext = {
    logger: { info: spies.loggerInfo, error: spies.loggerError },
    database: {},
    pluginManager: {},
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    spies.listFolderNames.mockResolvedValue([]);
    spies.findPluginModel.mockResolvedValue(undefined);
    spies.findPluginConfig.mockResolvedValue(undefined);
    spies.upsertPluginConfig.mockResolvedValue(undefined);
  });

  it("initializes private context from constructor parameter", async () => {
    const { PluginManager } =
      await import("../../src/plugins/pluginManager.js");

    const pluginManager = new PluginManager("/plugins", testContext);

    expect(pluginManager).toBeInstanceOf(PluginManager);
    expect(spies.loggerInfo).not.toHaveBeenCalled();
  });

  it("loads plugins from multiple folders and starts them", async () => {
    await withPluginFixtures(
      {
        music_sources: ["fs-source"],
        effects: ["reverb"],
      },
      spies,
      async (tempRoot) => {
        const pluginManager = await loadPluginManager(tempRoot, testContext);
        const loadedPlugins = pluginManager.getAllPlugins();
        const startSpies = loadedPlugins.map((plugin) =>
          vi.spyOn(plugin, "start").mockResolvedValue(undefined),
        );

        spies.findPluginModel.mockImplementation(
          async (_dbClient: unknown, category: string, pluginId: string) => ({
            category,
            id: pluginId,
            status: "started",
          }),
        );

        await pluginManager.startPlugins();

        expect(spies.listFolderNames).toHaveBeenCalledWith(
          path.join(tempRoot, "music_sources"),
        );
        expect(spies.listFolderNames).toHaveBeenCalledWith(
          path.join(tempRoot, "effects"),
        );
        expect(
          spies.listFolderNames.mock.calls.filter(
            (call) => call[0] === path.join(tempRoot, "music_sources"),
          ),
        ).toHaveLength(1);
        expect(
          spies.listFolderNames.mock.calls.filter(
            (call) => call[0] === path.join(tempRoot, "effects"),
          ),
        ).toHaveLength(1);

        expect(pluginManager.getAllPlugins()).toHaveLength(2);
        expect(
          pluginManager.getPluginsInCategory("music_sources"),
        ).toHaveLength(1);
        expect(pluginManager.getPluginsInCategory("effects")).toHaveLength(1);
        expect(startSpies[0]).toHaveBeenCalledTimes(1);
        expect(startSpies[1]).toHaveBeenCalledTimes(1);
      },
    );
  });

  it.each([
    {
      name: "when its DB model is not found",
      mockResult: undefined,
    },
    {
      name: "when DB status is not STARTED",
      mockResult: {
        category: "music_sources",
        id: "music_sources-fs-source",
        status: "stopped",
      },
    },
  ])("does not start a plugin $name", async ({ mockResult }) => {
    const { PluginManager } =
      await import("../../src/plugins/pluginManager.js");

    const category = "music_sources";
    const pluginName = "fs-source";
    const pluginId = createPluginId(category, pluginName);

    await withPluginFixtures(
      { [category]: [pluginName] },
      spies,
      async (tempRoot) => {
        spies.findPluginModel.mockResolvedValue(mockResult);

        const pluginManager = await loadPluginManager(tempRoot, testContext);
        const plugin = pluginManager.getAllPlugins()[0];
        const startSpy = vi.spyOn(plugin, "start").mockResolvedValue(undefined);

        await pluginManager.startPlugins();

        expect(spies.findPluginModel).toHaveBeenCalledWith(
          expect.anything(),
          category,
          pluginId,
        );
        expect(startSpy).not.toHaveBeenCalled();
      },
    );
  });

  it("does not persist plugin configuration during load", async () => {
    await withPluginFixtures(
      { music_sources: ["fs-source"] },
      spies,
      async (tempRoot) => {
        await loadPluginManager(tempRoot, testContext);
        expect(spies.findPluginConfig).not.toHaveBeenCalled();
        expect(spies.upsertPluginConfig).not.toHaveBeenCalled();
      },
    );
  });

  it("continues loading plugins when one plugin index.js is malformed", async () => {
    await withPluginFixtures(
      {
        valid: { music_sources: ["valid-plugin"] },
        malformed: { music_sources: ["malformed-plugin"] },
      },
      spies,
      async (tempRoot) => {
        const pluginManager = await loadPluginManager(tempRoot, testContext);

        // Verify only valid plugin was loaded
        const loadedPlugins = pluginManager.getAllPlugins();
        expect(loadedPlugins).toHaveLength(1);
        expect(loadedPlugins[0].id).toBe("music_sources-valid-plugin");

        // Verify error was logged for malformed plugin
        expect(spies.loggerError).toHaveBeenCalledWith(
          expect.stringMatching(
            /Cannot load plugin from file.*malformed-plugin.*index.js/,
          ),
        );
      },
    );
  });

  it("returns plugin configuration for an existing plugin", async () => {
    await withPluginFixtures(
      { music_sources: ["fs-source"] },
      spies,
      async (tempRoot) => {
        const pluginManager = await loadPluginManager(tempRoot, testContext);
        const result = await pluginManager.getPluginConfiguration(
          "music_sources-fs-source",
        );

        expect(result).toEqual({
          pluginId: "music_sources-fs-source",
          settings: EXPECTED_CONFIG_RESPONSE,
        });
        expect(result).not.toHaveProperty("error");
      },
    );
  });

  it("returns 404 when plugin configuration is requested for a missing plugin", async () => {
    await withPluginFixtures(
      { music_sources: ["fs-source"] },
      spies,
      async (tempRoot) => {
        const pluginManager = await loadPluginManager(tempRoot, testContext);
        const result = await pluginManager.getPluginConfiguration("missing");

        expect(result).toEqual({
          pluginId: "missing",
          error: {
            status: 404,
            message: "Plugin missing not found",
          },
        });
        expect(result).not.toHaveProperty("settings");
      },
    );
  });

  it("updates and persists plugin configuration", async () => {
    await withPluginFixtures(
      { music_sources: ["fs-source"] },
      spies,
      async (tempRoot) => {
        const pluginManager = await loadPluginManager(tempRoot, testContext);
        const result = await pluginManager.updatePluginConfiguration(
          "music_sources-fs-source",
          {
            musicFolder: "/new/path",
          },
        );

        expect(result).toEqual({
          pluginId: "music_sources-fs-source",
          settings: {
            variables: [{ musicFolder: "string" }],
            values: {
              musicFolder: "/new/path",
            },
          },
        });
        expect(result).not.toHaveProperty("error");
        expect(spies.upsertPluginConfig).not.toHaveBeenCalled();
      },
    );
  });

  it("returns error result without settings when update configuration fails", async () => {
    await withPluginFixtures(
      { music_sources: ["fs-source"] },
      spies,
      async (tempRoot) => {
        const pluginManager = await loadPluginManager(tempRoot, testContext);
        const [plugin] = pluginManager.getAllPlugins();
        vi.spyOn(plugin, "updateConfiguration").mockRejectedValue(
          new Error("update failed"),
        );

        const result = await pluginManager.updatePluginConfiguration(
          "music_sources-fs-source",
          {
            musicFolder: "/new/path",
          },
        );

        expect(result).toEqual({
          pluginId: "music_sources-fs-source",
          error: {
            status: 400,
            message: "update failed",
          },
        });
        expect(result).not.toHaveProperty("settings");
      },
    );
  });

  it("getPlugin returns the plugin when category and name are correct", async () => {
    await withPluginFixtures(
      { music_sources: ["fs-source"] },
      spies,
      async (tempRoot) => {
        const pluginManager = await loadPluginManager(tempRoot, testContext);

        const plugin = pluginManager.getPlugin(
          "music_sources",
          "music_sources-fs-source",
        );

        expect(plugin).toBeDefined();
        expect(plugin?.id).toBe("music_sources-fs-source");
      },
    );
  });

  it("getPlugin returns undefined when category does not exist", async () => {
    await withPluginFixtures(
      { music_sources: ["fs-source"] },
      spies,
      async (tempRoot) => {
        const pluginManager = await loadPluginManager(tempRoot, testContext);

        const plugin = pluginManager.getPlugin(
          "non_existent_category",
          "music_sources-fs-source",
        );

        expect(plugin).toBeUndefined();
      },
    );
  });

  it("getPlugin returns undefined when plugin name does not exist in the category", async () => {
    await withPluginFixtures(
      { music_sources: ["fs-source"] },
      spies,
      async (tempRoot) => {
        const pluginManager = await loadPluginManager(tempRoot, testContext);

        const plugin = pluginManager.getPlugin("music_sources", "non-existent");

        expect(plugin).toBeUndefined();
      },
    );
  });
});
