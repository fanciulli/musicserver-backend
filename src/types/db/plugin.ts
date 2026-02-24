/*
 * Created on Mon Feb 09 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";
import { v4 } from "uuid";

export enum PluginStatus {
  LOADED = "loaded",
  STARTED = "started",
  ERROR = "error",
  DISABLED = "disabled",
}

const COLLECTION_NAME = "plugins";

export class PluginDBModel {
  name: string;
  pluginCategory: string;
  pluginId: string;
  status: PluginStatus;

  static async find(
    db: Db,
    category: string,
    id: string,
  ): Promise<PluginDBModel> {
    const collection = db.collection<PluginDBModel>(COLLECTION_NAME);

    return await collection.findOne({
      pluginCategory: category,
      pluginId: id,
    });
  }

  static async assertPluginIsRegisteredInDB(
    db: Db,
    name: string,
    pluginCategory: string,
    pluginId: string,
  ): Promise<PluginDBModel> {
    const collection = db.collection<PluginDBModel>(COLLECTION_NAME);
    const filter = {
      name: name,
      pluginId: pluginId,
    };
    const doc = {
      $set: {
        id: v4(),
        name: name,
        pluginCategory: pluginCategory,
        pluginId: pluginId,
        status: PluginStatus.STARTED,
      },
    };
    await collection.updateOne(filter, doc, { upsert: true });

    return await collection.findOne(filter);
  }
}

export function init(db: Db): void {}
