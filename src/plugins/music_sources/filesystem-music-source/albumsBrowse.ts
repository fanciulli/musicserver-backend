/*
 * Created on Sat Feb 28 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";
import { BrowseResponse } from "../../../types/api/browse.js";
import { AlbumDbModel } from "../../../types/db/album.js";
import { SongDbModel } from "../../../types/db/song.js";
import { BrowseUtils } from "../../../utils/browseUtils.js";
import { letters, PLUGIN_ID } from "./constants.js";
import {
  createBrowseReponseFolderForLetters,
  createBrowseResponseFolder,
  createSongBrowseResponse,
  createSongBrowseResponses,
  isLetterSection,
  isUuidSection,
} from "./utils.js";

export async function browseAlbums(
  db: Db,
  sections: string[],
): Promise<BrowseResponse[]> {
  switch (sections.length) {
    case 1:
      return browseAlbumsRoot();

    case 2: {
      const scope = sections[1];

      if (scope === "ALL") {
        return browseAlbumsAll(db);
      }

      if (isLetterSection(scope, letters)) {
        return browseAlbumsByLetter(db, scope);
      }

      if (isUuidSection(scope)) {
        return browseSongsByAlbumId(
          db,
          scope,
          `${PLUGIN_ID}://albums/${scope}`,
        );
      }

      return [];
    }

    case 3: {
      const scope = sections[1];
      const albumId = sections[2];

      if (!isUuidSection(albumId)) {
        return [];
      }

      if (scope === "ALL" || isLetterSection(scope, letters)) {
        return browseSongsByAlbumId(
          db,
          albumId,
          `${PLUGIN_ID}://albums/${scope}/${albumId}`,
        );
      }

      if (isUuidSection(scope)) {
        // scope=ALBUM_ID, albumId=SONG_ID
        return browseSongByScopedPathAndSongId(
          db,
          `${PLUGIN_ID}://albums/${scope}`,
          scope,
          albumId,
        );
      }

      return [];
    }

    case 4: {
      const scope = sections[1];
      const albumId = sections[2];
      const songId = sections[3];

      if (
        (scope === "ALL" || isLetterSection(scope, letters)) &&
        isUuidSection(albumId) &&
        isUuidSection(songId)
      ) {
        return browseSongByScopedPathAndSongId(
          db,
          `${PLUGIN_ID}://albums/${scope}/${albumId}`,
          albumId,
          songId,
        );
      }

      return [];
    }

    default:
      return [];
  }
}

export async function browseAlbumsRoot(): Promise<BrowseResponse[]> {
  const albumsPath = `${PLUGIN_ID}://albums`;
  const allBrowseResponse = createBrowseResponseFolder(
    "ALL",
    albumsPath,
    "ALL",
  );
  const lettersResponse = createBrowseReponseFolderForLetters(
    letters,
    albumsPath,
  );
  return [allBrowseResponse].concat(lettersResponse);
}

export async function browseAlbumsAll(db: Db): Promise<BrowseResponse[]> {
  const albums = await AlbumDbModel.findAlbumsByPluginId(db, PLUGIN_ID);
  const albumsPath = `${PLUGIN_ID}://albums/ALL`;

  return BrowseUtils.createAlbumsFolderResponses(albumsPath, albums);
}

export async function browseAlbumsByLetter(
  db: Db,
  letter: string,
): Promise<BrowseResponse[]> {
  const albums = await AlbumDbModel.findAlbumsByStartingLetter(
    db,
    PLUGIN_ID,
    letter,
  );
  const albumsPath = `${PLUGIN_ID}://albums/${letter}`;

  return BrowseUtils.createAlbumsFolderResponses(albumsPath, albums);
}

async function browseSongsByAlbumId(
  db: Db,
  albumId: string,
  pathPrefix: string,
): Promise<BrowseResponse[]> {
  const songs = await SongDbModel.findSongsByAlbumId(db, albumId, PLUGIN_ID);

  return createSongBrowseResponses(pathPrefix, songs);
}

async function browseSongByScopedPathAndSongId(
  db: Db,
  pathPrefix: string,
  albumId: string,
  songId: string,
): Promise<BrowseResponse[]> {
  const song = await SongDbModel.findByIdAndPluginId(db, songId, PLUGIN_ID);
  if (!song || song.albumId !== albumId) {
    return [];
  }

  return [createSongBrowseResponse(`${pathPrefix}/${song.id}`, song)];
}
