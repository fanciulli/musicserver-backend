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
import { ArtistDbModel } from "../../../types/db/artist.js";
import { SongDbModel } from "../../../types/db/song.js";
import { letters } from "../../../misc/constants.js";
import { musicServerInstance } from "../../../server/music_server.js";
import {
  createBrowseReponseFolderForLetters,
  createBrowseResponseFolder,
  isLetterSection,
  isUuidSection,
} from "./utils.js";

export async function browseArtists(
  pluginId: string,
  sections: string[],
): Promise<BrowseResponse[]> {
  switch (sections.length) {
    case 1:
      return browseArtistsRoot(pluginId);

    case 2: {
      const scope = sections[1];

      if (scope === "ALL") {
        return browseArtistsAll(pluginId);
      }

      if (isLetterSection(scope, letters)) {
        return browseArtistsByLetter(pluginId, scope);
      }

      return [];
    }

    case 3: {
      const scope = sections[1];
      const artistId = sections[2];

      if (!isUuidSection(artistId)) {
        return [];
      }

      if (scope === "ALL" || isLetterSection(scope, letters)) {
        return browseAlbumsByArtistId(
          pluginId,
          artistId,
          `${pluginId}://artists/${scope}/${artistId}`,
        );
      }

      return [];
    }

    case 4: {
      const scope = sections[1];
      const artistId = sections[2];
      const albumId = sections[3];

      if (
        (scope === "ALL" || isLetterSection(scope, letters)) &&
        isUuidSection(artistId) &&
        isUuidSection(albumId)
      ) {
        return browseSongsByAlbumId(
          pluginId,
          albumId,
          `${pluginId}://artists/${scope}/${artistId}/${albumId}`,
        );
      }

      return [];
    }

    case 5: {
      const scope = sections[1];
      const artistId = sections[2];
      const albumId = sections[3];
      const songId = sections[4];

      if (
        (scope === "ALL" || isLetterSection(scope, letters)) &&
        isUuidSection(artistId) &&
        isUuidSection(albumId) &&
        isUuidSection(songId)
      ) {
        return browseSongByArtistAlbumAndSongId(
          pluginId,
          scope,
          artistId,
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

export async function browseArtistsRoot(
  pluginId: string,
): Promise<BrowseResponse[]> {
  const artistsPath = `${pluginId}://artists`;
  const allBrowseResponse = createBrowseResponseFolder(
    "ALL",
    artistsPath,
    "ALL",
  );
  const lettersResponse = createBrowseReponseFolderForLetters(
    letters,
    artistsPath,
  );
  return [allBrowseResponse].concat(lettersResponse);
}

export async function browseArtistsAll(
  pluginId: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const artists = await ArtistDbModel.findArtistsByPluginId(database, pluginId);
  const artistsPath = `${pluginId}://artists/ALL`;

  return createArtistsFolderResponses(artistsPath, artists);
}

export async function browseArtistsByLetter(
  pluginId: string,
  letter: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const artists = await ArtistDbModel.findArtistsByStartingLetter(
    database,
    pluginId,
    letter,
  );
  const artistsPath = `${pluginId}://artists/${letter}`;

  return createArtistsFolderResponses(artistsPath, artists);
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

async function browseAlbumsByArtistId(
  pluginId: string,
  artistId: string,
  pathPrefix: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const albums = await AlbumDbModel.findAlbumsByArtistId(
    database,
    pluginId,
    artistId,
  );

  return createAlbumsFolderResponses(pathPrefix, albums);
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

function createArtistsFolderResponses(
  pathPrefix: string,
  artists: ArtistDbModel[],
): BrowseResponse[] {
  const resp = [];

  for (let artist of artists) {
    const folder = new Folder();
    folder.name = artist.name;

    resp.push(
      new BrowseResponse(
        `${pathPrefix}/${artist.id}`,
        BrowseType.FOLDER,
        folder,
      ),
    );
  }

  return resp;
}

async function browseSongByArtistAlbumAndSongId(
  pluginId: string,
  scope: string,
  artistId: string,
  albumId: string,
  songId: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const song = await SongDbModel.findByIdAndPluginId(
    database,
    songId,
    pluginId,
  );
  if (!song || song.albumId !== albumId || !song.artistsId.includes(artistId)) {
    return [];
  }

  const data = Song.fromDbModel(song);
  data.id = `${song.pluginId}://${song.albumId}/${song.id}`;

  return [
    new BrowseResponse(
      `${pluginId}://artists/${scope}/${artistId}/${albumId}/${song.id}`,
      BrowseType.SONG,
      data,
    ),
  ];
}
