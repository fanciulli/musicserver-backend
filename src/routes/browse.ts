/*
 * Created on Wed Jan 28 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../types/route.js";
import { HttpMethods } from "../misc/constants.js";
import { musicServerInstance } from "../server/music_server.js";
import { MusicSourcePlugin } from "../types/plugins/music_sources.js";
import { BrowseSchema } from "../types/api/browse.js";
import { Plugin } from "../types/plugins/plugin.js";

export class BrowseRoute extends Route {
  method = HttpMethods.POST;
  url = "/browse";
  schema = BrowseSchema;
  handler = async (request: any, response: any) => {
    const pluginManager = musicServerInstance.getPluginManager();

    const path = request.body.path;
    if (path === "/") {
      await this.browserRoot(request, response);
    } else {
      await this.browsePathInPlugin(request, response);
    }
  };

  browserRoot = async (request: any, response: any) => {
    const pluginManager = musicServerInstance.getPluginManager();
    const plugins: Array<Plugin> =
      pluginManager.getPluginsInCategory("music_sources");

    const resp = [];
    for (let plugin of plugins) {
      resp.push({
        name: plugin.name,
        id: `${plugin.id}://`,
      });
    }
    response.send(resp);
  };

  browsePathInPlugin = async (request: any, response: any) => {
    const pluginManager = musicServerInstance.getPluginManager();

    const path = request.body.path;
    const pluginId = path.substring(0, path.indexOf(":"));
    const plugin = pluginManager.getPlugin(
      "music_sources",
      pluginId,
    ) as MusicSourcePlugin;
    const songs = await plugin.browse(path);

    response.send(songs);
  };
}
