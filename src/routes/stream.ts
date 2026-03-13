/*
 * Created on Sun Feb 01 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../types/route.js";
import { HttpMethods } from "../misc/constants.js";
import { StreamSchema } from "../types/api/stream.js";
import { getPluginById } from "../utils/musicSourcePluginResolver.js";
import { extractPluginId } from "../utils/pathUtils.js";

export class StreamRoute extends Route {
  method = HttpMethods.GET;
  url = "/stream";
  schema = StreamSchema;
  handler = async (request: any, response: any) => {
    const streamId = request.query.id;
    const pluginId = extractPluginId(streamId);
    const pluginResult = await getPluginById(pluginId);
    if (pluginResult.error) {
      response
        .status(pluginResult.error.status)
        .send({ error: pluginResult.error.message });
      return;
    }

    try {
      const plugin = pluginResult.plugin;
      const stream = await plugin.stream(streamId);
      return response.send(stream);
    } catch (error) {
      response.status(404).send({ error: "Song not found" });
    }
  };
}
