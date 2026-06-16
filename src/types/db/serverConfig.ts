/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";
import type { ConfigValue } from "../../misc/configRegistry.js";

const COLLECTION_NAME = "serverConfig";

export interface ServerConfigEntry {
  key: string;
  value: ConfigValue;
}

export class ServerConfigDBModel {
  static async findAll(db: Db): Promise<ServerConfigEntry[]> {
    const collection = db.collection<ServerConfigEntry>(COLLECTION_NAME);
    return collection.find({}).toArray();
  }

  static async upsertMany(db: Db, entries: ServerConfigEntry[]): Promise<void> {
    const collection = db.collection<ServerConfigEntry>(COLLECTION_NAME);
    for (const entry of entries) {
      await collection.updateOne(
        { key: entry.key },
        { $set: { key: entry.key, value: entry.value } },
        { upsert: true },
      );
    }
  }
}

export function init(db: Db): void {}
