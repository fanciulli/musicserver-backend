/*
 * Created on Sat Feb 28 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Folder } from "../../../types/api/folder.js";
import { BrowseType, BrowseResponse } from "../../../types/api/browse.js";
import { Song } from "../../../types/api/song.js";
import { SongDbModel } from "../../../types/db/song.js";
import type { ArtistDbModel } from "../../../types/db/artist.js";

/**
 * Creates a folder browse response by composing a child path from prefix and section.
 *
 * @param label Folder label shown to the client.
 * @param pathPrefix Base browse path.
 * @param pathSection Path segment appended to the prefix.
 * @returns A folder browse response.
 */
export function createBrowseResponseFolder(
  label: string,
  pathPrefix: string,
  pathSection: string,
): BrowseResponse {
  const folder = new Folder();
  folder.name = label;

  return new BrowseResponse(
    `${pathPrefix}/${pathSection}`,
    BrowseType.FOLDER,
    folder,
  );
}

/**
 * Creates one folder browse response for each provided letter.
 *
 * @param letters Collection of letters to expose as folder items.
 * @param prefix Base browse path used for each generated item.
 * @returns Folder browse responses for all letters.
 */
export function createBrowseReponseFolderForLetters(
  letters: string[],
  prefix: string,
): BrowseResponse[] {
  const resp = [];
  for (let letter of letters) {
    resp.push(createBrowseResponseFolder(letter, prefix, letter));
  }

  return resp;
}

/**
 * Returns true when the path section matches one of the configured letters.
 *
 * @param pathSection Path segment to validate.
 * @param letters Collection of valid letters.
 * @returns True if the section is a valid letter.
 */
export function isLetterSection(
  pathSection: string,
  letters: string[],
): boolean {
  return letters.includes(pathSection.toUpperCase());
}

/**
 * Returns true when the path section is a valid UUID.
 *
 * @param pathSection Path segment to validate.
 * @returns True if the section is a UUID.
 */
export function isUuidSection(pathSection: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    pathSection,
  );
}

export function createSongBrowseResponse(
  path: string,
  song: SongDbModel,
): BrowseResponse {
  const data = Song.fromDbModel(song);

  return new BrowseResponse(path, BrowseType.SONG, data);
}

export function createSongBrowseResponses(
  pathPrefix: string,
  songs: SongDbModel[],
): BrowseResponse[] {
  return songs.map((song) =>
    createSongBrowseResponse(`${pathPrefix}/${song.id}`, song),
  );
}

/**
 * Scores how closely a name matches title case (each word starting with an
 * upper case letter followed by lower case letters).
 *
 * @param name Name to score.
 * @returns Fraction of words in title case, in the range [0, 1].
 */
function titleCaseScore(name: string): number {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return 0;
  }

  let titleCasedWords = 0;
  for (const word of words) {
    const first = word.charAt(0);
    const rest = word.slice(1);
    const startsUpperCase =
      first === first.toUpperCase() && first !== first.toLowerCase();
    if (startsUpperCase && rest === rest.toLowerCase()) {
      titleCasedWords += 1;
    }
  }

  return titleCasedWords / words.length;
}

/**
 * Picks the preferred artist name between two case-insensitive variants.
 *
 * The variant closest to title case wins (e.g. "Artist Name" beats
 * "ARTIST NAME"). Ties keep the current name to avoid needless writes.
 *
 * @param current Name currently stored.
 * @param candidate Incoming name to compare against.
 * @returns The preferred name.
 */
export function pickBestArtistName(current: string, candidate: string): string {
  return titleCaseScore(candidate) > titleCaseScore(current)
    ? candidate
    : current;
}

export function linkArtists(
  artists: ArtistDbModel[] | string[] | undefined,
): string {
  if (!artists || artists.length === 0) {
    return "";
  }

  let artistsArray: string[] = [];

  if (typeof artists[0] === "string") {
    artistsArray = artists as string[];
  } else {
    artistsArray = (artists as ArtistDbModel[])
      .map((artist) => artist.name)
      .filter((name) => name !== undefined);
  }

  return Array.from(new Set(artistsArray)).join(", ");
}
