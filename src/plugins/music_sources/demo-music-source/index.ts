/*
 * Created on Wed Mar 04 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { BrowseResponse, BrowseType } from "../../../types/api/browse.js";
import { MusicSourcePlugin } from "../../../types/plugins/music_sources.js";
import { BrowseUtils } from "../../../utils/browseUtils.js";
import type { Readable } from "node:stream";
import { PLUGIN_ID, PLUGIN_NAME } from "./constants.js";
import { Folder } from "../../../types/api/folder.js";
import { musicServerInstance } from "../../../server/music_server.js";
import type { Db } from "mongodb";
import { ArtistDbModel } from "../../../types/db/artist.js";
import { AlbumDbModel } from "../../../types/db/album.js";
import { SongDbModel } from "../../../types/db/song.js";
import { v4 } from "uuid";

export default class DemoMusicSourcePlugin extends MusicSourcePlugin {
  id: string = PLUGIN_ID;
  name: string = PLUGIN_NAME;
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
    await ArtistDbModel.deleteAll(database, this.id);
    await AlbumDbModel.deleteAll(database, this.id);
    await SongDbModel.deleteAll(database, this.id);

    const dbArtist = new ArtistDbModel();
    dbArtist.id = v4();
    dbArtist.name = "A young artist";
    dbArtist.pluginId = this.id;

    await dbArtist.insert(database);

    const album = new AlbumDbModel();
    album.id = v4();
    album.name = "My first album";
    album.pluginId = this.id;
    album.artists = [dbArtist.id];
    album.insert(database);

    const song = new SongDbModel();
    song.name = "Accidenti";
    song.id = v4();
    song.pluginId = this.id;
    song.album = album.name;
    song.albumId = album.id;
    song.artist = dbArtist.name;
    song.artistsId = [dbArtist.id];
    song.trackNumber = 1;
    song.diskNumber = 1;

    await song.insert(database);
  }

  async browse(path: string): Promise<Array<BrowseResponse>> {
    const database: Db = musicServerInstance.getDatabase().client;
    if (path === `${this.id}://albums`) {
      const albums = await AlbumDbModel.findAlbumsByPluginId(database, this.id);
      return BrowseUtils.createAlbumsFolderResponses(path, albums);
    } else if (path === `${this.id}://artists`) {
      const artists = await ArtistDbModel.findArtistsByPluginId(
        database,
        this.id,
      );
      return await BrowseUtils.createArtistsFolderResponses(path, artists);
    } else if (path === `${this.id}://songs`) {
      const songs = await SongDbModel.findSongsByPluginId(database, this.id);
      return BrowseUtils.createSongsBrowseResponses(path, songs);
    } else {
      return this.#browseRoot;
    }
  }

  async stream(path: string): Promise<Readable> {
    const database: Db = musicServerInstance.getDatabase().client;
    const id = path.split("/").slice(-1)[0];
    const song = await SongDbModel.findById(database, id);
    if (song) {
      const accidentiSongModule = await import("./accidenti.js");

      console.log(accidentiSongModule);
      //const stream = createReadStream(song.metadata["filePath"]);
      //return stream;
      return;
    } else {
      throw new Error("Song not found");
    }
  }
}
