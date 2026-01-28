/*
 * Created on Mon Jan 26 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { IRoute, Route } from "../types/route";
import { HealthzRoute } from "./healthz";
import { BrowseRoute } from "./browse";

export class RouteController {
  /**
   * Function to register all the routes into Fastify instance
   * @param {*} fastifyInstance
   */
  async registerRoutes(fastifyInstance) {
    await this.registerRoute(fastifyInstance, new HealthzRoute());
    await this.registerRoute(fastifyInstance, new BrowseRoute());
  }

  async registerRoute(fastifyInstance, routeClass: Route) {
    fastifyInstance.route({
      method: routeClass.method,
      url: routeClass.url,
      handler: routeClass.handler,
    });
  }
}
