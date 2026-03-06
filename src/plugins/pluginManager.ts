/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Plugin } from "../types/plugins/plugin.js";
import { readdir } from "node:fs/promises";
import { musicServerInstance } from "../server/music_server.js";
import path from "node:path";
import { Database } from "../server/database.js";
import { Logger } from "../server/logging.js";
import { PluginDBModel, PluginStatus } from "../types/db/plugin.js";

const listFolders = async (parentFolder: string): Promise<string[]> => {
  const dirListing = await readdir(parentFolder, { withFileTypes: true });
  const directories = dirListing
    .filter((item) => {
      return item.isDirectory();
    })
    .map((dir) => {
      return dir.name;
    });
  return directories;
};

class PluginList {
  category: string;
  #plugins: Map<string, Plugin> = new Map();
  #database?: Database;
  #logger?: Logger;

  constructor(category: string) {
    this.category = category;
    this.#database = musicServerInstance.getDatabase();
    this.#logger = musicServerInstance.getLogger();
  }

  get(name: string): Plugin | undefined {
    return this.#plugins.get(name);
  }

  getAll(): Array<Plugin> {
    return Array.from(this.#plugins.values());
  }

  async loadPluginsFromFolder(folderPath: string): Promise<void> {
    const pluginsDirectories = await listFolders(folderPath);

    for (let pluginDir of pluginsDirectories) {
      const pluginIndexFile = path.join(folderPath, pluginDir, "index.js");
      const pluginModule = await import(pluginIndexFile);
      const pluginClass = pluginModule.default;
      const pluginInstance: Plugin = new pluginClass();

      PluginDBModel.assertPluginIsRegisteredInDB(
        this.#database.client,
        pluginInstance.name,
        pluginInstance.category,
        pluginInstance.id,
      );
      this.#plugins.set(pluginInstance.id, pluginInstance);

      this.#logger.info(
        `Loaded plugin ${pluginInstance.id} in category ${this.category}`,
      );
    }
  }

  async startPlugins(): Promise<void> {
    for (let plugin of this.#plugins.values()) {
      const result: PluginDBModel = await PluginDBModel.find(
        this.#database.client,
        plugin.category,
        plugin.id,
      );

      if (result && result.status === PluginStatus.STARTED) {
        await plugin.start();
      } else {
        this.#logger.info(
          `Plugin ${plugin.id} in category ${this.category} is not started because its status in DB is ${result?.status}`,
        );
      }
    }
  }
}

export class PluginManager {
  #pluginsFolder: string = ".";
  #plugins: Map<string, PluginList> = new Map();
  #logger?: Logger;

  constructor(pluginsFolder: string) {
    this.#pluginsFolder = pluginsFolder;
    this.#logger = musicServerInstance.getLogger();
  }

  async loadPlugins(): Promise<void> {
    const categories = await listFolders(this.#pluginsFolder);

    for (let category of categories) {
      this.#logger.info("loading category " + category);
      let pluginList = new PluginList(category);
      await pluginList.loadPluginsFromFolder(
        path.join(this.#pluginsFolder, category),
      );

      this.#plugins.set(category, pluginList);
    }
  }

  async startPlugins(): Promise<void> {
    this.#logger.info("Starting plugins...");
    for (let pluginList of this.#plugins.values()) {
      await pluginList.startPlugins();
    }
  }

  getPluginsInCategory(category: string): Array<Plugin> {
    const pluginsList = this.#plugins.get(category);
    const plugins = pluginsList?.getAll();
    return plugins ? plugins : [];
  }

  getAllPlugins(): Array<Plugin> {
    const plugins: Array<Plugin> = [];
    for (let pluginList of this.#plugins.values()) {
      plugins.push(...pluginList.getAll());
    }
    return plugins;
  }

  getPlugin(category: string, name: string): Plugin | undefined {
    return this.#plugins.get(category)?.get(name);
  }

  getPluginById(id: string): Plugin | undefined {
    return this.getAllPlugins().find((pluginItem) => pluginItem.id === id);
  }
}
