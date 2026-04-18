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
import { ArtistDbModel } from "../../../types/db/artist.js";
import { SongDbModel } from "../../../types/db/song.js";
import { BrowseUtils } from "../../../utils/browseUtils.js";
import { letters } from "../../../misc/constants.js";
import { musicServerInstance } from "../../../server/musicServer.js";
import { PLUGIN_ID } from "./constants.js";
import {
  createBrowseReponseFolderForLetters,
  createBrowseResponseFolder,
  createSongBrowseResponse,
  createSongBrowseResponses,
  isLetterSection,
  isUuidSection,
} from "./utils.js";

export async function browseArtists(
  sections: string[],
): Promise<BrowseResponse[]> {
  switch (sections.length) {
    case 1:
      return browseArtistsRoot();

    case 2: {
      const scope = sections[1];

      if (scope === "ALL") {
        return browseArtistsAll();
      }

      if (isLetterSection(scope, letters)) {
        return browseArtistsByLetter(scope);
      }

      if (isUuidSection(scope)) {
        return browseAlbumsByArtistId(scope, `${PLUGIN_ID}://artists/${scope}`);
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
          artistId,
          `${PLUGIN_ID}://artists/${scope}/${artistId}`,
        );
      }

      if (isUuidSection(scope)) {
        // scope=ARTIST_ID, artistId=ALBUM_ID
        return browseSongsByAlbumId(
          artistId,
          `${PLUGIN_ID}://artists/${scope}/${artistId}`,
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
          albumId,
          `${PLUGIN_ID}://artists/${scope}/${artistId}/${albumId}`,
        );
      }

      if (
        isUuidSection(scope) &&
        isUuidSection(artistId) &&
        isUuidSection(albumId)
      ) {
        // scope=ARTIST_ID, artistId=ALBUM_ID, albumId=SONG_ID
        return browseSongByDirectArtistAlbumAndSongId(scope, artistId, albumId);
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

export async function browseArtistsRoot(): Promise<BrowseResponse[]> {
  const artistsPath = `${PLUGIN_ID}://artists`;
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

export async function browseArtistsAll(): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const artists = await ArtistDbModel.findArtistsByPluginId(
    database,
    PLUGIN_ID,
  );
  const artistsPath = `${PLUGIN_ID}://artists/ALL`;

  return BrowseUtils.createArtistsFolderResponses(artistsPath, artists);
}

export async function browseArtistsByLetter(
  letter: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const artists = await ArtistDbModel.findArtistsByStartingLetter(
    database,
    PLUGIN_ID,
    letter,
  );
  const artistsPath = `${PLUGIN_ID}://artists/${letter}`;

  return BrowseUtils.createArtistsFolderResponses(artistsPath, artists);
}

async function browseSongsByAlbumId(
  albumId: string,
  pathPrefix: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const songs = await SongDbModel.findSongsByAlbumId(
    database,
    albumId,
    PLUGIN_ID,
  );

  return createSongBrowseResponses(pathPrefix, songs);
}

async function browseAlbumsByArtistId(
  artistId: string,
  pathPrefix: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const albums = await AlbumDbModel.findAlbumsByArtistId(
    database,
    PLUGIN_ID,
    artistId,
  );

  return BrowseUtils.createAlbumsFolderResponses(pathPrefix, albums);
}

async function browseSongByArtistAlbumAndSongId(
  scope: string,
  artistId: string,
  albumId: string,
  songId: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const song = await SongDbModel.findByIdAndPluginId(
    database,
    songId,
    PLUGIN_ID,
  );
  if (
    !song ||
    song.albumId !== albumId ||
    !song.artistsId?.includes(artistId)
  ) {
    return [];
  }

  return [
    createSongBrowseResponse(
      `${PLUGIN_ID}://artists/${scope}/${artistId}/${albumId}/${song.id}`,
      song,
    ),
  ];
}

async function browseSongByDirectArtistAlbumAndSongId(
  artistId: string,
  albumId: string,
  songId: string,
): Promise<BrowseResponse[]> {
  const database: Db = musicServerInstance.getDatabase().client;
  const song = await SongDbModel.findByIdAndPluginId(
    database,
    songId,
    PLUGIN_ID,
  );
  if (
    !song ||
    song.albumId !== albumId ||
    !song.artistsId?.includes(artistId)
  ) {
    return [];
  }

  return [
    createSongBrowseResponse(
      `${PLUGIN_ID}://artists/${artistId}/${albumId}/${song.id}`,
      song,
    ),
  ];
}
