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
import { DEFAULT_ROOT_FOLDER } from "./constants.js";
import { folderExists } from "../../../utils/fsUtils.js";

const ROOT_FOLDER_KEY = "rootFolder";

const LABEL_ROOT_FOLDER = "Root folder";

export interface AlbumArtConfiguration {
  rootFolder: string;
}

export async function loadConfiguration(
  database: Db,
  category: string,
  pluginId: string,
): Promise<AlbumArtConfiguration> {
  const pluginConfig: PluginConfigDBModel | undefined =
    await PluginConfigDBModel.findByPluginId(database, category, pluginId);

  if (!pluginConfig) {
    return { rootFolder: DEFAULT_ROOT_FOLDER };
  }

  const rootFolder = loadRootFolder(pluginConfig);

  await validateRootFolder(rootFolder);

  return { rootFolder };
}

export function getConfiguration(
  config: AlbumArtConfiguration,
): PluginConfigurationSettings {
  return {
    variables: [{ [ROOT_FOLDER_KEY]: "string" }],
    labels: {
      [ROOT_FOLDER_KEY]: LABEL_ROOT_FOLDER,
    },
    values: {
      [ROOT_FOLDER_KEY]: config.rootFolder,
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

  await PluginConfigDBModel.upsertSettings(database, category, pluginId, {
    [ROOT_FOLDER_KEY]: rootFolder,
  });

  return { rootFolder };
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

function loadRootFolder(pluginConfig: PluginConfigDBModel): string {
  const rootFolder = pluginConfig.settings[ROOT_FOLDER_KEY];
  return rootFolder !== undefined
    ? (rootFolder as string)
    : DEFAULT_ROOT_FOLDER;
}
