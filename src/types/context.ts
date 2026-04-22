/*
 * Created on Sat Mar 21 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Logger } from "../server/logging.js";
import { PluginManager } from "../plugins/pluginManager.js";
import type { Db } from "mongodb";

export class Context {
  logger: Logger;
  pluginManager: PluginManager;
  database: Db;

  constructor(logger: Logger, pluginManager: PluginManager, database: Db) {
    this.logger = logger;
    this.pluginManager = pluginManager;
    this.database = database;
  }
}
