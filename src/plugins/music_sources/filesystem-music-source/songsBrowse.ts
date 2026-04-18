/*
 * Created on Sat Feb 28 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";
import { BrowseResponse, BrowseType } from "../../../types/api/browse.js";
import { Song } from "../../../types/api/song.js";
import { SongDbModel } from "../../../types/db/song.js";
import { BrowseUtils } from "../../../utils/browseUtils.js";
import { letters } from "../../../misc/constants.js";
import { musicServerInstance } from "../../../server/musicServer.js";
import { PLUGIN_ID } from "./constants.js";
import {
  createBrowseReponseFolderForLetters,
  createBrowseResponseFolder,
  isLetterSection,
  isUuidSection,
} from "./utils.js";

export async function browseSongs(
  sections: string[],
): Promise<BrowseResponse[]> {
  switch (sections.length) {
    case 1:
      return browseSongsRoot();

    case 2: {
      const scope = sections[1];

      if (scope === "ALL") {
        return browseSongsAll();
      }

      if (isLetterSection(scope, letters)) {
        return browseSongsByLetter(scope);
      }

      if (isUuidSection(scope)) {
        return browseSongByDirectId(scope);
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
        return browseSongsAllAndSongId(songId);
      }

      if (isLetterSection(scope, letters)) {
        return browseSongsByLetterAndSongId(scope, songId);
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

export async function browseSongsAll(): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const songs = await SongDbModel.findSongsByPluginId(database, PLUGIN_ID);

  return BrowseUtils.createSongsBrowseResponses(
    `${PLUGIN_ID}://songs/ALL`,
    songs,
  );
}

export async function browseSongsByLetter(
  letter: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const songs = await SongDbModel.findSongsByStartingLetter(
    database,
    PLUGIN_ID,
    letter,
  );

  return BrowseUtils.createSongsBrowseResponses(
    `${PLUGIN_ID}://songs/${letter}`,
    songs,
  );
}

export async function browseSongsAllAndSongId(
  songId: string,
): Promise<BrowseResponse[]> {
  return browseSongsByScopeAndSongId("ALL", songId);
}

export async function browseSongsByLetterAndSongId(
  letter: string,
  songId: string,
): Promise<BrowseResponse[]> {
  return browseSongsByScopeAndSongId(letter, songId);
}

async function browseSongsByScopeAndSongId(
  scope: string,
  songId: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const song = await SongDbModel.findByIdAndPluginId(
    database,
    songId,
    PLUGIN_ID,
  );
  if (!song) {
    return [];
  }

  const data = Song.fromDbModel(song);
  data.id = `${song.pluginId}://${song.albumId}/${song.id}`;

  return [
    new BrowseResponse(
      `${PLUGIN_ID}://songs/${scope}/${song.id}`,
      BrowseType.SONG,
      data,
    ),
  ];
}

async function browseSongByDirectId(songId: string): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const song = await SongDbModel.findByIdAndPluginId(
    database,
    songId,
    PLUGIN_ID,
  );
  if (!song) {
    return [];
  }

  const data = Song.fromDbModel(song);
  data.id = `${song.pluginId}://${song.albumId}/${song.id}`;

  return [
    new BrowseResponse(
      `${PLUGIN_ID}://songs/${song.id}`,
      BrowseType.SONG,
      data,
    ),
  ];
}
