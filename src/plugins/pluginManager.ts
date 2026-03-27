/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Plugin } from "../types/plugins/plugin.js";
import path from "node:path";
import { PluginDBModel, PluginStatus } from "../types/db/plugin.js";
import { Context } from "../types/context.js";
import { listFolderNames } from "../utils/fsUtils.js";

class PluginList {
  category: string;
  #plugins: Map<string, Plugin> = new Map();
  #context: Context;

  constructor(category: string, context: Context) {
    this.category = category;
    this.#context = context;
  }

  get(name: string): Plugin | undefined {
    return this.#plugins.get(name);
  }

  getAll(): Array<Plugin> {
    return Array.from(this.#plugins.values());
  }

  async loadPluginsFromFolder(folderPath: string): Promise<void> {
    const pluginsDirectories = await listFolderNames(folderPath);

    for (let pluginDir of pluginsDirectories) {
      const pluginIndexFile = path.join(folderPath, pluginDir, "index.js");
      const pluginModule = await import(pluginIndexFile);
      const pluginClass = pluginModule.default;
      const pluginInstance: Plugin = new pluginClass(this.#context);

      PluginDBModel.assertPluginIsRegisteredInDB(
        this.#context.database.client,
        pluginInstance.name,
        pluginInstance.category,
        pluginInstance.id,
      );
      this.#plugins.set(pluginInstance.id, pluginInstance);

      this.#context.logger.info(
        `Loaded plugin ${pluginInstance.id} in category ${this.category}`,
      );
    }
  }

  async startPlugins(): Promise<void> {
    for (let plugin of this.#plugins.values()) {
      const result: PluginDBModel = await PluginDBModel.find(
        this.#context.database.client,
        plugin.category,
        plugin.id,
      );

      if (result && result.status === PluginStatus.STARTED) {
        await plugin.start();
      } else {
        this.#context.logger.info(
          `Plugin ${plugin.id} in category ${this.category} is not started because its status in DB is ${result?.status}`,
        );
      }
    }
  }
}

export class PluginManager {
  #pluginsFolder: string = ".";
  #plugins: Map<string, PluginList> = new Map();
  #context: Context;

  constructor(pluginsFolder: string) {
    this.#pluginsFolder = pluginsFolder;
    this.#context = Context.create();
  }

  async loadPlugins(): Promise<void> {
    const categories = await listFolderNames(this.#pluginsFolder);

    for (let category of categories) {
      this.#context.logger.info("loading category " + category);
      let pluginList = new PluginList(category, this.#context);
      await pluginList.loadPluginsFromFolder(
        path.join(this.#pluginsFolder, category),
      );

      this.#plugins.set(category, pluginList);
    }
  }

  async startPlugins(): Promise<void> {
    this.#context.logger.info("Starting plugins...");
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
