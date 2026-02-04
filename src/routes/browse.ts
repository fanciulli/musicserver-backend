/*
 * Created on Wed Jan 28 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../types/route";
import { HttpMethods } from "../misc/constants";
import { musicServerInstance } from "../music_server";
import { MusicSourcePlugin } from "../types/plugins/music_sources";
import { BrowseSchema } from "../types/api/browse";

export class BrowseRoute extends Route {
  method = HttpMethods.POST;
  url = "/browse";
  schema = BrowseSchema;
  handler = async (request: any, response: any) => {
    const pluginManager = musicServerInstance.getPluginManager();
    const plugin = pluginManager.getPlugin(
      "music_sources",
      "filesystem-music-source",
    ) as MusicSourcePlugin;
    const songs = await plugin.browse();

    response.send(songs);
  };
}
