/*
 * Created on Mon Mar 29 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { mkdir, writeFile, rm, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MockProxy } from "vitest";

export type PluginFixtures = Record<string, string[]>;

export interface PluginFixtureConfig {
  valid?: PluginFixtures;
  malformed?: PluginFixtures;
}

export interface PluginTestSpies {
  listFolderNames: MockProxy<any>;
}

export function createPluginId(
  category: string,
  pluginName: string,
): string {
  return `${category}-${pluginName}`;
}

export function buildPluginClassSource(
  category: string,
  pluginName: string,
): string {
  const pluginId = createPluginId(category, pluginName);

  return `export default class TestPlugin {
  constructor(context) {
    this.context = context;
    this.name = "${pluginName}";
    this.category = "${category}";
    this.id = "${pluginId}";
    this.configuration = {
      musicFolder: "/seed/${pluginName}",
    };
  }

  async start() {}

  async loadConfiguration() {}

  async getConfiguration() {
    return {
      variables: [{ musicFolder: "string" }],
      values: this.configuration,
    };
  }

  async updateConfiguration(settings) {
    this.configuration = {
      ...this.configuration,
      ...settings,
    };
  }
}\n`;
}

export async function createPluginFixtures(
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

export function mockListFolderNamesForFixtures(
  spies: PluginTestSpies,
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

export async function withPluginFixtures(
  config: PluginFixtures | PluginFixtureConfig,
  spies: PluginTestSpies,
  run: (tempRoot: string) => Promise<void>,
): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "plugins-fixture-"));

  try {
    const fixtures = "valid" in config ? config.valid : config;
    const malformed = "malformed" in config ? config.malformed : undefined;

    if (fixtures) {
      await createPluginFixtures(tempRoot, fixtures);
    }

    // Create malformed plugins if specified
    if (malformed) {
      for (const [category, pluginNames] of Object.entries(malformed)) {
        for (const pluginName of pluginNames) {
          const pluginFolder = path.join(tempRoot, category, pluginName);
          await mkdir(pluginFolder, { recursive: true });
          await writeFile(
            path.join(pluginFolder, "index.js"),
            "export default class BrokenPlugin { this is invalid javascript syntax }",
          );
        }
      }
    }

    const allFixtures: PluginFixtures = {};
    if (fixtures) {
      Object.assign(allFixtures, fixtures);
    }
    if (malformed) {
      for (const [category, pluginNames] of Object.entries(malformed)) {
        allFixtures[category] = [
          ...(allFixtures[category] || []),
          ...pluginNames,
        ];
      }
    }
    mockListFolderNamesForFixtures(spies, tempRoot, allFixtures);
    await run(tempRoot);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

export async function loadPluginManager(tempRoot: string) {
  const { PluginManager } = await import("../../src/plugins/pluginManager.js");
  const pluginManager = new PluginManager(tempRoot);
  await pluginManager.loadPlugins();
  return pluginManager;
}

export const EXPECTED_CONFIG_RESPONSE = {
  variables: [{ musicFolder: "string" }],
  values: {
    musicFolder: "/seed/fs-source",
  },
};
