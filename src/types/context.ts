/*
 * Created on Sat Mar 21 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import type { Logger as PinoLogger } from "pino";
import { PluginManager } from "../plugins/pluginManager.js";
import type { Db } from "mongodb";

export class Context {
  logger: PinoLogger;
  pluginManager?: PluginManager;
  database: Db;

  constructor(logger: PinoLogger, pluginManager: PluginManager, database: Db) {
    this.logger = logger;
    if (pluginManager !== undefined) {
      this.pluginManager = pluginManager;
    }
    this.database = database;
  }
}
