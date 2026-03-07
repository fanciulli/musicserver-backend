/*
 * Created on Sun Feb 01 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../types/route.js";
import { HttpMethods } from "../misc/constants.js";
import { musicServerInstance } from "../server/music_server.js";
import { MusicSourcePlugin } from "../types/plugins/music_sources.js";
import { StreamSchema } from "../types/api/stream.js";
import { PluginDBModel, PluginStatus } from "../types/db/plugin.js";
import { extractPluginId } from "../utils/pathUtils.js";

export class StreamRoute extends Route {
  method = HttpMethods.GET;
  url = "/stream";
  schema = StreamSchema;
  handler = async (request: any, response: any) => {
    const pluginManager = musicServerInstance.getPluginManager();
    const database = musicServerInstance.getDatabase();
    const streamId = request.query.id;
    const pluginId = extractPluginId(streamId);
    const plugin = pluginManager.getPlugin(
      "music_sources",
      pluginId,
    ) as MusicSourcePlugin;

    if (plugin === undefined) {
      response.status(404).send({ error: `Plugin ${pluginId} not found` });
      return;
    }

    const pluginRecord = await PluginDBModel.find(
      database.client,
      plugin.category,
      plugin.id,
    );
    if (pluginRecord?.status !== PluginStatus.STARTED) {
      response.status(409).send({ error: `Plugin ${pluginId} is not started` });
      return;
    }

    try {
      const stream = await plugin.stream(streamId);
      return stream;
    } catch (error) {
      response.status(404).send({ error: "Song not found" });
    }
  };
}
