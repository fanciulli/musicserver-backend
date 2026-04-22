/*
 * Created on Wed Mar 25 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { PluginStopSchema } from "../../types/api/plugins.js";
import { PluginDBModel, PluginStatus } from "../../types/db/plugin.js";

export default class PluginStopRoute extends Route {
  method = HttpMethods.POST;
  url = "/admin/plugins/stop";
  schema = PluginStopSchema;
  handler = async (request: any, response: any) => {
    const pluginId = request.body.pluginId;

    const context = this.getContext();
    const database = context.database;
    const plugin = context.pluginManager.getPluginById(pluginId);

    if (plugin === undefined) {
      response.status(404).send({ error: `Plugin ${pluginId} not found` });
      return;
    }

    await plugin.stop();
    await PluginDBModel.setStatus(
      database,
      plugin.category,
      plugin.id,
      PluginStatus.STOPPED,
    );

    response.send({ status: "Plugin stopped" });
  };
}
