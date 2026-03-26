/*
 * Created on Mon Jan 26 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import type { Logger } from "../server/logging.js";
import { Route } from "../types/route.js";
import { listFiles } from "../utils/fsUtils.js";
import path from "node:path";

export class RouteController {
  #logger: Logger;

  constructor(logger: Logger) {
    this.#logger = logger;
  }

  /**
   * Function to register all the routes into Fastify instance
   * @param fastifyInstance The Fastify instance
   */
  async registerRoutes(fastifyInstance: any): Promise<void> {
    const routeFiles: string[] = await this.getRouteFiles();

    for (const routeFile of routeFiles) {
      const routeModule = await import(routeFile);
      const route: Route = new routeModule.default();

      this.#logger.info(`Registering route: [${route.method}] ${route.url}`);
      await this.registerRoute(fastifyInstance, route);
    }
  }

  private async getRouteFiles(): Promise<string[]> {
    const routesFolder: string = path.resolve(process.cwd(), "routes");
    const files: string[] = await listFiles(routesFolder);

    return files.filter(
      (filePath: string) => !filePath.includes("routeController"),
    );
  }

  /**
   * Registers a route, based on the class passed as parameter
   * @param fastifyInstance The instance of Fastify to add the route to.
   * @param routeClass The Route definition.
   */
  async registerRoute(fastifyInstance: any, routeClass: Route): Promise<void> {
    fastifyInstance.route({
      method: routeClass.method,
      url: routeClass.url,
      schema: routeClass.schema,
      handler: routeClass.handler,
    });
  }
}
