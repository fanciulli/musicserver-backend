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
import { createDatabaseLogger } from "./loggingMongoTransport.js";
import type { Logger as PinoLogger } from "pino";
import { Context } from "../types/context.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadTlsConfig } from "../utils/tlsUtils.js";

export class MusicServer {
  #initDone: boolean = false;
  #database?: Database;
  #pluginManager?: PluginManager;
  #fastifyInstance?: FastifyInstance;
  #logger?: PinoLogger;

  async run(): Promise<void> {
    if (!this.#initDone) {
      this.#initDone = true;

      try {
        await this.#startDatabase();
        this.#logger = createDatabaseLogger("main", this.#database!.client!);
        this.#logger.info("Starting Music Server");
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
    const logger = createDatabaseLogger("fastify", this.#database!.client!);
    const tlsConfig = await loadTlsConfig();

    this.#fastifyInstance = fastify({
      loggerInstance: logger,
      ...(tlsConfig ? { https: tlsConfig } : {}),
    }) as unknown as FastifyInstance;

    const context = new Context(
      this.#logger!,
      this.#pluginManager!,
      this.#database!.client!,
    );
    const rc = new RouteController(this.#logger!, context);
    await rc.registerRoutes(this.#fastifyInstance);

    this.#fastifyInstance!.listen({ port: 3000, host: "0.0.0.0" }, (err) => {
      if (err) {
        console.log(`Cannot start Music Server becase: ${err.message}`);
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
      this.#logger!,
      [] as any,
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
