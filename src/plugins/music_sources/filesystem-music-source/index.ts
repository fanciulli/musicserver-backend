/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "stream";
import { MusicSourcePlugin } from "../../../types/plugins/music_sources.js";
import { BrowseResponse, BrowseType } from "../../../types/api/browse.js";
import { SongDbModel } from "../../../types/db/song.js";
import { Folder } from "../../../types/api/folder.js";
import { Db } from "mongodb";
import { FileSystemScan } from "./scan.js";
import { BrowseUtils } from "../../../utils/browseUtils.js";
import { extractPathSections } from "../../../utils/pathUtils.js";
import { browseAlbums } from "./albumsBrowse.js";
import { browseArtists } from "./artistsBrowse.js";
import { browseSongs } from "./songsBrowse.js";
import { DEFAULT_MUSIC_FOLDER, PLUGIN_ID, PLUGIN_NAME } from "./constants.js";
import { AlbumDbModel } from "../../../types/db/album.js";
import type { Context } from "../../../types/context.js";
import type {
  PluginConfigurationSettings,
  PluginConfigurationValues,
} from "../../../types/plugins/plugin.js";
import { ArtistDbModel } from "../../../types/db/artist.js";
import {
  getConfiguration,
  loadConfiguration,
  updateConfiguration,
} from "./configurationManager.js";

export default class FilesystemMusicSourcePlugin extends MusicSourcePlugin {
  id: string = PLUGIN_ID;
  name: string = PLUGIN_NAME;
  #browseRoot: Array<BrowseResponse>;
  #musicFolder: string;

  constructor(context: Context) {
    super(context);
    this.#musicFolder = DEFAULT_MUSIC_FOLDER;
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
    // making this run asynchronously in order not to block to the API request.
    FileSystemScan.scan(this.context, this.id, this.#musicFolder);
  }

  loadConfiguration = async (): Promise<void> => {
    this.#musicFolder = await loadConfiguration(
      this.getDatabase(),
      this.category,
      this.id,
      DEFAULT_MUSIC_FOLDER,
    );
  };

  getConfiguration = async (): Promise<PluginConfigurationSettings> => {
    return getConfiguration(this.#musicFolder);
  };

  updateConfiguration = async (
    settings: PluginConfigurationValues,
  ): Promise<void> => {
    this.#musicFolder = await updateConfiguration(
      this.getDatabase(),
      this.category,
      this.id,
      settings,
    );
  };

  async browse(path: string): Promise<Array<BrowseResponse>> {
    const pathSections = extractPathSections(this.id, path);
    if (!pathSections) {
      return [];
    }

    if (pathSections.length === 0) {
      return this.#browseRoot;
    }

    const [section] = pathSections;
    const db: Db = this.getDatabase();
    switch (section) {
      case "albums":
        return browseAlbums(db, pathSections);
      case "artists":
        return browseArtists(db, pathSections);
      case "songs":
        return browseSongs(db, pathSections);
      default:
        return [];
    }
  }

  async search(query: string, category: string): Promise<BrowseResponse[]> {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery === "") {
      return [];
    }

    const database: Db = this.getDatabase();

    switch (category) {
      case "album": {
        const albums = await AlbumDbModel.findAlbumsByQuery(
          database,
          this.id,
          normalizedQuery,
        );
        return BrowseUtils.createAlbumsFolderResponses(
          `${this.id}://albums`,
          albums,
        );
      }

      case "artist": {
        const artists = await ArtistDbModel.findArtistsByQuery(
          database,
          this.id,
          normalizedQuery,
        );
        return BrowseUtils.createArtistsFolderResponses(
          `${this.id}://artists`,
          artists,
        );
      }

      case "song": {
        const songs = await SongDbModel.findSongsByQuery(
          database,
          this.id,
          normalizedQuery,
        );
        return BrowseUtils.createSongsBrowseResponses(
          `${this.id}://songs`,
          songs,
        );
      }

      default:
        return [];
    }
  }

  async stream(
    path: string,
    from?: number,
  ): Promise<[Readable, number | undefined]> {
    const id = path.split("/").slice(-1)[0];
    const song = await SongDbModel.findById(this.getDatabase(), id);
    if (song && song.metadata) {
      const filePath: string = song.metadata["filePath"];
      const stats = await stat(filePath);
      const stream = createReadStream(filePath, {
        start: from,
      });
      return [stream, stats.size];
    } else {
      throw new Error("Song not found");
    }
  }

  async getAlbumArt(uri: string): Promise<Buffer<ArrayBuffer> | undefined> {
    const id = uri.split("/").slice(-1)[0];
    const db: Db = this.getDatabase();
    const song = await SongDbModel.findById(db, id);
    let albumId: string | undefined;

    this.context.logger.info(`Searching for id ${id}`);
    if (!song) {
      albumId = id; // Trying if the id is an album id
    } else {
      albumId = song.albumId;
    }

    if (albumId) {
      const albumCover = await AlbumDbModel.findCoverById(db, albumId);
      if (!albumCover) {
        return undefined;
      } else {
        return Buffer.from(albumCover, "base64");
      }
    } else {
      return undefined;
    }
  }
}
