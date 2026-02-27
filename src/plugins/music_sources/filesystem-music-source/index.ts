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
import { SongDbModel } from "../../../types/db/song.js";
import { Folder } from "../../../types/api/folder.js";
import { musicServerInstance } from "../../../server/music_server.js";
import { Db } from "mongodb";
import { FileSystemScan } from "./scan.js";
import { extractPathSections } from "../../../utils/pathUtils.js";
import {
  browseAlbums,
  browseArtists,
  browsePluginRoot,
  browseSongs,
} from "./browse.js";

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

    const songsFolder = new Folder();
    songsFolder.name = "Songs";

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
      new BrowseResponse(`${this.id}://songs`, BrowseType.FOLDER, songsFolder),
    ];
  }

  async scan(): Promise<void> {
    const database: Db = musicServerInstance.getDatabase().client;
    await FileSystemScan.scan(database, this.id);
  }

  async browse(path: string): Promise<Array<BrowseResponse>> {
    const pathSections = extractPathSections(this.id, path);
    if (!pathSections) {
      return [];
    }

    if (pathSections.length === 0) {
      return browsePluginRoot(this.#browseRoot);
    }

    const [section] = pathSections;
    switch (section) {
      case "albums":
        return browseAlbums(this.id, pathSections);
      case "artists":
        return browseArtists(this.id, pathSections);
      case "songs":
        return browseSongs(this.id, pathSections);
      default:
        return [];
    }
  }

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
