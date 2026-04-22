/*
 * Created on Sun Feb 01 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../../types/route.js";
import { HttpMethods } from "../../misc/constants.js";
import { StreamSchema } from "../../types/api/stream.js";
import {
  getPluginById,
  type PluginResolutionResult,
} from "../../utils/musicSourcePluginResolver.js";
import { extractPluginId } from "../../utils/pathUtils.js";

export default class StreamRoute extends Route {
  method = HttpMethods.GET;
  url = "/music/stream";
  schema = StreamSchema;
  handler = async (request: any, response: any) => {
    const streamId = request.query.id;
    const pluginId: string = extractPluginId(streamId);
    const pluginResult: PluginResolutionResult = await getPluginById(
      pluginId,
      this.getContext(),
    );
    if (pluginResult.error) {
      response
        .status(pluginResult.error.status)
        .send({ error: pluginResult.error.message });
      return;
    }

    try {
      if (pluginResult.plugin) {
        const streamStart = this.#extractStreamStartFromRange(
          request.headers?.range,
        );

        const [stream, size] = await pluginResult.plugin.stream(
          streamId,
          streamStart,
        );

        return response
          .headers({
            "accept-ranges": "bytes",
            "content-length": size,
          })
          .status(streamStart ? 206 : 200)
          .send(stream);
      } else {
        response.status(404).send({ error: "Plugin not found" });
      }
    } catch (error) {
      console.log(error);
      response.status(404).send({ error: "Song not found" });
    }
  };

  #extractStreamStartFromRange(rangeHeader: string): number | undefined {
    if (rangeHeader === undefined) {
      return undefined;
    }

    const parsedRange = rangeHeader.match(/^[^=]+=([0-9]+)-.*$/);
    if (!parsedRange) {
      return undefined;
    }

    return Number.parseInt(parsedRange[1], 10);
  }
}
