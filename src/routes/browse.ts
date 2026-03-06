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
import {
  MUSIC_SOURCE_PLUGIN_CATEGORY,
  MusicSourcePlugin,
} from "../types/plugins/music_sources.js";
import {
  BrowseResponse,
  BrowseSchema,
  BrowseType,
} from "../types/api/browse.js";
import { Plugin } from "../types/plugins/plugin.js";
import { Folder } from "../types/api/folder.js";
import { PluginDBModel, PluginStatus } from "../types/db/plugin.js";
import { extractPluginId } from "../utils/pathUtils.js";

export class BrowseRoute extends Route {
  method = HttpMethods.POST;
  url = "/browse";
  schema = BrowseSchema;
  handler = async (request: any, response: any) => {
    const pluginManager = musicServerInstance.getPluginManager();

    const path = request.body.path;
    if (path === "/" || path === "") {
      const root = await this.browserRoot();
      response.send(root);
    } else {
      await this.browsePathInPlugin(request, response);
    }
  };

  browserRoot = async () => {
    const pluginManager = musicServerInstance.getPluginManager();
    const database = musicServerInstance.getDatabase();
    const plugins: Array<Plugin> = pluginManager.getPluginsInCategory(
      MUSIC_SOURCE_PLUGIN_CATEGORY,
    );

    const resp = [];
    for (let plugin of plugins) {
      const pluginRecord = await PluginDBModel.find(
        database.client,
        plugin.category,
        plugin.id,
      );
      if (pluginRecord?.status !== PluginStatus.STARTED) {
        continue;
      }

      const pluginFolder = new Folder();
      pluginFolder.name = plugin.name;

      resp.push(
        new BrowseResponse(`${plugin.id}://`, BrowseType.FOLDER, pluginFolder),
      );
    }
    return resp;
  };

  browsePathInPlugin = async (request: any, response: any) => {
    const pluginManager = musicServerInstance.getPluginManager();
    const database = musicServerInstance.getDatabase();

    const path = request.body.path;
    const pluginId = extractPluginId(path);
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

    const songs = await plugin.browse(path);

    response.send(songs);
  };
}
