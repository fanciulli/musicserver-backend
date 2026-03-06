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

class MusicServer {
  #initDone: Boolean = false;
  #database?: Database;
  #pluginManager?: PluginManager;
  #fastifyInstance?: FastifyInstance;
  #logger?: Logger;

  async start(): Promise<void> {
    if (!this.#initDone) {
      this.#initDone = true;

      this.#logger = new Logger();
      this.#logger.info("Starting Music Server");

      const database_connected = await this.#startDatabase();
      if (database_connected === false) {
        this.#logger.error(
          "Exiting application because connection to database failed",
        );
        process.exit(1);
      }

      await this.#startFastify();
      await this.#startPluginManager();
    }
  }

  async #startFastify() {
    this.#fastifyInstance = fastify({ logger: true });

    const rc = new RouteController();
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

  async #startDatabase(): Promise<Boolean> {
    this.#database = new Database();
    return await this.#database.start();
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
