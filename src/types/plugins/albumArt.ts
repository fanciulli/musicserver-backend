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

export type StoreArtByData = { uuid: string; art: Uint8Array };
export type StoreArtByAlbumLookup = {
  uuid: string;
  artistName: string;
  albumName: string;
};
export type StoreArtByArtistLookup = { uuid: string; artistName: string };
export type StoreArtParams =
  | StoreArtByData
  | StoreArtByAlbumLookup
  | StoreArtByArtistLookup;

export abstract class AlbumArtPlugin extends Plugin {
  category: string = SYSTEM_PLUGIN_CATEGORY;

  abstract getArt(
    uuid: string,
    artType: ArtType,
    artistName?: string,
    albumName?: string,
  ): Promise<Uint8Array | undefined>;

  abstract storeArt(params: StoreArtParams): Promise<void>;

  abstract hasArt(uuid: string): Promise<boolean>;
}
