/*
 * Created on Sat Feb 28 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";
import { BrowseResponse } from "../../../types/api/browse.js";
import { SongDbModel } from "../../../types/db/song.js";
import { BrowseUtils } from "../../../utils/browseUtils.js";
import { letters, PLUGIN_ID } from "./constants.js";
import {
  createBrowseReponseFolderForLetters,
  createBrowseResponseFolder,
  createSongBrowseResponse,
  isLetterSection,
  isUuidSection,
} from "./utils.js";

export async function browseSongs(
  db: Db,
  sections: string[],
): Promise<BrowseResponse[]> {
  switch (sections.length) {
    case 1:
      return browseSongsRoot();

    case 2: {
      const scope = sections[1];

      if (scope === "ALL") {
        return browseSongsAll(db);
      }

      if (isLetterSection(scope, letters)) {
        return browseSongsByLetter(db, scope);
      }

      if (isUuidSection(scope)) {
        return browseSongByDirectId(db, scope);
      }

      return [];
    }

    case 3: {
      const scope = sections[1];
      const songId = sections[2];

      if (!isUuidSection(songId)) {
        return [];
      }

      if (scope === "ALL") {
        return browseSongsAllAndSongId(db, songId);
      }

      if (isLetterSection(scope, letters)) {
        return browseSongsByLetterAndSongId(db, scope, songId);
      }

      return [];
    }

    default:
      return [];
  }
}

export async function browseSongsRoot(): Promise<BrowseResponse[]> {
  const songsPath = `${PLUGIN_ID}://songs`;
  const allBrowseResponse = createBrowseResponseFolder("ALL", songsPath, "ALL");
  const lettersResponse = createBrowseReponseFolderForLetters(
    letters,
    songsPath,
  );

  return [allBrowseResponse].concat(lettersResponse);
}

export async function browseSongsAll(db: Db): Promise<BrowseResponse[]> {
  const songs = await SongDbModel.findSongsByPluginId(db, PLUGIN_ID);

  return BrowseUtils.createSongsBrowseResponses(
    `${PLUGIN_ID}://songs/ALL`,
    songs,
  );
}

export async function browseSongsByLetter(
  db: Db,
  letter: string,
): Promise<BrowseResponse[]> {
  const songs = await SongDbModel.findSongsByStartingLetter(
    db,
    PLUGIN_ID,
    letter,
  );

  return BrowseUtils.createSongsBrowseResponses(
    `${PLUGIN_ID}://songs/${letter}`,
    songs,
  );
}

export async function browseSongsAllAndSongId(
  db: Db,
  songId: string,
): Promise<BrowseResponse[]> {
  return browseSongsByScopeAndSongId(db, "ALL", songId);
}

export async function browseSongsByLetterAndSongId(
  db: Db,
  letter: string,
  songId: string,
): Promise<BrowseResponse[]> {
  return browseSongsByScopeAndSongId(db, letter, songId);
}

async function browseSongsByScopeAndSongId(
  db: Db,
  scope: string,
  songId: string,
): Promise<BrowseResponse[]> {
  const song = await SongDbModel.findByIdAndPluginId(db, songId, PLUGIN_ID);
  if (!song) {
    return [];
  }

  return [
    createSongBrowseResponse(`${PLUGIN_ID}://songs/${scope}/${song.id}`, song),
  ];
}

async function browseSongByDirectId(
  db: Db,
  songId: string,
): Promise<BrowseResponse[]> {
  const song = await SongDbModel.findByIdAndPluginId(db, songId, PLUGIN_ID);
  if (!song) {
    return [];
  }

  return [createSongBrowseResponse(`${PLUGIN_ID}://songs/${song.id}`, song)];
}
