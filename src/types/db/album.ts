/*
 * Created on Sat Feb 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";

const COLLECTION_NAME = "albums";

export class AlbumDbModel {
  id: string;
  name: string;
  pluginId: string;
  artists: string[];

  static async deleteAll(db: Db, pluginId: string) {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);

    await collection.deleteMany({});
  }

  static async find(
    db: Db,
    name: string,
    pluginId: string,
  ): Promise<AlbumDbModel> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);

    return await collection.findOne({
      name: name,
      pluginId: pluginId,
    });
  }

  async insert(db: Db): Promise<void> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);

    await collection.insertOne(this);
  }

  static async findAlbumsByPluginId(
    db: Db,
    pluginId: string,
  ): Promise<Array<AlbumDbModel>> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);

    return await collection
      .find({
        pluginId: pluginId,
      })
      .toArray();
  }

  static async findAlbumsByStartingLetter(
    db: Db,
    pluginId: string,
    letter: string,
  ): Promise<Array<AlbumDbModel>> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);

    return await collection
      .find({
        pluginId: pluginId,
        name: { $regex: `^${letter}.*`, $options: "i" },
      })
      .toArray();
  }

  static async findAlbumsByArtistId(
    db: Db,
    pluginId: string,
    artistId: string,
  ): Promise<Array<AlbumDbModel>> {
    const collection = db.collection<AlbumDbModel>(COLLECTION_NAME);

    return await collection
      .find({
        pluginId: pluginId,
        artists: artistId,
      })
      .toArray();
  }
}

export function init(db: Db): void {}
