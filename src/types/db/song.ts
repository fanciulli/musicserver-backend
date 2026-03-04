/*
 * Created on Sat Feb 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";

const COLLECTION_NAME = "songs";

export class SongDbModel {
  id: string;
  name: string;
  pluginId: string;
  album: string;
  albumId: string;
  artist: string;
  artistsId: string[];
  trackNumber: number;
  diskNumber: number;
  metadata: object;

  static async findById(db: Db, id: string): Promise<SongDbModel> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    return await collection.findOne({
      id: id,
    });
  }

  static async findByIdAndPluginId(
    db: Db,
    id: string,
    pluginId: string,
  ): Promise<SongDbModel> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    return await collection.findOne({
      id: id,
      pluginId: pluginId,
    });
  }

  static async find(
    db: Db,
    name: string,
    pluginId: string,
  ): Promise<SongDbModel> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    const filter = {
      name: name,
      pluginId: pluginId,
    };
    return await collection.findOne(filter);
  }

  static async findSongsByAlbumId(
    db: Db,
    albumId: string,
    pluginId: string,
  ): Promise<Array<SongDbModel>> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    return await collection
      .find(
        {
          albumId: albumId,
          pluginId: pluginId,
        },
        {},
      )
      .toArray();
  }

  static async findSongsByPluginId(
    db: Db,
    pluginId: string,
  ): Promise<Array<SongDbModel>> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    return await collection
      .find(
        {
          pluginId: pluginId,
        },
        {},
      )
      .toArray();
  }

  static async findSongsByStartingLetter(
    db: Db,
    pluginId: string,
    letter: string,
  ): Promise<Array<SongDbModel>> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    return await collection
      .find(
        {
          pluginId: pluginId,
          name: { $regex: `^${letter}.*`, $options: "i" },
        },
        {},
      )
      .toArray();
  }

  static async findSongsByArtistId(
    db: Db,
    artistId: string,
    pluginId: string,
  ): Promise<Array<SongDbModel>> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);
    return await collection
      .find(
        {
          artistsId: artistId,
          pluginId: pluginId,
        },
        {},
      )
      .toArray();
  }

  async insert(db: Db): Promise<void> {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);

    await collection.insertOne(this);
  }

  static async deleteAll(db: Db, pluginId: string) {
    const collection = db.collection<SongDbModel>(COLLECTION_NAME);

    await collection.deleteMany({});
  }
}

export function init(db: Db): void {}
