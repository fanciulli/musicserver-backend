/*
 * Created on Wed Mar 25 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { musicServerInstance } from "../../server/musicServer.js";
import { PluginStopSchema } from "../../types/api/plugins.js";
import { PluginDBModel, PluginStatus } from "../../types/db/plugin.js";

export default class PluginStopRoute extends Route {
  method = HttpMethods.POST;
  url = "/admin/plugins/stop";
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
