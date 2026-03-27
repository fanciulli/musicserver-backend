/*
 * Created on Sun Feb 01 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { PluginManager } from "../plugins/pluginManager.js";
import { fastify } from "fastify";
import type { FastifyInstance } from "fastify";
import { RouteController } from "../routes/routeController.js";
import { Database } from "./database.js";
import { Logger } from "./logging.js";
import { rm } from "node:fs/promises";
import { createRollingLogger } from "./loggingRollingTransport.js";

class MusicServer {
  #initDone: Boolean = false;
  #database: Database;
  #pluginManager: PluginManager;
  #fastifyInstance: FastifyInstance;
  #logger: Logger;

  async run(): Promise<void> {
    if (!this.#initDone) {
      this.#initDone = true;

      try {
        this.#logger = new Logger();
        this.#logger.info("Starting Music Server");

        await this.#startDatabase();
        await this.#startFastify();
        await this.#startPluginManager();
      } catch (err) {
        if (this.#logger) {
          this.#logger.error(
            `Error during Music Server initialization: ${err}`,
          );
        } else {
          console.error("Error during Music Server initialization:", err);
        }
        process.exit(1);
      }
    }
  }

  async #startFastify() {
    const logger = createRollingLogger("fastify");

    this.#fastifyInstance = fastify({ loggerInstance: logger });

    const rc = new RouteController(this.#logger);
    await rc.registerRoutes(this.#fastifyInstance);

    // Run the server!
    this.#fastifyInstance.listen({ port: 3000, host: "0.0.0.0" }, (err) => {
      if (err) {
        this.#fastifyInstance.log.error(err);
        process.exit(1);
      }
    });
  }

  async #startPluginManager() {
    this.#pluginManager = new PluginManager(process.env.PLUGIN_DIR);

    await this.#pluginManager.loadPlugins();
    await this.#pluginManager.startPlugins();
  }

  async #startDatabase(): Promise<void> {
    this.#database = new Database();
    await this.#database.start();
  }

  getPluginManager(): PluginManager {
    return this.#pluginManager;
  }

  getDatabase(): Database {
    return this.#database;
  }

  getLogger(): Logger {
    return this.#logger;
  }
}

var musicServerInstance: MusicServer;

if (musicServerInstance === undefined) {
  musicServerInstance = new MusicServer();
}

export { musicServerInstance };
