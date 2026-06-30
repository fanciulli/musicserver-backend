/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Plugin } from "../types/plugins/plugin.js";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PluginDBModel, PluginStatus } from "../types/db/plugin.js";
import { PluginConfigDBModel } from "../types/db/pluginConfig.js";
import { Context } from "../types/context.js";
import { listFolderNames } from "../utils/fsUtils.js";
import type {
  PluginConfigurationSettings,
  PluginConfigurationValues,
} from "../types/plugins/plugin.js";

type PluginConfigurationErrorResult = {
  pluginId: string;
  error: {
    status: number;
    message: string;
  };
};

type PluginConfigurationSettingsResult = {
  pluginId: string;
  settings: PluginConfigurationSettings;
};

type PluginConfigurationResult =
  | PluginConfigurationErrorResult
  | PluginConfigurationSettingsResult;

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
      try {
        const pluginInstance =
          await this.#loadPluginFromFolder(pluginIndexFile);
        this.#plugins.set(pluginInstance.id, pluginInstance);
        await pluginInstance.loadConfiguration();

        this.#context.logger.info(
          `Loaded plugin ${pluginInstance.id} in category ${this.category}`,
        );
      } catch (ex: any) {
        this.#context.logger.error(
          `Cannot load plugin from file ${pluginIndexFile}: ${ex.message}`,
        );
      }
    }
  }

  async #loadPluginFromFolder(pluginIndexFile: string): Promise<Plugin> {
    const pluginModule = await import(pathToFileURL(pluginIndexFile).href);
    const pluginClass = pluginModule.default;
    const pluginInstance: Plugin = new pluginClass(this.#context);

    await PluginDBModel.assertPluginIsRegisteredInDB(
      this.#context.database,
      pluginInstance.name,
      pluginInstance.category,
      pluginInstance.id,
    );

    return pluginInstance;
  }

  async startPlugins(): Promise<void> {
    for (let plugin of this.#plugins.values()) {
      const result: PluginDBModel | undefined = await PluginDBModel.find(
        this.#context.database,
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

  constructor(pluginsFolder: string, context: Context) {
    this.#pluginsFolder = pluginsFolder;
    this.#context = context;
  }

  async loadPlugins(): Promise<void> {
    const categories = await listFolderNames(this.#pluginsFolder);

    for (let category of categories) {
      this.#context.logger.info(`loading category ${category}`);
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

  async getPluginConfiguration(
    pluginId: string,
  ): Promise<PluginConfigurationResult> {
    const plugin = this.getPluginById(pluginId);
    if (!plugin) {
      return {
        pluginId,
        error: {
          status: 404,
          message: `Plugin ${pluginId} not found`,
        },
      };
    }

    const settings = await plugin.getConfiguration();
    await PluginConfigDBModel.upsertSettings(
      this.#context.database,
      plugin.category,
      plugin.id,
      settings.values,
    );

    return {
      pluginId: plugin.id,
      settings,
    };
  }

  async updatePluginConfiguration(
    pluginId: string,
    settings: PluginConfigurationValues,
  ): Promise<PluginConfigurationResult> {
    const plugin = this.getPluginById(pluginId);
    if (!plugin) {
      return {
        pluginId,
        error: {
          status: 404,
          message: `Plugin ${pluginId} not found`,
        },
      };
    }

    try {
      await plugin.updateConfiguration(settings);
      const updatedSettings = await plugin.getConfiguration();

      return {
        pluginId: plugin.id,
        settings: updatedSettings,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        pluginId,
        error: {
          status: 400,
          message,
        },
      };
    }
  }
}
