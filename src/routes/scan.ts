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
import { PluginDBModel, PluginStatus } from "../types/db/plugin.js";

export class ScanRoute extends Route {
  method = HttpMethods.POST;
  url = "/scan";
  schema = undefined;
  handler = async (request: any, response: any) => {
    const pluginManager = musicServerInstance.getPluginManager();
    const database = musicServerInstance.getDatabase();
    const pluginId = request.body.id;
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

    await plugin.scan();

    response.send({ status: "Scan completed" });
  };
}
