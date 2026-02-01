/*
 * Created on Sun Feb 01 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../types/route";
import { HttpMethods } from "../misc/constants";
import { musicServerInstance } from "../music_server";
import { MusicSourcePlugin } from "../types/plugins/music_sources";

export class StreamRoute extends Route {
  method = HttpMethods.GET;
  url = "/stream";
  schema = undefined;
  handler = async (request: any, response: any) => {
    const pluginManager = musicServerInstance.getPluginManager();
    const plugin = pluginManager.getPlugin('music_sources', 'filesystem-music-source') as MusicSourcePlugin;
    const stream = await plugin.stream('7');

    await response.header('Content-Type', 'application/octet-stream').send(stream);
  };
}