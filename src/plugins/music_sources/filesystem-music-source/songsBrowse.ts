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
import { musicServerInstance } from "../../../server/music_server.js";
import {
  createBrowseReponseFolderForLetters,
  createBrowseResponseFolder,
  isLetterSection,
  isUuidSection,
} from "./utils.js";

export async function browseSongs(
  pluginId: string,
  sections: string[],
): Promise<BrowseResponse[]> {
  switch (sections.length) {
    case 1:
      return browseSongsRoot(pluginId);

    case 2: {
      const scope = sections[1];

      if (scope === "ALL") {
        return browseSongsAll(pluginId);
      }

      if (isLetterSection(scope, letters)) {
        return browseSongsByLetter(pluginId, scope);
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
        return browseSongsAllAndSongId(pluginId, songId);
      }

      if (isLetterSection(scope, letters)) {
        return browseSongsByLetterAndSongId(pluginId, scope, songId);
      }

      return [];
    }

    default:
      return [];
  }
}

export async function browseSongsRoot(
  pluginId: string,
): Promise<BrowseResponse[]> {
  const songsPath = `${pluginId}://songs`;
  const allBrowseResponse = createBrowseResponseFolder("ALL", songsPath, "ALL");
  const lettersResponse = createBrowseReponseFolderForLetters(
    letters,
    songsPath,
  );

  return [allBrowseResponse].concat(lettersResponse);
}

export async function browseSongsAll(
  pluginId: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const songs = await SongDbModel.findSongsByPluginId(database, pluginId);

  return BrowseUtils.createSongsBrowseResponses(
    `${pluginId}://songs/ALL`,
    songs,
  );
}

export async function browseSongsByLetter(
  pluginId: string,
  letter: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const songs = await SongDbModel.findSongsByStartingLetter(
    database,
    pluginId,
    letter,
  );

  return BrowseUtils.createSongsBrowseResponses(
    `${pluginId}://songs/${letter}`,
    songs,
  );
}

export async function browseSongsAllAndSongId(
  pluginId: string,
  songId: string,
): Promise<BrowseResponse[]> {
  return browseSongsByScopeAndSongId(pluginId, "ALL", songId);
}

export async function browseSongsByLetterAndSongId(
  pluginId: string,
  letter: string,
  songId: string,
): Promise<BrowseResponse[]> {
  return browseSongsByScopeAndSongId(pluginId, letter, songId);
}

async function browseSongsByScopeAndSongId(
  pluginId: string,
  scope: string,
  songId: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const song = await SongDbModel.findByIdAndPluginId(
    database,
    songId,
    pluginId,
  );
  if (!song) {
    return [];
  }

  const data = Song.fromDbModel(song);
  data.id = `${song.pluginId}://${song.albumId}/${song.id}`;

  return [
    new BrowseResponse(
      `${pluginId}://songs/${scope}/${song.id}`,
      BrowseType.SONG,
      data,
    ),
  ];
}
