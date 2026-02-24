/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { createReadStream } from "fs";
import { Readable } from "stream";
import { MusicSourcePlugin } from "../../../types/plugins/music_sources.js";
import { BrowseResponse, BrowseType } from "../../../types/api/browse.js";
import { AlbumDbModel } from "../../../types/db/album.js";
import { SongDbModel } from "../../../types/db/song.js";
import { Folder } from "../../../types/api/folder.js";
import { musicServerInstance } from "../../../server/music_server.js";
import { Db } from "mongodb";
import { Song } from "../../../types/api/song.js";
import { FileSystemScan } from "./scan.js";

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
    await FileSystemScan.scan(database, this.id);
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
