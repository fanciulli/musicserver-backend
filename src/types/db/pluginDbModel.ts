/*
 * Created on Mon Feb 09 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Sequelize, DataTypes, Model } from "sequelize";

export enum PluginStatus {
  LOADED = "loaded",
  STARTED = "started",
  ERROR = "error",
  DISABLED = "disabled",
}

export class PluginDBModel extends Model {
  declare name: string;
  declare pluginCategory: string;
  declare pluginId: string;
  declare status: PluginStatus;

  static async find(category: string, id: string): Promise<PluginDBModel> {
    const result: PluginDBModel = await PluginDBModel.findOne({
      where: {
        plugin_category: category,
        plugin_id: id,
      },
    });
    return result;
  }

  static async createPlugin(
    name: string,
    pluginCategory: string,
    pluginId: string,
    status: PluginStatus,
  ): Promise<PluginDBModel> {
    const plugin = PluginDBModel.create({
      name: name,
      pluginCategory: pluginCategory,
      pluginId: pluginId,
      status: status,
    });

    return plugin;
  }

  static async assertPluginIsRegisteredInDB(
    name: string,
    category: string,
    id: string,
  ): Promise<PluginDBModel> {
    const result: PluginDBModel = await PluginDBModel.find(category, id);
    if (!result) {
      return await PluginDBModel.createPlugin(
        name,
        category,
        id,
        PluginStatus.STARTED, // This should be LOADED instead and have a way to start plugin. To finalize later
      );
    } else {
      return result;
    }
  }
}

export function init(sequelize: Sequelize): void {
  PluginDBModel.init(
    {
      name: {
        type: DataTypes.STRING,
        field: "name",
      },
      pluginCategory: {
        type: DataTypes.STRING,
        field: "plugin_category",
      },
      pluginId: {
        type: DataTypes.STRING,
        field: "plugin_id",
      },
      status: {
        type: DataTypes.STRING,
        field: "status",
      },
    },
    { sequelize: sequelize, tableName: "plugins" },
  );
}
