/*
 * Created on Mon Jan 26 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
const healthz = require("./healthz");

class RouteController {
  async registerRoutes(fastifyInstance) {
    await this.registerRoute(fastifyInstance, "GET", "/healthz", healthz);
  }

  async registerRoute(fastifyInstance, method, url, handler) {
    fastifyInstance.route({ method: method, url: url, handler: handler });
  }
}

module.exports = RouteController;
