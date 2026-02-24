/*
 * Created on Mon Jan 26 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../types/route.js";
import { HealthzRoute } from "./healthz.js";
import { BrowseRoute } from "./browse.js";
import { ScanRoute } from "./scan.js";
import { StreamRoute } from "./stream.js";

export class RouteController {
  /**
   * Function to register all the routes into Fastify instance
   * @param {*} fastifyInstance
   */
  async registerRoutes(fastifyInstance) {
    await this.registerRoute(fastifyInstance, new HealthzRoute());
    await this.registerRoute(fastifyInstance, new BrowseRoute());
    await this.registerRoute(fastifyInstance, new ScanRoute());
    await this.registerRoute(fastifyInstance, new StreamRoute());
  }

  /**
   * Registers a route, based on the class passed as parameter
   * @param fastifyInstance The instance of Fastify to add the route to.
   * @param routeClass The Route definition.
   */
  async registerRoute(fastifyInstance, routeClass: Route) {
    fastifyInstance.route({
      method: routeClass.method,
      url: routeClass.url,
      schema: routeClass.schema,
      handler: routeClass.handler,
    });
  }
}
