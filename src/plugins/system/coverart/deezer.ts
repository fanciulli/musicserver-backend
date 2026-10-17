/*
 * Created on Wed Sep 24 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import type { Logger as PinoLogger } from "pino";
import type { ArtType } from "../../../types/plugins/albumArt.js";

const DEEZER_API_URL = "https://api.deezer.com";

type DeezerAlbum = { cover_xl?: string; cover_big?: string };
type DeezerArtist = { picture_xl?: string; picture_big?: string };
type DeezerSearchResponse<T> = { data?: Array<T> };

/**
 * Fetches album or artist artwork from Deezer's public API (no API key
 * required). Returns undefined when nothing is found or the request fails.
 */
export async function fetchArtFromDeezer(
  artType: ArtType,
  artistName: string,
  albumName: string | undefined,
  logger?: PinoLogger,
): Promise<Uint8Array | undefined> {
  try {
    const imageUrl =
      artType === "album"
        ? await findAlbumCoverUrl(artistName, albumName)
        : await findArtistPictureUrl(artistName);
    if (!imageUrl) {
      return undefined;
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return undefined;
    }

    return new Uint8Array(await imageResponse.arrayBuffer());
  } catch (ex: any) {
    logger?.warn(`Cannot fetch art from Deezer: ${ex.message}`);
    return undefined;
  }
}

async function findAlbumCoverUrl(
  artistName: string,
  albumName: string | undefined,
): Promise<string | undefined> {
  if (!albumName) {
    return undefined;
  }

  const query = `artist:"${artistName}" album:"${albumName}"`;
  const album = await searchFirst<DeezerAlbum>("search/album", query);
  return album?.cover_xl || album?.cover_big || undefined;
}

async function findArtistPictureUrl(
  artistName: string,
): Promise<string | undefined> {
  const artist = await searchFirst<DeezerArtist>("search/artist", artistName);
  return artist?.picture_xl || artist?.picture_big || undefined;
}

async function searchFirst<T>(
  endpoint: string,
  query: string,
): Promise<T | undefined> {
  const params = new URLSearchParams({ q: query, limit: "1" });
  const response = await fetch(`${DEEZER_API_URL}/${endpoint}?${params}`);
  if (!response.ok) {
    return undefined;
  }

  const body: DeezerSearchResponse<T> = await response.json();
  return body?.data?.[0];
}
