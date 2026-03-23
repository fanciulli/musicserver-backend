/*
 * Created on Mon Mar 23 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type PluginFixtures = Record<string, string[]>;

const spies = vi.hoisted(() => ({
  contextCreate: vi.fn(),
  loggerInfo: vi.fn(),
  listFolderNames: vi.fn(),
  assertPluginIsRegisteredInDB: vi.fn(),
  findPluginModel: vi.fn(),
}));

vi.mock("../../src/types/context.js", () => ({
  Context: {
    create: () => spies.contextCreate(),
  },
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

function createPluginId(category: string, pluginName: string): string {
  return `${category}-${pluginName}`;
}

function buildPluginClassSource(category: string, pluginName: string): string {
  const pluginId = createPluginId(category, pluginName);

  return `export default class TestPlugin {
  constructor(context) {
    this.context = context;
    this.name = "${pluginName}";
    this.category = "${category}";
    this.id = "${pluginId}";
  }

  async start() {}
}\n`;
}

async function createPluginFixtures(
  tempRoot: string,
  fixtures: PluginFixtures,
): Promise<void> {
  for (const [category, pluginNames] of Object.entries(fixtures)) {
    for (const pluginName of pluginNames) {
      const pluginFolder = path.join(tempRoot, category, pluginName);
      await mkdir(pluginFolder, { recursive: true });
      await writeFile(
        path.join(pluginFolder, "index.js"),
        buildPluginClassSource(category, pluginName),
      );
    }
  }
}

function mockListFolderNamesForFixtures(
  tempRoot: string,
  fixtures: PluginFixtures,
): void {
  const categories = Object.keys(fixtures);

  spies.listFolderNames.mockImplementation(async (folderPath: string) => {
    if (folderPath === tempRoot) {
      return categories;
    }

    for (const [category, pluginNames] of Object.entries(fixtures)) {
      if (folderPath === path.join(tempRoot, category)) {
        return pluginNames;
      }
    }

    return [];
  });
}

async function withPluginFixtures(
  fixtures: PluginFixtures,
  run: (tempRoot: string) => Promise<void>,
): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "plugins-fixture-"));

  try {
    await createPluginFixtures(tempRoot, fixtures);
    mockListFolderNamesForFixtures(tempRoot, fixtures);
    await run(tempRoot);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

describe("PluginManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    spies.contextCreate.mockReturnValue({
      logger: { info: spies.loggerInfo },
      database: { client: {} },
      pluginManager: {},
    });

    spies.listFolderNames.mockResolvedValue([]);
    spies.findPluginModel.mockResolvedValue(undefined);
  });

  it("initializes private context by calling Context.create once", async () => {
    const { PluginManager } =
      await import("../../src/plugins/pluginManager.js");

    const pluginManager = new PluginManager("/plugins");

    expect(pluginManager).toBeInstanceOf(PluginManager);
    expect(spies.contextCreate).toHaveBeenCalledTimes(1);
  });

  it("loads plugins from multiple folders and starts them", async () => {
    const { PluginManager } =
      await import("../../src/plugins/pluginManager.js");

    await withPluginFixtures(
      {
        music_sources: ["fs-source"],
        effects: ["reverb"],
      },
      async (tempRoot) => {
        const pluginManager = new PluginManager(tempRoot);
        await pluginManager.loadPlugins();

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

  it("does not start a plugin when its DB model is not found", async () => {
    const { PluginManager } =
      await import("../../src/plugins/pluginManager.js");

    const category = "music_sources";
    const pluginName = "fs-source";
    const pluginId = createPluginId(category, pluginName);

    await withPluginFixtures({ [category]: [pluginName] }, async (tempRoot) => {
      spies.findPluginModel.mockResolvedValue(undefined);

      const pluginManager = new PluginManager(tempRoot);
      await pluginManager.loadPlugins();

      const plugin = pluginManager.getAllPlugins()[0];
      const startSpy = vi.spyOn(plugin, "start").mockResolvedValue(undefined);

      await pluginManager.startPlugins();

      expect(spies.findPluginModel).toHaveBeenCalledWith(
        expect.anything(),
        category,
        pluginId,
      );
      expect(startSpy).not.toHaveBeenCalled();
    });
  });

  it("does not start a plugin when DB status is not STARTED", async () => {
    const { PluginManager } =
      await import("../../src/plugins/pluginManager.js");

    const category = "music_sources";
    const pluginName = "fs-source";
    const pluginId = createPluginId(category, pluginName);

    await withPluginFixtures({ [category]: [pluginName] }, async (tempRoot) => {
      spies.findPluginModel.mockResolvedValue({
        category,
        id: pluginId,
        status: "stopped",
      });

      const pluginManager = new PluginManager(tempRoot);
      await pluginManager.loadPlugins();

      const plugin = pluginManager.getAllPlugins()[0];
      const startSpy = vi.spyOn(plugin, "start").mockResolvedValue(undefined);

      await pluginManager.startPlugins();

      expect(spies.findPluginModel).toHaveBeenCalledWith(
        expect.anything(),
        category,
        pluginId,
      );
      expect(startSpy).not.toHaveBeenCalled();
    });
  });
});
