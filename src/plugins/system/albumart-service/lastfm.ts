/*
 * Created on Sun Sep 20 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import type { Logger as PinoLogger } from "pino";
import type { ArtType } from "../../../types/plugins/albumArt.js";

const LASTFM_API_URL = "https://ws.audioscrobbler.com/2.0/";
const IMAGE_SIZE_PREFERENCE = ["mega", "extralarge", "large", "medium", "small"];

type LastFmImage = { "#text": string; size: string };

export async function fetchArtFromLastFm(
  apiKey: string,
  artType: ArtType,
  artistName: string,
  albumName: string,
  logger?: PinoLogger,
): Promise<Uint8Array | undefined> {
  if (!apiKey) {
    return undefined;
  }

  try {
    const imageUrl = await findImageUrl(
      apiKey,
      artType,
      artistName,
      albumName,
    );
    if (!imageUrl) {
      return undefined;
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return undefined;
    }

    return new Uint8Array(await imageResponse.arrayBuffer());
  } catch (ex: any) {
    logger?.warn(`Cannot fetch art from Last.fm: ${ex.message}`);
    return undefined;
  }
}

async function findImageUrl(
  apiKey: string,
  artType: ArtType,
  artistName: string,
  albumName: string,
): Promise<string | undefined> {
  const method = artType === "album" ? "album.getinfo" : "artist.getinfo";
  const params = new URLSearchParams({
    method,
    api_key: apiKey,
    artist: artistName,
    format: "json",
  });
  if (artType === "album") {
    params.set("album", albumName);
  }

  const response = await fetch(`${LASTFM_API_URL}?${params.toString()}`);
  if (!response.ok) {
    return undefined;
  }

  const body: any = await response.json();
  const images: Array<LastFmImage> | undefined =
    body?.album?.image ?? body?.artist?.image;

  return pickBestImageUrl(images);
}

function pickBestImageUrl(
  images: Array<LastFmImage> | undefined,
): string | undefined {
  if (!images) {
    return undefined;
  }

  for (const size of IMAGE_SIZE_PREFERENCE) {
    const image = images.find(
      (item) => item.size === size && item["#text"],
    );
    if (image) {
      return image["#text"];
    }
  }

  return undefined;
}
