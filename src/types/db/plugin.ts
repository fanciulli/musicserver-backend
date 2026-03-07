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
  STOPPED = "stopped",
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

    const pluginInDb = await this.find(db, pluginCategory, pluginId);
    if (!pluginInDb) {
      const doc = {
        $set: {
          id: v4(),
          name: name,
          pluginCategory: pluginCategory,
          pluginId: pluginId,
          status: PluginStatus.STOPPED,
        },
      };
      await collection.updateOne(filter, doc, { upsert: true });
      return await collection.findOne(filter);
    } else {
      return pluginInDb;
    }
  }

  static async setStatus(
    db: Db,
    category: string,
    id: string,
    status: PluginStatus,
  ): Promise<void> {
    const collection = db.collection<PluginDBModel>(COLLECTION_NAME);
    await collection.updateOne(
      {
        pluginCategory: category,
        pluginId: id,
      },
      {
        $set: {
          status,
        },
      },
    );
  }
}

export function init(db: Db): void {}
