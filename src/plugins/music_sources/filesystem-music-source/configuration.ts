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
import {
  DEFAULT_ALBUM_COVER_FILENAMES,
  DEFAULT_MERGE_ARTISTS,
  DEFAULT_MUSIC_FOLDER,
} from "./constants.js";

const MUSIC_FOLDER_KEY = "musicFolder";
const MERGE_ARTISTS_KEY = "smartMergeArtists";
const ALBUM_COVER_FILENAMES_KEY = "albumCoverFileNames";

const LABEL_MUSIC_FOLDER = "Music folder";
const LABEL_MERGE_ARTISTS = "Smart merge artists";
const LABEL_ALBUM_COVER_FILENAMES = "Album covers file names";

const coverFileNamesRegex = /^$|^[\w.-]+\.\w+(,[\w.-]+\.\w+)*$/;

export interface FilesystemConfiguration {
  musicFolder: string;
  smartMergeArtists: boolean;
  albumCoverFileNames: string;
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
      albumCoverFileNames: DEFAULT_ALBUM_COVER_FILENAMES,
    };
  }

  const smartMergeArtists = loadSmartMergeArtists(pluginConfig);
  const musicFolder = loadMusicFolder(pluginConfig);
  const albumCoverFileNames = loadAlbumCoversFileNames(pluginConfig);

  validateMusicFolder(musicFolder);

  return {
    musicFolder,
    smartMergeArtists,
    albumCoverFileNames,
  };
}

export function getConfiguration(
  config: FilesystemConfiguration,
): PluginConfigurationSettings {
  return {
    variables: [
      { [MUSIC_FOLDER_KEY]: "string" },
      { [MERGE_ARTISTS_KEY]: "boolean" },
      { [ALBUM_COVER_FILENAMES_KEY]: "string" },
    ],
    labels: {
      [MUSIC_FOLDER_KEY]: LABEL_MUSIC_FOLDER,
      [MERGE_ARTISTS_KEY]: LABEL_MERGE_ARTISTS,
      [ALBUM_COVER_FILENAMES_KEY]: LABEL_ALBUM_COVER_FILENAMES,
    },
    values: {
      [MUSIC_FOLDER_KEY]: config.musicFolder,
      [MERGE_ARTISTS_KEY]: config.smartMergeArtists,
      [ALBUM_COVER_FILENAMES_KEY]: config.albumCoverFileNames,
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

  const smartMergeArtists = settings[MERGE_ARTISTS_KEY];
  validateSmartMergeArtists(smartMergeArtists);

  const albumCoverFileNames = settings[ALBUM_COVER_FILENAMES_KEY];
  validateAlbumCoverFilenames(albumCoverFileNames);

  await PluginConfigDBModel.upsertSettings(database, category, pluginId, {
    [MUSIC_FOLDER_KEY]: musicFolder,
    [MERGE_ARTISTS_KEY]: smartMergeArtists,
    [ALBUM_COVER_FILENAMES_KEY]: albumCoverFileNames,
  });

  return { musicFolder, smartMergeArtists, albumCoverFileNames };
}

function validateMusicFolder(
  musicFolder: unknown,
): asserts musicFolder is string {
  if (typeof musicFolder !== "string" || musicFolder.trim() === "") {
    throw new Error(`${LABEL_MUSIC_FOLDER} must be a non-empty string`);
  }
}

function validateSmartMergeArtists(
  smartMergeArtists: unknown,
): asserts smartMergeArtists is boolean {
  if (typeof smartMergeArtists !== "boolean") {
    throw new Error(`${LABEL_MERGE_ARTISTS} must be a boolean`);
  }
}

function validateAlbumCoverFilenames(
  albumCoverFileNames: unknown,
): asserts albumCoverFileNames is string {
  if (typeof albumCoverFileNames !== "string") {
    throw new Error(`${LABEL_ALBUM_COVER_FILENAMES} must be a string`);
  }

  if (!coverFileNamesRegex.test(albumCoverFileNames)) {
    throw new Error(
      `${LABEL_ALBUM_COVER_FILENAMES} must be a comma separated list of file names`,
    );
  }
}

function loadAlbumCoversFileNames(pluginConfig: PluginConfigDBModel): string {
  const fileNames = pluginConfig.settings[ALBUM_COVER_FILENAMES_KEY];
  return fileNames !== undefined
    ? (fileNames as string)
    : DEFAULT_ALBUM_COVER_FILENAMES;
}

function loadMusicFolder(pluginConfig: PluginConfigDBModel): string {
  const folder = pluginConfig.settings[MUSIC_FOLDER_KEY];
  return folder !== undefined ? (folder as string) : DEFAULT_MUSIC_FOLDER;
}

function loadSmartMergeArtists(pluginConfig: PluginConfigDBModel): boolean {
  const mergeArtists = pluginConfig.settings[MERGE_ARTISTS_KEY];
  return mergeArtists !== undefined
    ? (mergeArtists as boolean)
    : DEFAULT_MERGE_ARTISTS;
}
