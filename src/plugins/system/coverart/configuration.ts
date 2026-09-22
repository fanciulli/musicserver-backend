/*
 * Created on Sun Sep 20 2026
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
import { DEFAULT_LASTFM_API_KEY, DEFAULT_ROOT_FOLDER } from "./constants.js";
import { folderExists } from "../../../utils/fsUtils.js";

const ROOT_FOLDER_KEY = "rootFolder";
const LASTFM_API_KEY_KEY = "lastFmApiKey";

const LABEL_ROOT_FOLDER = "Root folder";
const LABEL_LASTFM_API_KEY = "Last.fm API Key";

export interface AlbumArtConfiguration {
  rootFolder: string;
  lastFmApiKey: string;
}

export async function loadConfiguration(
  database: Db,
  category: string,
  pluginId: string,
): Promise<AlbumArtConfiguration> {
  const pluginConfig: PluginConfigDBModel | undefined =
    await PluginConfigDBModel.findByPluginId(database, category, pluginId);

  if (!pluginConfig) {
    return {
      rootFolder: DEFAULT_ROOT_FOLDER,
      lastFmApiKey: DEFAULT_LASTFM_API_KEY,
    };
  }

  const rootFolder = loadRootFolder(pluginConfig);
  const lastFmApiKey = loadLastFmApiKey(pluginConfig);

  await validateRootFolder(rootFolder);

  return { rootFolder, lastFmApiKey };
}

export function getConfiguration(
  config: AlbumArtConfiguration,
): PluginConfigurationSettings {
  return {
    variables: [
      { [ROOT_FOLDER_KEY]: "string" },
      { [LASTFM_API_KEY_KEY]: "string" },
    ],
    labels: {
      [ROOT_FOLDER_KEY]: LABEL_ROOT_FOLDER,
      [LASTFM_API_KEY_KEY]: LABEL_LASTFM_API_KEY,
    },
    values: {
      [ROOT_FOLDER_KEY]: config.rootFolder,
      [LASTFM_API_KEY_KEY]: config.lastFmApiKey,
    },
  };
}

export async function updateConfiguration(
  database: Db,
  category: string,
  pluginId: string,
  settings: PluginConfigurationValues,
): Promise<AlbumArtConfiguration> {
  const rootFolder = await validateRootFolder(settings[ROOT_FOLDER_KEY]);

  const lastFmApiKey = settings[LASTFM_API_KEY_KEY];
  validateLastFmApiKey(lastFmApiKey);

  await PluginConfigDBModel.upsertSettings(database, category, pluginId, {
    [ROOT_FOLDER_KEY]: rootFolder,
    [LASTFM_API_KEY_KEY]: lastFmApiKey,
  });

  return { rootFolder, lastFmApiKey };
}

async function validateRootFolder(rootFolder: unknown): Promise<string> {
  if (typeof rootFolder !== "string" || rootFolder.trim() === "") {
    throw new Error(`${LABEL_ROOT_FOLDER} must be a non-empty string`);
  }

  if (!(await folderExists(rootFolder))) {
    throw new Error(
      `${LABEL_ROOT_FOLDER} "${rootFolder}" does not exist or is not a folder`,
    );
  }

  return rootFolder;
}

function validateLastFmApiKey(
  lastFmApiKey: unknown,
): asserts lastFmApiKey is string {
  if (typeof lastFmApiKey !== "string") {
    throw new Error(`${LABEL_LASTFM_API_KEY} must be a string`);
  }
}

function loadRootFolder(pluginConfig: PluginConfigDBModel): string {
  const rootFolder = pluginConfig.settings[ROOT_FOLDER_KEY];
  return rootFolder !== undefined
    ? (rootFolder as string)
    : DEFAULT_ROOT_FOLDER;
}

function loadLastFmApiKey(pluginConfig: PluginConfigDBModel): string {
  const lastFmApiKey = pluginConfig.settings[LASTFM_API_KEY_KEY];
  return lastFmApiKey !== undefined
    ? (lastFmApiKey as string)
    : DEFAULT_LASTFM_API_KEY;
}
