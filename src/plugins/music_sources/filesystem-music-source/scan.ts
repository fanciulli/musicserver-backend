/*
 * Created on Tue Feb 24 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { AlbumDbModel } from "../../../types/db/album.js";
import { ArtistDbModel } from "../../../types/db/artist.js";
import { SongDbModel } from "../../../types/db/song.js";
import type { Db } from "mongodb";
import { listFiles } from "../../../utils/fsUtils.js";
import {
  CouldNotDetermineFileTypeError,
  parseFile,
  UnsupportedFileTypeError,
  type IAudioMetadata,
} from "music-metadata";
import { v4 } from "uuid";
import { musicServerInstance } from "../../../server/musicServer.js";

export class FileSystemScan {
  static async scan(
    db: Db,
    pluginId: string,
    musicFolder: string,
  ): Promise<void> {
    const logger = musicServerInstance.getLogger();
    if (musicFolder.trim() === "") {
      throw new Error("musicFolder must be configured before scan");
    }

    await ArtistDbModel.deleteAll(db, pluginId);
    await AlbumDbModel.deleteAll(db, pluginId);
    await SongDbModel.deleteAll(db, pluginId);

    const files = await listFiles(musicFolder);
    for (let filePath of files) {
      try {
        const fileMetadata: IAudioMetadata = await parseFile(filePath);

        const artists = await FileSystemScan.#upsertArtits(
          db,
          pluginId,
          fileMetadata,
        );
        const album = await FileSystemScan.#upsertAlbum(
          db,
          pluginId,
          fileMetadata,
          artists,
        );
        await FileSystemScan.#upsertSong(
          db,
          pluginId,
          fileMetadata,
          album,
          artists,
          filePath,
        );
      } catch (ex) {
        if (ex instanceof UnsupportedFileTypeError) {
          logger.info(
            `Skipping file ${filePath} because of and unsupported format`,
          );
        } else if (ex instanceof CouldNotDetermineFileTypeError) {
          logger.info(
            `Skipping file ${filePath} because its file type cannot be determined`,
          );
        } else {
          logger.error(ex);
        }
      }
    }
  }

  static async #upsertAlbum(
    db: Db,
    pluginId: string,
    fileMetadata: IAudioMetadata,
    artists: ArtistDbModel[],
  ): Promise<AlbumDbModel> {
    const name = fileMetadata.common?.album;

    if (name) {
      const albumInDb = await AlbumDbModel.find(db, name, pluginId);
      if (albumInDb) {
        if (albumInDb.cover === undefined) {
          const coverImage = fileMetadata.common?.picture?.[0]?.data;
          if (coverImage) {
            albumInDb.cover = Buffer.from(coverImage).toString("base64");
            await albumInDb.update(db);
          }
        }
        return albumInDb;
      } else {
        const album = new AlbumDbModel();
        album.id = v4();
        album.name = name;
        album.pluginId = pluginId;
        album.artists = artists.map((artist) => artist.id);
        const coverImage = fileMetadata.common?.picture?.[0]?.data;
        if (coverImage) {
          album.cover = Buffer.from(coverImage).toString("base64");
        }
        album.insert(db);
        return album;
      }
    } else {
      return;
    }
  }

  static async #upsertArtits(
    db: Db,
    pluginId: string,
    fileMetadata: IAudioMetadata,
  ): Promise<Array<ArtistDbModel>> {
    const artists = fileMetadata.common?.albumartists;

    if (artists) {
      const dbArtists = [];
      for (let artist of artists) {
        const artistInDb = await ArtistDbModel.find(db, artist, pluginId); // TODO: introduce cache
        if (artistInDb) {
          dbArtists.push(artistInDb);
        } else {
          const dbArtist = new ArtistDbModel();
          dbArtist.id = v4();
          dbArtist.name = artist;
          dbArtist.pluginId = pluginId;

          await dbArtist.insert(db);
          dbArtists.push(dbArtist);
        }
      }

      return dbArtists;
    } else {
      return [];
    }
  }

  static async #upsertSong(
    db: Db,
    pluginId: string,
    fileMetadata: IAudioMetadata,
    album: AlbumDbModel,
    artists: ArtistDbModel[],
    filePath: string,
  ) {
    const songName = fileMetadata.common?.title;

    if (songName) {
      const songInDb = await SongDbModel.find(db, songName, pluginId);
      if (!songInDb) {
        const song = new SongDbModel();
        song.name = songName;
        song.id = v4();
        song.pluginId = pluginId;
        song.album = album?.name;
        song.albumId = album?.id;
        song.artist = artists.map((artist) => artist.name).join(", ");
        song.artistsId = album?.artists;
        song.trackNumber = fileMetadata.common.track?.no
          ? fileMetadata.common.track?.no
          : 0;
        song.diskNumber = fileMetadata.common.disk?.no
          ? fileMetadata.common.disk?.no
          : 1;
        song.metadata?.set("filePath", filePath);

        await song.insert(db);
      }
    }
  }
}
