/*
 * Created on Fri Feb 27 2026
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
} from "./utils.js";

export async function browsePluginRoot(
  browseRoot: BrowseResponse[],
): Promise<BrowseResponse[]> {
  return browseRoot;
}

export async function browseAlbums(
  pluginId: string,
  sections: string[],
): Promise<BrowseResponse[]> {
  if (sections.length === 1) {
    return browseAlbumsRoot(pluginId);
  }

  if (sections.length === 2 && sections[1] === "ALL") {
    return browseAlbumsAll(pluginId);
  }

  if (sections.length === 2 && isUuidSection(sections[1])) {
    return browseAlbumsByAlbumId(pluginId, sections[1]);
  }

  if (sections.length === 2 && isLetterSection(sections[1])) {
    return browseAlbumsByLetter(pluginId, sections[1]);
  }

  if (
    sections.length === 3 &&
    isLetterSection(sections[1]) &&
    isUuidSection(sections[2])
  ) {
    return browseAlbumsByLetterAndAlbumId(pluginId, sections[1], sections[2]);
  }

  if (
    sections.length === 4 &&
    isLetterSection(sections[1]) &&
    isUuidSection(sections[2]) &&
    isUuidSection(sections[3])
  ) {
    return browseAlbumsByLetterAlbumIdAndSongId(
      pluginId,
      sections[1],
      sections[2],
      sections[3],
    );
  }

  return [];
}

export async function browseArtists(
  pluginId: string,
  sections: string[],
): Promise<BrowseResponse[]> {
  if (sections.length === 1) {
    return browseArtistsRoot(pluginId);
  }

  if (sections.length === 2 && sections[1] === "ALL") {
    return browseArtistsAll(pluginId);
  }

  if (sections.length === 2 && isLetterSection(sections[1])) {
    return browseArtistsByLetter(pluginId, sections[1]);
  }

  if (
    sections.length === 3 &&
    isLetterSection(sections[1]) &&
    isUuidSection(sections[2])
  ) {
    return browseArtistsByLetterAndAlbumId(pluginId, sections[1], sections[2]);
  }

  if (
    sections.length === 4 &&
    isLetterSection(sections[1]) &&
    isUuidSection(sections[2]) &&
    isUuidSection(sections[3])
  ) {
    return browseArtistsByLetterAlbumIdAndSongId(
      pluginId,
      sections[1],
      sections[2],
      sections[3],
    );
  }

  return [];
}

export async function browseSongs(
  pluginId: string,
  sections: string[],
): Promise<BrowseResponse[]> {
  if (sections.length === 1) {
    return browseSongsRoot(pluginId);
  }

  if (sections.length === 2 && sections[1] === "ALL") {
    return browseSongsAll(pluginId);
  }

  if (sections.length === 2 && isLetterSection(sections[1])) {
    return browseSongsByLetter(pluginId, sections[1]);
  }

  if (
    sections.length === 3 &&
    isLetterSection(sections[1]) &&
    isUuidSection(sections[2])
  ) {
    return browseSongsByLetterAndSongId(pluginId, sections[1], sections[2]);
  }

  return [];
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

export async function browseAlbumsByLetterAndAlbumId(
  pluginId: string,
  letter: string,
  albumId: string,
): Promise<BrowseResponse[]> {
  return browseSongsByAlbumId(
    pluginId,
    albumId,
    `${pluginId}://albums/${letter}/${albumId}`,
  );
}

export async function browseAlbumsByAlbumId(
  pluginId: string,
  albumId: string,
): Promise<BrowseResponse[]> {
  return browseSongsByAlbumId(
    pluginId,
    albumId,
    `${pluginId}://albums/${albumId}`,
  );
}

export async function browseAlbumsByLetterAlbumIdAndSongId(
  _pluginId: string,
  _letter: string,
  _albumId: string,
  _songId: string,
): Promise<BrowseResponse[]> {
  return [];
}

export async function browseArtistsRoot(
  _pluginId: string,
): Promise<BrowseResponse[]> {
  return [];
}

export async function browseArtistsAll(
  _pluginId: string,
): Promise<BrowseResponse[]> {
  return [];
}

export async function browseArtistsByLetter(
  _pluginId: string,
  _letter: string,
): Promise<BrowseResponse[]> {
  return [];
}

export async function browseArtistsByLetterAndAlbumId(
  _pluginId: string,
  _letter: string,
  _albumId: string,
): Promise<BrowseResponse[]> {
  return [];
}

export async function browseArtistsByLetterAlbumIdAndSongId(
  _pluginId: string,
  _letter: string,
  _albumId: string,
  _songId: string,
): Promise<BrowseResponse[]> {
  return [];
}

export async function browseSongsRoot(
  _pluginId: string,
): Promise<BrowseResponse[]> {
  return [];
}

export async function browseSongsAll(
  _pluginId: string,
): Promise<BrowseResponse[]> {
  return [];
}

export async function browseSongsByLetter(
  _pluginId: string,
  _letter: string,
): Promise<BrowseResponse[]> {
  return [];
}

export async function browseSongsByLetterAndSongId(
  _pluginId: string,
  _letter: string,
  _songId: string,
): Promise<BrowseResponse[]> {
  return [];
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

function isLetterSection(pathSection: string): boolean {
  return letters.includes(pathSection.toUpperCase());
}

function isUuidSection(pathSection: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    pathSection,
  );
}
