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
import { createRollingLogger } from "./loggingRollingTransport.js";
import { Context } from "../types/context.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

export class MusicServer {
  #initDone: boolean = false;
  #database?: Database;
  #pluginManager?: PluginManager;
  #fastifyInstance?: FastifyInstance;
  #logger: Logger = new Logger();

  async run(): Promise<void> {
    if (!this.#initDone) {
      this.#initDone = true;

      try {
        this.#logger.info("Starting Music Server");

        await this.#startDatabase();
        await this.#startPluginManager();
        await this.#startFastify();
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

    this.#fastifyInstance = fastify({ loggerInstance: logger }) as unknown as FastifyInstance;

    const context = new Context(
      this.#logger,
      this.#pluginManager!,
      this.#database!.client!,
    );
    const rc = new RouteController(this.#logger, context);
    await rc.registerRoutes(this.#fastifyInstance);

    // Run the server!
    this.#fastifyInstance!.listen({ port: 3000, host: "0.0.0.0" }, (err) => {
      if (err) {
        this.#fastifyInstance!.log.error(err);
        process.exit(1);
      }
    });
  }

  async #startPluginManager() {
    const pluginsDir = path.join(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
      "plugins",
    );

    const context = new Context(
      this.#logger,
      undefined,
      this.#database!.client!,
    );
    this.#pluginManager = new PluginManager(pluginsDir, context);
    context.pluginManager = this.#pluginManager;

    await this.#pluginManager.loadPlugins();
    await this.#pluginManager.startPlugins();
  }

  async #startDatabase(): Promise<void> {
    this.#database = new Database();
    await this.#database.start();
  }
}

export const musicServerInstance = new MusicServer();
