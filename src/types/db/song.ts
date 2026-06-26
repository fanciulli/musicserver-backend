/*
 * Created on Sat Feb 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";

const COLLECTION_NAME = "songs";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class SongDbModel {
  id?: string;
  name?: string;
  pluginId?: string;
  album?: string;
  albumId?: string;
  artist?: string;
  artistsId?: string[];
  trackNumber?: number;
  diskNumber?: number;
  metadata?: Record<string, any>;
  exists?: boolean;
  year?: number;
  genre?: string[];
  bpm?: number;
  mood?: string;
  releaseDate?: string;
  sampleRate?: number;
  bitRate?: number;
  format?: string;
  duration?: number;

  static fromJson(json: Partial<SongDbModel>): SongDbModel {
    const song = new SongDbModel();
    song.id = json.id;
    song.name = json.name;
    song.pluginId = json.pluginId;
    song.album = json.album;
    song.albumId = json.albumId;
    song.artist = json.artist;
    song.artistsId = json.artistsId;
    song.trackNumber = json.trackNumber;
    song.diskNumber = json.diskNumber;
    song.metadata = json.metadata;
    song.exists = json.exists;
    song.year = json.year;
    song.genre = json.genre;
    song.bpm = json.bpm;
    song.mood = json.mood;
    song.releaseDate = json.releaseDate;
    song.sampleRate = json.sampleRate;
    song.bitRate = json.bitRate;
    song.format = json.format;
    song.duration = json.duration;
    return song;
  }

  static async findById(db: Db, id: string): Promise<SongDbModel | undefined> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    const song = await collection.findOne({
      id: id,
    });

    return song ? SongDbModel.fromJson(song) : undefined;
  }

  static async findByIdAndPluginId(
    db: Db,
    id: string,
    pluginId: string,
  ): Promise<SongDbModel | undefined> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    const song = await collection.findOne({
      id: id,
      pluginId: pluginId,
    });

    return song ? SongDbModel.fromJson(song) : undefined;
  }

  static async find(
    db: Db,
    name: string,
    pluginId: string,
    albumId?: string,
  ): Promise<SongDbModel | undefined> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    const filter: Record<string, any> = {
      name: name,
      pluginId: pluginId,
    };
    if (albumId !== undefined) {
      filter["albumId"] = albumId;
    }
    const song = await collection.findOne(filter);
    return song ? SongDbModel.fromJson(song) : undefined;
  }

  static async findSongsByAlbumId(
    db: Db,
    albumId: string,
    pluginId?: string,
  ): Promise<Array<SongDbModel>> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    const filter: Partial<Pick<SongDbModel, "albumId" | "pluginId">> = {
      albumId,
    };
    if (pluginId !== undefined) {
      filter.pluginId = pluginId;
    }
    const songs = await collection
      .find(filter, {})
      .sort({ diskNumber: 1, trackNumber: 1 })
      .toArray();

    return songs.map((song) => SongDbModel.fromJson(song));
  }

  static async findSongsByPluginId(
    db: Db,
    pluginId: string,
  ): Promise<Array<SongDbModel>> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    const songs = await collection
      .find(
        {
          pluginId: pluginId,
        },
        {},
      )
      .toArray();

    return songs.map((song) => SongDbModel.fromJson(song));
  }

  static async findSongsByStartingLetter(
    db: Db,
    pluginId: string,
    letter: string,
  ): Promise<Array<SongDbModel>> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    const songs = await collection
      .find(
        {
          pluginId: pluginId,
          name: { $regex: `^${letter}.*`, $options: "i" },
        },
        {},
      )
      .toArray();

    return songs.map((song) => SongDbModel.fromJson(song));
  }

  static async findSongsByArtistId(
    db: Db,
    artistId: string,
    pluginId: string,
  ): Promise<Array<SongDbModel>> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    const songs = await collection
      .find(
        {
          artistsId: artistId,
          pluginId: pluginId,
        },
        {},
      )
      .toArray();

    return songs.map((song) => SongDbModel.fromJson(song));
  }

  static async findSongsByQuery(
    db: Db,
    pluginId: string,
    query: string,
  ): Promise<Array<SongDbModel>> {
    const normalizedQuery = query.trim();
    if (normalizedQuery === "") {
      return [];
    }

    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    const songs = await collection
      .find(
        {
          pluginId: pluginId,
          $or: [
            {
              name: { $regex: escapeRegex(normalizedQuery), $options: "i" },
            },
            {
              title: { $regex: escapeRegex(normalizedQuery), $options: "i" },
            },
          ],
        },
        {},
      )
      .toArray();

    return songs.map((song) => SongDbModel.fromJson(song));
  }

  async insert(db: Db): Promise<void> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);

    await collection.insertOne(this);
  }

  async update(db: Db): Promise<void> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    await collection.updateOne(
      { id: this.id },
      { $set: this },
      { ignoreUndefined: true },
    );
  }

  static async deleteAll(db: Db, pluginId: string) {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);

    await collection.deleteMany({ pluginId: pluginId });
  }

  static async markAllAsNotExisting(db: Db, pluginId: string): Promise<void> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    await collection.updateMany(
      { pluginId: pluginId },
      { $set: { exists: false } },
    );
  }

  static async deleteNotExisting(db: Db, pluginId: string): Promise<void> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    await collection.deleteMany({ pluginId: pluginId, exists: false });
  }

  static async count(db: Db, pluginId?: string): Promise<number> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    const filter = pluginId !== undefined ? { pluginId: pluginId } : {};
    return collection.countDocuments(filter);
  }

}

export function init(db: Db): void {}
