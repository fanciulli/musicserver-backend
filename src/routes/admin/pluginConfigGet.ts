/*
 * Created on Thu Mar 27 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { musicServerInstance } from "../../server/musicServer.js";
import {
  PluginConfigGetSchema,
  PluginConfiguration,
} from "../../types/api/plugins.js";

export default class PluginConfigGetRoute extends Route {
  method = HttpMethods.GET;
  url = "/admin/plugins/:pluginId/config";
  schema = PluginConfigGetSchema;
  handler = async (request: any, response: any) => {
    const pluginId = request.params.pluginId;
    const pluginManager = musicServerInstance.getPluginManager();

    const configResult = await pluginManager.getPluginConfiguration(pluginId);
    if (configResult.error) {
      response.status(configResult.error.status).send({
        error: configResult.error.message,
      });
      return;
    }

    const pluginConfiguration = new PluginConfiguration();
    pluginConfiguration.pluginId = configResult.pluginId;
    pluginConfiguration.settings = configResult.settings;

    response.send(pluginConfiguration);
  };
}
