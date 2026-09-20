/*
 * Created on Sun Sep 20 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Plugin } from "./plugin.js";

export const SYSTEM_PLUGIN_CATEGORY = "system";

export type ArtType = "album" | "artist";

export abstract class AlbumArtPlugin extends Plugin {
  category: string = SYSTEM_PLUGIN_CATEGORY;

  abstract getArt(
    uuid: string,
    artType: ArtType,
    artistName?: string,
    albumName?: string,
  ): Promise<Uint8Array | undefined>;
}
