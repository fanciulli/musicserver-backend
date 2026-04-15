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
import { PLUGIN_ID, PLUGIN_NAME } from "./constants.js";
import { AlbumDbModel } from "../../../types/db/album.js";
import type { Context } from "../../../types/context.js";
import type {
  PluginConfigurationSettings,
  PluginConfigurationValues,
} from "../../../types/plugins/plugin.js";
import { PluginConfigDBModel } from "../../../types/db/pluginConfig.js";
import { ArtistDbModel } from "../../../types/db/artist.js";

const DEFAULT_MUSIC_FOLDER = "/music";

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
    const database: Db = this.context.database.client;
    await FileSystemScan.scan(database, this.id, this.#musicFolder);
  }

  loadConfiguration = async (): Promise<void> => {
    const database: Db = this.context.database.client;
    const pluginConfig: PluginConfigDBModel =
      await PluginConfigDBModel.findByPluginId(
        database,
        this.category,
        this.id,
      );

    if (!pluginConfig) {
      this.#musicFolder = DEFAULT_MUSIC_FOLDER;
      return;
    }

    await this.updateConfiguration(pluginConfig.settings);
  };

  getConfiguration = async (): Promise<PluginConfigurationSettings> => {
    return {
      variables: [{ musicFolder: "string" }],
      values: {
        musicFolder: this.#musicFolder,
      },
    };
  };

  updateConfiguration = async (
    settings: PluginConfigurationValues,
  ): Promise<void> => {
    const musicFolder = settings["musicFolder"];
    if (typeof musicFolder !== "string" || musicFolder.trim() === "") {
      throw new Error("musicFolder must be a non-empty string");
    }

    this.#musicFolder = musicFolder;

    const database: Db = this.context.database.client;
    await PluginConfigDBModel.upsertSettings(database, this.category, this.id, {
      musicFolder: this.#musicFolder,
    });
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

  async search(query: string, category: string): Promise<BrowseResponse[]> {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery === "") {
      return [];
    }

    const database: Db = this.context.database.client;

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
    const database: Db = this.context.database.client;
    const id = path.split("/").slice(-1)[0];
    const song = await SongDbModel.findById(database, id);
    if (song) {
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
    const database: Db = this.context.database.client;
    const id = uri.split("/").slice(-1)[0];
    const song = await SongDbModel.findById(database, id);
    let albumId: string | undefined;

    this.context.logger.info("Searching for id " + id);
    if (!song) {
      albumId = id; // Trying if the id is an album id
    } else {
      albumId = song.albumId;
    }

    const albumCover = await AlbumDbModel.findCoverById(database, albumId);
    if (!albumCover) {
      return undefined;
    } else {
      return Buffer.from(albumCover, "base64");
    }
  }
}
