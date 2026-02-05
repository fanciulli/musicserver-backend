/*
 * Created on Sun Feb 01 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../types/route";
import { HttpMethods } from "../misc/constants";
import { musicServerInstance } from "../server/music_server";
import { MusicSourcePlugin } from "../types/plugins/music_sources";
import { StreamSchema } from "../types/api/stream";

export class StreamRoute extends Route {
  method = HttpMethods.GET;
  url = "/stream/:id";
  schema = StreamSchema;
  handler = async (request: any, response: any) => {
    const pluginManager = musicServerInstance.getPluginManager();
    const plugin = pluginManager.getPlugin(
      "music_sources",
      "filesystem-music-source",
    ) as MusicSourcePlugin;

    try {
      const stream = await plugin.stream(request.params.id);
      return stream;
    } catch (error) {
      response.status(404).send({ error: "Song not found" });
    }
  };
}
