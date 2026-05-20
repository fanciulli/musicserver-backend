/*
 * Created on Wed Mar 25 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { PluginStartSchema } from "../../types/api/plugins.js";
import { PluginDBModel, PluginStatus } from "../../types/db/plugin.js";

export default class PluginStartRoute extends Route {
  method = HttpMethods.POST;
  url = "/admin/plugins/start";
  schema = PluginStartSchema;
  handler = async (request: any, response: any) => {
    const pluginId = request.body.pluginId;

    const database = this.getDatabase();
    const plugin = this.getPluginManager().getPluginById(pluginId);

    if (plugin === undefined) {
      response.status(404).send({ error: `Plugin ${pluginId} not found` });
      return;
    }

    await plugin.start();
    await PluginDBModel.setStatus(
      database,
      plugin.category,
      plugin.id,
      PluginStatus.STARTED,
    );

    response.send({ status: "Plugin started" });
  };
}
