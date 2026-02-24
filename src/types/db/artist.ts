/*
 * Created on Mon Feb 16 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";

const COLLECTION_NAME = "artists";

export class ArtistDbModel {
  id: string;
  name: string;
  pluginId: string;

  static async find(
    db: Db,
    name: string,
    pluginId: string,
  ): Promise<ArtistDbModel> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);
    const filter = {
      name: name,
      pluginId: pluginId,
    };
    return await collection.findOne(filter);
  }

  static async findById(db: Db, ids: string[]): Promise<ArtistDbModel[]> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);
    const filter = {
      id: { $in: ids },
    };
    return (await collection.find(filter)).toArray();
  }

  async insert(db: Db): Promise<void> {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);

    await collection.insertOne(this);
  }

  static async deleteAll(db: Db, pluginId: string) {
    const collection = db.collection<ArtistDbModel>(COLLECTION_NAME);

    await collection.deleteMany({});
  }
}

export function init(db: Db): void {
  //db.collection(COLLECTION_NAME).createIndex()
}
