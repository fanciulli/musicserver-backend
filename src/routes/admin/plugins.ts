/*
 * Created on Fri Mar 06 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { PluginsSchema } from "../../types/api/plugins.js";
import { PluginListItem } from "../../types/api/plugins.js";
import { PluginDBModel, PluginStatus } from "../../types/db/plugin.js";
import type { Context } from "../../types/context.js";

export default class PluginsRoute extends Route {
  method = HttpMethods.GET;
  url = "/admin/plugins";
  schema = PluginsSchema;
  handler = async (request: any, response: any) => {
    const plugins = await this.getInstalledPlugins();

    response.send(plugins);
  };

  getInstalledPlugins = async (): Promise<Array<PluginListItem>> => {
    const context: Context = this.getContext();
    const db = context.database;

    const plugins = context.pluginManager.getAllPlugins();
    const response: Array<PluginListItem> = [];

    for (const plugin of plugins) {
      const record = await PluginDBModel.find(db, plugin.category, plugin.id);

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
