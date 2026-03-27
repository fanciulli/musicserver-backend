/*
 * Created on Sat Mar 21 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Logger } from "../server/logging.js";
import { PluginManager } from "../plugins/pluginManager.js";
import { musicServerInstance } from "../server/musicServer.js";
import type { Database } from "../server/database.js";

export class Context {
  logger: Logger;
  pluginManager: PluginManager;
  database: Database;

  static create(): Context {
    const context = new Context();
    context.logger = musicServerInstance.getLogger();
    context.pluginManager = musicServerInstance.getPluginManager();
    context.database = musicServerInstance.getDatabase();
    return context;
  }
}
