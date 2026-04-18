/*
 * Created on Sat Apr 18 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";
import type {
  PluginConfigurationSettings,
  PluginConfigurationValues,
} from "../../../types/plugins/plugin.js";
import { PluginConfigDBModel } from "../../../types/db/pluginConfig.js";

const MUSIC_FOLDER_KEY = "musicFolder";

export async function loadConfiguration(
  database: Db,
  category: string,
  pluginId: string,
  defaultMusicFolder: string,
): Promise<string> {
  const pluginConfig: PluginConfigDBModel =
    await PluginConfigDBModel.findByPluginId(database, category, pluginId);

  if (!pluginConfig) {
    return defaultMusicFolder;
  }

  const musicFolder = pluginConfig.settings[MUSIC_FOLDER_KEY];
  validateMusicFolder(musicFolder);

  return musicFolder;
}

export function getConfiguration(
  musicFolder: string,
): PluginConfigurationSettings {
  return {
    variables: [{ [MUSIC_FOLDER_KEY]: "string" }],
    values: {
      [MUSIC_FOLDER_KEY]: musicFolder,
    },
  };
}

export async function updateConfiguration(
  database: Db,
  category: string,
  pluginId: string,
  settings: PluginConfigurationValues,
): Promise<string> {
  const musicFolder = settings[MUSIC_FOLDER_KEY];
  validateMusicFolder(musicFolder);

  await PluginConfigDBModel.upsertSettings(database, category, pluginId, {
    [MUSIC_FOLDER_KEY]: musicFolder,
  });

  return musicFolder;
}

function validateMusicFolder(
  musicFolder: unknown,
): asserts musicFolder is string {
  if (typeof musicFolder !== "string" || musicFolder.trim() === "") {
    throw new Error("musicFolder must be a non-empty string");
  }
}
