/*
 * Created on Fri Mar 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { PluginDBModel, PluginStatus } from "../types/db/plugin.js";
import type { Context } from "../types/context.js";
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
  context: Context,
): Promise<PluginResolutionResult> {
  const plugin = context.pluginManager.getPlugin(
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
    context.database,
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
