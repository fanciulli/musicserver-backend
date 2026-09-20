/*
 * Created on Sun Sep 20 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { AlbumArtPlugin, type ArtType } from "../../../types/plugins/albumArt.js";
import { fileExists } from "../../../utils/fsUtils.js";
import type { Context } from "../../../types/context.js";
import type {
  PluginConfigurationSettings,
  PluginConfigurationValues,
} from "../../../types/plugins/plugin.js";
import { PLUGIN_ID, PLUGIN_NAME, DEFAULT_ROOT_FOLDER, DEFAULT_LASTFM_API_KEY } from "./constants.js";
import {
  getConfiguration,
  loadConfiguration,
  updateConfiguration,
  type AlbumArtConfiguration,
} from "./configuration.js";
import { buildArtPath } from "./artPath.js";
import { fetchArtFromLastFm } from "./lastfm.js";

export default class AlbumArtServicePlugin extends AlbumArtPlugin {
  id: string = PLUGIN_ID;
  name: string = PLUGIN_NAME;
  #configuration: AlbumArtConfiguration;

  constructor(context: Context) {
    super(context);
    this.#configuration = {
      rootFolder: DEFAULT_ROOT_FOLDER,
      lastFmApiKey: DEFAULT_LASTFM_API_KEY,
    };
  }

  loadConfiguration = async (): Promise<void> => {
    this.#configuration = await loadConfiguration(
      this.getDatabase(),
      this.category,
      this.id,
    );
  };

  getConfiguration = async (): Promise<PluginConfigurationSettings> => {
    return getConfiguration(this.#configuration);
  };

  updateConfiguration = async (
    settings: PluginConfigurationValues,
  ): Promise<void> => {
    this.#configuration = await updateConfiguration(
      this.getDatabase(),
      this.category,
      this.id,
      settings,
    );
  };

  async getArt(
    uuid: string,
    artType: ArtType,
    artistName?: string,
    albumName?: string,
  ): Promise<Uint8Array | undefined> {
    const artPath = buildArtPath(this.#configuration.rootFolder, uuid);

    if (await fileExists(artPath)) {
      return await readFile(artPath);
    }

    if (!artistName || !albumName) {
      return undefined;
    }

    const art = await fetchArtFromLastFm(
      this.#configuration.lastFmApiKey,
      artType,
      artistName,
      albumName,
      this.context.logger,
    );

    if (!art) {
      return undefined;
    }

    await mkdir(path.dirname(artPath), { recursive: true });
    await writeFile(artPath, art);

    return art;
  }
}
