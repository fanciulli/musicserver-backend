/*
 * Created on Sun Feb 01 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { PluginManager } from "./plugins/pluginManager";
import { fastify, FastifyInstance } from "fastify";
import { RouteController } from "./routes/routeController";

class MusicServer {
    #initDone: Boolean = false;
    #pluginManager?: PluginManager;
    #fastifyInstance?: FastifyInstance;

    async start(): Promise<void> {
        if (!this.#initDone) {
            this.#initDone = true;

            await this.#startFastify();
            await this.#startPluginManager();
        }
    }

    async #startFastify() {
        this.#fastifyInstance = fastify({ logger: true });

        const rc = new RouteController();
        await rc.registerRoutes(this.#fastifyInstance);

        // Run the server!
        this.#fastifyInstance.listen({ port: 3000 }, (err) => {
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

    getPluginManager(): PluginManager {
        return this.#pluginManager;
    }
}

var musicServerInstance: MusicServer;

if (musicServerInstance === undefined) {
    musicServerInstance = new MusicServer();
}

export { musicServerInstance };
