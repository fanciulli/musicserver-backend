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
import { DEFAULT_MUSIC_FOLDER } from "./constants.js";

const MUSIC_FOLDER_KEY = "musicFolder";
const MERGE_ARTISTS_KEY = "smartMergeArtists";
const DEFAULT_MERGE_ARTISTS = true;

export interface FilesystemConfiguration {
  musicFolder: string;
  smartMergeArtists: boolean;
}

export async function loadConfiguration(
  database: Db,
  category: string,
  pluginId: string,
): Promise<FilesystemConfiguration> {
  const pluginConfig: PluginConfigDBModel | undefined =
    await PluginConfigDBModel.findByPluginId(database, category, pluginId);

  if (!pluginConfig) {
    return {
      musicFolder: DEFAULT_MUSIC_FOLDER,
      smartMergeArtists: DEFAULT_MERGE_ARTISTS,
    };
  }

  const musicFolder = pluginConfig.settings[MUSIC_FOLDER_KEY];
  validateMusicFolder(musicFolder);

  return {
    musicFolder,
    smartMergeArtists: resolveMergeArtists(
      pluginConfig.settings[MERGE_ARTISTS_KEY],
    ),
  };
}

export function getConfiguration(
  config: FilesystemConfiguration,
): PluginConfigurationSettings {
  return {
    variables: [
      { [MUSIC_FOLDER_KEY]: "string" },
      { [MERGE_ARTISTS_KEY]: "boolean" },
    ],
    labels: {
      [MUSIC_FOLDER_KEY]: "Music Folder",
      [MERGE_ARTISTS_KEY]: "Smart Merge Artists",
    },
    values: {
      [MUSIC_FOLDER_KEY]: config.musicFolder,
      [MERGE_ARTISTS_KEY]: config.smartMergeArtists,
    },
  };
}

export async function updateConfiguration(
  database: Db,
  category: string,
  pluginId: string,
  settings: PluginConfigurationValues,
): Promise<FilesystemConfiguration> {
  const musicFolder = settings[MUSIC_FOLDER_KEY];
  validateMusicFolder(musicFolder);

  const smartMergeArtists = resolveMergeArtists(
    settings[MERGE_ARTISTS_KEY],
  );

  await PluginConfigDBModel.upsertSettings(database, category, pluginId, {
    [MUSIC_FOLDER_KEY]: musicFolder,
    [MERGE_ARTISTS_KEY]: smartMergeArtists,
  });

  return { musicFolder, smartMergeArtists };
}

function validateMusicFolder(
  musicFolder: unknown,
): asserts musicFolder is string {
  if (typeof musicFolder !== "string" || musicFolder.trim() === "") {
    throw new Error("musicFolder must be a non-empty string");
  }
}

function resolveMergeArtists(value: unknown): boolean {
  if (value === undefined) {
    return DEFAULT_MERGE_ARTISTS;
  }

  if (typeof value !== "boolean") {
    throw new Error("smartMergeArtists must be a boolean");
  }

  return value;
}
