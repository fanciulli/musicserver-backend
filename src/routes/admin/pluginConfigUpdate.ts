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
  PluginConfigUpdateSchema,
  PluginConfiguration,
} from "../../types/api/plugins.js";

export default class PluginConfigUpdateRoute extends Route {
  method = HttpMethods.PUT;
  url = "/admin/plugins/:pluginId/config";
  schema = PluginConfigUpdateSchema;
  handler = async (request: any, response: any) => {
    const pluginId = request.params.pluginId;
    const settings = request.body.settings as Record<string, unknown>;
    const pluginManager = musicServerInstance.getPluginManager();

    const configResult = await pluginManager.updatePluginConfiguration(
      pluginId,
      settings,
    );
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
