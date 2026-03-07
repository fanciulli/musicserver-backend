/*
 * Created on Fri Mar 06 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../types/route.js";
import { HttpMethods } from "../misc/constants.js";
import { musicServerInstance } from "../server/music_server.js";
import {
  PluginStartSchema,
  PluginStopSchema,
  PluginsSchema,
} from "../types/api/plugins.js";
import { PluginListItem } from "../types/api/plugins.js";
import { PluginDBModel, PluginStatus } from "../types/db/plugin.js";

export class PluginsRoute extends Route {
  method = HttpMethods.GET;
  url = "/plugins";
  schema = PluginsSchema;
  handler = async (request: any, response: any) => {
    const plugins = await this.getInstalledPlugins();

    response.send(plugins);
  };

  getInstalledPlugins = async (): Promise<Array<PluginListItem>> => {
    const pluginManager = musicServerInstance.getPluginManager();
    const database = musicServerInstance.getDatabase();
    const plugins = pluginManager.getAllPlugins();
    const response: Array<PluginListItem> = [];

    for (const plugin of plugins) {
      const record = await PluginDBModel.find(
        database.client,
        plugin.category,
        plugin.id,
      );

      const pluginItem = new PluginListItem();
      pluginItem.id = plugin.id;
      pluginItem.name = plugin.name;
      pluginItem.category = plugin.category;
      pluginItem.status = record?.status ?? PluginStatus.DISABLED;

      response.push(pluginItem);
    }

    return response;
  };
}

export class PluginStopRoute extends Route {
  method = HttpMethods.POST;
  url = "/plugins/stop";
  schema = PluginStopSchema;
  handler = async (request: any, response: any) => {
    const pluginId = request.body.pluginId;

    const pluginManager = musicServerInstance.getPluginManager();
    const database = musicServerInstance.getDatabase();
    const plugin = pluginManager.getPluginById(pluginId);

    if (plugin === undefined) {
      response.status(404).send({ error: `Plugin ${pluginId} not found` });
      return;
    }

    await plugin.stop();
    await PluginDBModel.setStatus(
      database.client,
      plugin.category,
      plugin.id,
      PluginStatus.STOPPED,
    );

    response.send({ status: "Plugin stopped" });
  };
}

export class PluginStartRoute extends Route {
  method = HttpMethods.POST;
  url = "/plugins/start";
  schema = PluginStartSchema;
  handler = async (request: any, response: any) => {
    const pluginId = request.body.pluginId;

    const pluginManager = musicServerInstance.getPluginManager();
    const database = musicServerInstance.getDatabase();
    const plugin = pluginManager.getPluginById(pluginId);

    if (plugin === undefined) {
      response.status(404).send({ error: `Plugin ${pluginId} not found` });
      return;
    }

    await plugin.start();
    await PluginDBModel.setStatus(
      database.client,
      plugin.category,
      plugin.id,
      PluginStatus.STARTED,
    );

    response.send({ status: "Plugin started" });
  };
}
