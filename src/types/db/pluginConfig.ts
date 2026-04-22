/*
 * Created on Thu Mar 27 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Db } from "mongodb";
import type { PluginConfigurationValues } from "../plugins/plugin.js";

const COLLECTION_NAME = "pluginConfigs";

export class PluginConfigDBModel {
  pluginCategory: string = "";
  pluginId: string = "";
  settings: PluginConfigurationValues = {} as PluginConfigurationValues;

  static async findByPluginId(
    db: Db,
    pluginCategory: string,
    pluginId: string,
  ): Promise<PluginConfigDBModel | undefined> {
    const collection = db.collection<PluginConfigDBModel>(COLLECTION_NAME);

    const pluginConfig = await collection.findOne({
      pluginCategory,
      pluginId,
    });
    return pluginConfig ? pluginConfig : undefined;
  }

  static async upsertSettings(
    db: Db,
    pluginCategory: string,
    pluginId: string,
    settings: PluginConfigurationValues,
  ): Promise<void> {
    const collection = db.collection<PluginConfigDBModel>(COLLECTION_NAME);

    await collection.updateOne(
      {
        pluginCategory,
        pluginId,
      },
      {
        $set: {
          pluginCategory,
          pluginId,
          settings,
        },
      },
      { upsert: true },
    );
  }
}

export function init(db: Db): void {}
