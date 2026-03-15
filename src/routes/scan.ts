/*
 * Created on Sun Feb 01 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../types/route.js";
import { HttpMethods } from "../misc/constants.js";
import { ScanSchema } from "../types/api/scan.js";
import { getPluginById } from "../utils/musicSourcePluginResolver.js";

export class ScanRoute extends Route {
  method = HttpMethods.POST;
  url = "/scan";
  schema = ScanSchema;
  handler = async (request: any, response: any) => {
    const pluginId = request.body.id;
    const pluginResult = await getPluginById(pluginId);
    if (pluginResult.error) {
      response
        .status(pluginResult.error.status)
        .send({ error: pluginResult.error.message });
      return;
    }

    const plugin = pluginResult.plugin;

    await plugin.scan();

    response.send({ status: "Scan completed" });
  };
}
