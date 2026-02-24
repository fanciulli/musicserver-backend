/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { createReadStream } from "fs";
import { Readable } from "stream";
import { readdir } from "node:fs/promises";
import { MusicSourcePlugin } from "../../../types/plugins/music_sources.js";
import path from "path";
import { v4 } from "uuid";
import type { IAudioMetadata } from "music-metadata";
import { parseFile } from "music-metadata";
import { BrowseResponse, BrowseType } from "../../../types/api/browse.js";
import { AlbumDbModel } from "../../../types/db/album.js";
import { SongDbModel } from "../../../types/db/song.js";
import { Folder } from "../../../types/api/folder.js";
import { ArtistDbModel } from "../../../types/db/artist.js";
import { musicServerInstance } from "../../../server/music_server.js";
import { Db } from "mongodb";
import { Song } from "../../../types/api/song.js";

const listFiles = async (parentFolder: string): Promise<string[]> => {
  const dirListing = await readdir(parentFolder, {
    withFileTypes: true,
    recursive: true,
  });

  const files = dirListing
    .filter((item) => {
      return item.isDirectory() == false;
    })
    .map((file) => {
      return path.join(file.parentPath, file.name);
    });
  return files;
};

export default class FilesystemMusicSourcePlugin extends MusicSourcePlugin {
  id: string = "filesystem-music-source";
  name: string = "Filesystem Music Source";
  category: string = "music_source";
  #browseRoot: Array<BrowseResponse>;

  constructor() {
    super();
    const albumsFolder = new Folder();
    albumsFolder.name = "Albums";

    const artistsFolder = new Folder();
    artistsFolder.name = "Artists";

    this.#browseRoot = [
      new BrowseResponse(
        `${this.id}://albums`,
        BrowseType.FOLDER,
        albumsFolder,
      ),
      new BrowseResponse(
        `${this.id}://artists`,
        BrowseType.FOLDER,
        artistsFolder,
      ),
    ];
  }

  async scan(): Promise<void> {
    const database: Db = musicServerInstance.getDatabase().client;
    await ArtistDbModel.deleteAll(database, this.id);
    await AlbumDbModel.deleteAll(database, this.id);
    await SongDbModel.deleteAll(database, this.id);

    const files = await listFiles(process.env.PLUGIN_FSS_FOLDER);
    for (let filePath of files) {
      try {
        const fileMetadata: IAudioMetadata = await parseFile(filePath);

        const artists = await this.#upsertArtits(fileMetadata);
        const album = await this.#upsertAlbum(fileMetadata, artists);
        await this.#upsertSong(fileMetadata, album, artists, filePath);
      } catch (ex) {
        console.log(ex);
      }
    }
  }

  async #upsertAlbum(
    fileMetadata: IAudioMetadata,
    artists: ArtistDbModel[],
  ): Promise<AlbumDbModel> {
    const database: Db = musicServerInstance.getDatabase().client;

    const name = fileMetadata.common?.album;

    if (name) {
      const albumInDb = await AlbumDbModel.find(database, name, this.id);
      if (albumInDb) {
        return albumInDb;
      } else {
        const album = new AlbumDbModel();
        album.id = v4();
        album.name = name;
        album.pluginId = this.id;
        album.artists = artists.map((artist) => artist.id);
        album.insert(database);
        return album;
      }
    } else {
      return;
    }
  }

  async #upsertArtits(
    fileMetadata: IAudioMetadata,
  ): Promise<Array<ArtistDbModel>> {
    const database: Db = musicServerInstance.getDatabase().client;

    const artists = fileMetadata.common?.albumartists;

    if (artists) {
      const dbArtists = [];
      for (let artist of artists) {
        const artistInDb = await ArtistDbModel.find(database, artist, this.id); // TODO: introduce cache
        if (artistInDb) {
          dbArtists.push(artistInDb);
        } else {
          const dbArtist = new ArtistDbModel();
          dbArtist.id = v4();
          dbArtist.name = artist;
          dbArtist.pluginId = this.id;

          await dbArtist.insert(database);
          dbArtists.push(dbArtist);
        }
      }

      return dbArtists;
    } else {
      return [];
    }
  }

  async #upsertSong(
    fileMetadata: IAudioMetadata,
    album: AlbumDbModel,
    artists: ArtistDbModel[],
    filePath: string,
  ) {
    const database: Db = musicServerInstance.getDatabase().client;

    const songName = fileMetadata.common?.title;

    const songInDb = await SongDbModel.find(database, songName, this.id);
    if (!songInDb) {
      const song = new SongDbModel();
      song.name = songName;
      song.id = v4();
      song.pluginId = this.id;
      song.album = album.name;
      song.albumId = album.id;
      song.artist = artists.map((artist) => artist.name).join(", ");
      song.artistsId = album.artists;
      song.trackNumber = fileMetadata.common.track?.no;
      song.diskNumber = fileMetadata.common.disk?.no;
      // song.duration =
      song.metadata = {
        filePath: filePath,
      };

      await song.insert(database);
    }
  }

  async browse(path: string): Promise<Array<BrowseResponse>> {
    if (path === `${this.id}://`) {
      return this.#browseRoot;
    } else if (path.startsWith(`${this.id}://albums`)) {
      return this.#browseAlbums(path);
    } else {
      return [];
    }
  }

  #browseAlbums = async (path: string): Promise<Array<BrowseResponse>> => {
    const database: Db = musicServerInstance.getDatabase().client;
    const resp = [];
    switch (path) {
      case `${this.id}://albums`:
        const albums = await AlbumDbModel.findAlbumsByPluginId(
          database,
          this.id,
        );

        for (let album of albums) {
          const folder = new Folder();
          folder.name = album.name;

          resp.push(
            new BrowseResponse(
              `${path}/${album.id}`,
              BrowseType.FOLDER,
              folder,
            ),
          );
        }
        return resp;

      default:
        const albumId = path.split("/").slice(-1)[0];
        const songs = await SongDbModel.findSongsByAlbumId(
          database,
          albumId,
          this.id,
        );

        for (let song of songs) {
          const data = await Song.fromDbModel(song);
          data.id = `${song.pluginId}://${song.albumId}/${song.id}`;

          resp.push(
            new BrowseResponse(`${path}/${song.id}`, BrowseType.SONG, data),
          );
        }
        return resp;
    }
  };

  async stream(path: string): Promise<Readable> {
    const database: Db = musicServerInstance.getDatabase().client;
    const id = this.#extractSongIdFromPath(path);
    const song = await SongDbModel.findById(database, id);
    if (song) {
      const stream = createReadStream(song.metadata["filePath"]);
      return stream;
    } else {
      throw new Error("Song not found");
    }
  }

  #extractSongIdFromPath(path: string): string {
    if (path.startsWith(`${this.id}://albums`)) {
      return path.split("/").slice(-1)[0];
    } else {
      return "";
    }
  }
}
