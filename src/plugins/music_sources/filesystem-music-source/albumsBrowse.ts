/*
 * Created on Sat Feb 28 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";
import { BrowseResponse, BrowseType } from "../../../types/api/browse.js";
import { Folder } from "../../../types/api/folder.js";
import { Song } from "../../../types/api/song.js";
import { AlbumDbModel } from "../../../types/db/album.js";
import { SongDbModel } from "../../../types/db/song.js";
import { letters } from "../../../misc/constants.js";
import { musicServerInstance } from "../../../server/music_server.js";
import {
  createBrowseReponseFolderForLetters,
  createBrowseResponseFolder,
  isLetterSection,
  isUuidSection,
} from "./utils.js";

export async function browseAlbums(
  pluginId: string,
  sections: string[],
): Promise<BrowseResponse[]> {
  switch (sections.length) {
    case 1:
      return browseAlbumsRoot(pluginId);

    case 2: {
      const scope = sections[1];

      if (scope === "ALL") {
        return browseAlbumsAll(pluginId);
      }

      if (isLetterSection(scope, letters)) {
        return browseAlbumsByLetter(pluginId, scope);
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
          pluginId,
          albumId,
          `${pluginId}://albums/${scope}/${albumId}`,
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
          pluginId,
          `${pluginId}://albums/${scope}/${albumId}`,
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

export async function browseAlbumsRoot(
  pluginId: string,
): Promise<BrowseResponse[]> {
  const albumsPath = `${pluginId}://albums`;
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

export async function browseAlbumsAll(
  pluginId: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const albums = await AlbumDbModel.findAlbumsByPluginId(database, pluginId);
  const albumsPath = `${pluginId}://albums/ALL`;

  return createAlbumsFolderResponses(albumsPath, albums);
}

export async function browseAlbumsByLetter(
  pluginId: string,
  letter: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const albums = await AlbumDbModel.findAlbumsByStartingLetter(
    database,
    pluginId,
    letter,
  );
  const albumsPath = `${pluginId}://albums/${letter}`;

  return createAlbumsFolderResponses(albumsPath, albums);
}

async function browseSongsByAlbumId(
  pluginId: string,
  albumId: string,
  pathPrefix: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const songs = await SongDbModel.findSongsByAlbumId(
    database,
    albumId,
    pluginId,
  );
  const resp = [];

  for (let song of songs) {
    const data = Song.fromDbModel(song);
    data.id = `${song.pluginId}://${song.albumId}/${song.id}`;

    resp.push(
      new BrowseResponse(`${pathPrefix}/${song.id}`, BrowseType.SONG, data),
    );
  }

  return resp;
}

function createAlbumsFolderResponses(
  pathPrefix: string,
  albums: AlbumDbModel[],
): BrowseResponse[] {
  const resp = [];

  for (let album of albums) {
    const folder = new Folder();
    folder.name = album.name;

    resp.push(
      new BrowseResponse(
        `${pathPrefix}/${album.id}`,
        BrowseType.FOLDER,
        folder,
      ),
    );
  }

  return resp;
}

async function browseSongByScopedPathAndSongId(
  pluginId: string,
  pathPrefix: string,
  albumId: string,
  songId: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const song = await SongDbModel.findByIdAndPluginId(
    database,
    songId,
    pluginId,
  );
  if (!song || song.albumId !== albumId) {
    return [];
  }

  const data = Song.fromDbModel(song);
  data.id = `${song.pluginId}://${song.albumId}/${song.id}`;

  return [
    new BrowseResponse(`${pathPrefix}/${song.id}`, BrowseType.SONG, data),
  ];
}
