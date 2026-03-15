/*
 * Created on Fri Mar 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { musicServerInstance } from "../server/music_server.js";
import { PluginDBModel, PluginStatus } from "../types/db/plugin.js";
import { MusicSourcePlugin } from "../types/plugins/music_sources.js";

export type PluginResolutionError = {
  status: number;
  message: string;
};

export type PluginResolutionResult = {
  pluginId: string;
  plugin?: MusicSourcePlugin;
  error?: PluginResolutionError;
};

export async function getPluginById(
  pluginId: string,
): Promise<PluginResolutionResult> {
  const pluginManager = musicServerInstance.getPluginManager();
  const database = musicServerInstance.getDatabase();
  const plugin = pluginManager.getPlugin(
    "music_sources",
    pluginId,
  ) as MusicSourcePlugin;

  if (plugin === undefined) {
    return {
      pluginId,
      error: {
        status: 404,
        message: `Plugin ${pluginId} not found`,
      },
    };
  }

  const pluginRecord = await PluginDBModel.find(
    database.client,
    plugin.category,
    plugin.id,
  );
  if (pluginRecord?.status !== PluginStatus.STARTED) {
    return {
      pluginId,
      error: {
        status: 409,
        message: `Plugin ${pluginId} is not started`,
      },
    };
  }

  return {
    pluginId,
    plugin,
  };
}
