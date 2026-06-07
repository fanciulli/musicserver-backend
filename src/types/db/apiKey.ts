/*
 * Created on Thu May 22 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";
import { v4 } from "uuid";

const COLLECTION_NAME = "apiKeys";

export class ApiKeyDbModel {
  id: string = v4();
  name: string = "";
  keyHash: string = "";
  keyPrefix: string = "";
  createdAt: Date = new Date();
  expiresAt: Date | null = null;

  static async findByHash(
    db: Db,
    hash: string,
  ): Promise<ApiKeyDbModel | undefined> {
    const result = await db
      .collection<ApiKeyDbModel>(COLLECTION_NAME)
      .findOne({ keyHash: hash });
    return result ?? undefined;
  }

  static async findAll(db: Db): Promise<Omit<ApiKeyDbModel, "keyHash">[]> {
    return db
      .collection<ApiKeyDbModel>(COLLECTION_NAME)
      .find({})
      .project<Omit<ApiKeyDbModel, "keyHash">>({ keyHash: 0 })
      .toArray();
  }

  static async deleteById(db: Db, id: string): Promise<boolean> {
    const result = await db
      .collection<ApiKeyDbModel>(COLLECTION_NAME)
      .deleteOne({ id });
    return result.deletedCount > 0;
  }

  async insert(db: Db): Promise<void> {
    await db.collection<ApiKeyDbModel>(COLLECTION_NAME).insertOne(this);
  }
}

export function init(db: Db): void {
  void db.collection(COLLECTION_NAME).createIndex({ keyHash: 1 });
  void db.collection(COLLECTION_NAME).createIndex({ id: 1 });
}
