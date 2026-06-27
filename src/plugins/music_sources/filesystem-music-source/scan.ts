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
import {
  NotificationDbModel,
  NotificationTypes,
} from "../../../types/db/notification.js";
import type { Context } from "../../../types/context.js";
import type { Db } from "mongodb";
import { fileExists, listFiles } from "../../../utils/fsUtils.js";
import {
  CouldNotDetermineFileTypeError,
  parseFile,
  UnsupportedFileTypeError,
  type IAudioMetadata,
} from "music-metadata";
import { v4 } from "uuid";
import { linkArtists, pickBestArtistName } from "./utils.js";
import type { FilesystemConfiguration } from "./configuration.js";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { SCAN_SKIP_EXTENSION, SCAN_SKIP_FILES } from "./constants.js";

export class FileSystemScan {
  static #scanQueue: Promise<void> = Promise.resolve();
  static #artistMap: Map<string, ArtistDbModel> = new Map<
    string,
    ArtistDbModel
  >();
  static #albumMap: Map<string, AlbumDbModel> = new Map<string, AlbumDbModel>();
  static #checkedCoverAlbum: Set<string> = new Set<string>();

  static async scan(
    context: Context,
    pluginId: string,
    configuration: FilesystemConfiguration,
  ): Promise<void> {
    const musicFolder = configuration.musicFolder;
    const smartMergeArtists = configuration.smartMergeArtists;
    const albumCoverFileNames = configuration.albumCoverFileNames.split(",");

    if (musicFolder.trim() === "") {
      throw new Error("musicFolder must be configured before scan");
    }

    let releaseScanQueue: (() => void) | undefined;
    const previousScan = FileSystemScan.#scanQueue;
    FileSystemScan.#scanQueue = new Promise<void>((resolve) => {
      releaseScanQueue = resolve;
    });

    const db: Db = context.database;
    const logger = context.logger;

    await previousScan;
    const startTime = Date.now();
    try {
      logger.info(`Starting scan of music folder ${musicFolder}`);
      await NotificationDbModel.send(db, null, {
        title: "Library scan started",
        message: `Scanning ${musicFolder}`,
        type: NotificationTypes.INFO,
      });

      await ArtistDbModel.markAllAsNotExisting(db, pluginId);
      await AlbumDbModel.markAllAsNotExisting(db, pluginId);
      await SongDbModel.markAllAsNotExisting(db, pluginId);

      const files = await listFiles(
        musicFolder,
        SCAN_SKIP_FILES,
        SCAN_SKIP_EXTENSION,
      );
      const totalFiles = files.length;
      logger.info(`${totalFiles} files to scan.`);

      for (let filePath of files) {
        try {
          const fileExtension = path.extname(filePath).toLowerCase();
          const fileName = path.basename(filePath);

          const fileMetadata: IAudioMetadata = await parseFile(filePath);
          const folder = path.dirname(filePath);

          const artists = await FileSystemScan.#upsertArtits(
            db,
            pluginId,
            fileMetadata,
            smartMergeArtists,
          );
          const album = await FileSystemScan.#upsertAlbum(
            db,
            pluginId,
            fileMetadata,
            artists,
            albumCoverFileNames,
            folder,
          );
          await FileSystemScan.#upsertSong(
            db,
            pluginId,
            fileMetadata,
            album,
            artists,
            filePath,
          );
        } catch (ex: any) {
          if (ex instanceof UnsupportedFileTypeError) {
            logger.debug(
              `Skipping file ${filePath} because of and unsupported format`,
            );
          } else if (ex instanceof CouldNotDetermineFileTypeError) {
            logger.debug(
              `Skipping file ${filePath} because its file type cannot be determined`,
            );
          } else {
            logger.debug(ex);
          }
        }
      }

      await ArtistDbModel.deleteNotExisting(db, pluginId);
      await AlbumDbModel.deleteNotExisting(db, pluginId);
      await SongDbModel.deleteNotExisting(db, pluginId);

      const indexedSongs = await SongDbModel.count(db, pluginId);
      await NotificationDbModel.send(db, null, {
        title: "Library scan completed",
        message: `${indexedSongs} tracks indexed`,
        type: NotificationTypes.SUCCESS,
      });
    } catch (ex: any) {
      await NotificationDbModel.send(db, null, {
        title: "Library scan failed",
        message: ex?.message ?? "Unknown error",
        type: NotificationTypes.ERROR,
      });
      throw ex;
    } finally {
      releaseScanQueue?.();

      const stopTime = Date.now();
      logger.info(
        `Scan of music folder ${musicFolder} completed. Time taken: ${(stopTime - startTime) / 1000}s`,
      );

      FileSystemScan.#artistMap.clear();
      FileSystemScan.#albumMap.clear();
      FileSystemScan.#checkedCoverAlbum.clear();
    }
  }

  static async setAlbumCover(
    fileMetadata: IAudioMetadata,
    album: AlbumDbModel,
    albumCoverFileNames: string[],
    folder: string,
  ) {
    if (album.cover === undefined) {
      const coverImage = fileMetadata.common?.picture?.[0]?.data;
      if (coverImage) {
        album.cover = Buffer.from(coverImage).toString("base64");
      } else {
        for (const fileName of albumCoverFileNames) {
          const fileFullPath = path.join(folder, fileName);
          if (FileSystemScan.#checkedCoverAlbum.has(fileFullPath)) {
            break;
          } else {
            FileSystemScan.#checkedCoverAlbum.add(fileFullPath);
            const exists = await fileExists(fileFullPath);
            if (exists) {
              const contents = await readFile(fileFullPath, {});
              album.cover = contents.toString("base64");

              break;
            }
          }
        }
      }
    }
  }

  static async #upsertAlbum(
    db: Db,
    pluginId: string,
    fileMetadata: IAudioMetadata,
    artists: ArtistDbModel[],
    albumCoverFileNames: string[],
    folder: string,
  ): Promise<AlbumDbModel | undefined> {
    const name = fileMetadata.common?.album;

    if (name) {
      const artistIds = artists
        .map((artist) => artist.id)
        .filter((id) => id !== undefined);

      const cachedAlbumKey = `${name}-${artistIds.join("-")}`;
      const cachedAlbum = FileSystemScan.#albumMap.get(cachedAlbumKey);
      const albumInDb = cachedAlbum
        ? cachedAlbum
        : await AlbumDbModel.find(db, name, pluginId, artistIds);
      if (albumInDb) {
        albumInDb.exists = true;
        await FileSystemScan.setAlbumCover(
          fileMetadata,
          albumInDb,
          albumCoverFileNames,
          folder,
        );
        await albumInDb.update(db);

        if (!cachedAlbum) {
          FileSystemScan.#albumMap.set(cachedAlbumKey, albumInDb);
        }
        return albumInDb;
      } else {
        const album = new AlbumDbModel();
        album.id = v4();
        album.name = name;
        album.pluginId = pluginId;
        album.exists = true;
        album.artists = artistIds;

        await FileSystemScan.setAlbumCover(
          fileMetadata,
          album,
          albumCoverFileNames,
          folder,
        );
        if (!cachedAlbum) {
          FileSystemScan.#albumMap.set(cachedAlbumKey, album);
        }

        await album.insert(db);
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
    smartMergeArtists: boolean,
  ): Promise<Array<ArtistDbModel>> {
    const artists = FileSystemScan.#extractArtists(fileMetadata);

    if (artists) {
      const dbArtists = [];
      for (let artist of artists) {
        const cacheKey = smartMergeArtists ? artist.toLowerCase() : artist;
        const cachedArtist = FileSystemScan.#artistMap.get(cacheKey);

        const artistInDb = cachedArtist
          ? cachedArtist
          : smartMergeArtists
            ? await ArtistDbModel.findCaseInsensitive(db, artist, pluginId)
            : await ArtistDbModel.find(db, artist, pluginId);
        if (artistInDb) {
          artistInDb.exists = true;
          if (smartMergeArtists && artistInDb.name) {
            // Prefer the best-cased variant; updates a discarded name in the DB.
            artistInDb.name = pickBestArtistName(artistInDb.name, artist);
          }
          await artistInDb.update(db);
          dbArtists.push(artistInDb);

          if (!cachedArtist) {
            FileSystemScan.#artistMap.set(cacheKey, artistInDb);
          }
        } else {
          const dbArtist = new ArtistDbModel();
          dbArtist.id = v4();
          dbArtist.name = artist;
          dbArtist.pluginId = pluginId;
          dbArtist.exists = true;

          await dbArtist.insert(db);
          dbArtists.push(dbArtist);

          if (!cachedArtist) {
            FileSystemScan.#artistMap.set(cacheKey, dbArtist);
          }
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
    album: AlbumDbModel | undefined,
    artists: ArtistDbModel[],
    filePath: string,
  ): Promise<SongDbModel | undefined> {
    const songName = fileMetadata.common?.title;

    if (songName) {
      const songInDb = await SongDbModel.find(
        db,
        songName,
        pluginId,
        album?.id,
      );
      if (!songInDb) {
        const song = new SongDbModel();
        song.name = songName;
        song.id = v4();
        song.pluginId = pluginId;

        this.#updateSongClass(song, fileMetadata, album, artists, filePath);

        await song.insert(db);
        return song;
      } else {
        this.#updateSongClass(songInDb, fileMetadata, album, artists, filePath);

        await songInDb.update(db);
        return songInDb;
      }
    } else {
      return;
    }
  }

  static #updateSongClass(
    song: SongDbModel,
    fileMetadata: IAudioMetadata,
    album: AlbumDbModel | undefined,
    artists: ArtistDbModel[],
    filePath: string,
  ): void {
    song.album = album?.name;
    song.albumId = album?.id;
    song.format = fileMetadata.format?.container;
    song.artist =
      artists && artists.length > 0
        ? linkArtists(artists)
        : linkArtists(album?.artists);
    song.artistsId = album?.artists;

    song.trackNumber = fileMetadata.common.track?.no
      ? fileMetadata.common.track?.no
      : 0;
    song.diskNumber = fileMetadata.common.disk?.no
      ? fileMetadata.common.disk?.no
      : 1;
    song.sampleRate = fileMetadata.format.sampleRate;
    song.bitRate = fileMetadata.format.bitrate;
    song.duration = fileMetadata.format.duration
      ? Math.trunc(fileMetadata.format.duration)
      : undefined;
    song.year = fileMetadata.common.year;
    song.genre = fileMetadata.common.genre ?? [];
    song.bpm = fileMetadata.common.bpm;
    song.mood = fileMetadata.common.mood;
    song.releaseDate = fileMetadata.common.releasedate;
    song.metadata = {};
    song.metadata["filePath"] = filePath;
    song.exists = true;
  }

  static #extractArtists(fileMetadata: IAudioMetadata): string[] | undefined {
    const albumArtists: string[] | undefined =
      fileMetadata.common?.albumartists;
    if (albumArtists && albumArtists.length > 0) {
      return albumArtists;
    }

    const albumArtist: string | undefined = fileMetadata.common?.albumartist;
    if (albumArtist) {
      return [albumArtist];
    }

    const artists: string[] | undefined = fileMetadata.common?.artists;
    if (artists && artists.length > 0) {
      return artists;
    }

    const artist: string | undefined = fileMetadata.common?.artist;
    if (artist) {
      return [artist];
    }

    return undefined;
  }
}
