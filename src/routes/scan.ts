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

export class ScanRoute extends Route {
  method = HttpMethods.POST;
  url = "/scan";
  schema = undefined;
  handler = async (request: any, response: any) => {
    const pluginManager = musicServerInstance.getPluginManager();
    const plugin = pluginManager.getPlugin(
      "music_sources",
      "filesystem-music-source",
    ) as MusicSourcePlugin;
    await plugin.scan();

    response.send({ status: "Scan completed" });
  };
}
