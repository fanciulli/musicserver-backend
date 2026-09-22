/*
 * Created on Mon Sep 22 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { PluginDBModel, PluginStatus } from "../types/db/plugin.js";
import { AlbumArtPlugin } from "../types/plugins/albumArt.js";
import { PLUGIN_ID as ALBUM_ART_PLUGIN_ID } from "../plugins/system/albumart-service/constants.js";
import type { Context } from "../types/context.js";

/**
 * Resolves the album art service plugin, but only when it is present and
 * currently started. Returns undefined otherwise, so callers can fall back to
 * their own default artwork.
 */
export async function getStartedAlbumArtPlugin(
  context: Context,
): Promise<AlbumArtPlugin | undefined> {
  const plugin = context.pluginManager?.getPluginById(ALBUM_ART_PLUGIN_ID);
  if (!(plugin instanceof AlbumArtPlugin)) {
    return undefined;
  }

  const record = await PluginDBModel.find(
    context.database,
    plugin.category,
    plugin.id,
  );
  if (record?.status !== PluginStatus.STARTED) {
    return undefined;
  }

  return plugin;
}
