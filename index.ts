/*
 * Created on Mon Jan 26 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { fastify } from "fastify";
import { RouteController } from "./routes/routeController";

const fastifyInstance = fastify({ logger: true });

const start = async () => {
  const rc = new RouteController();
  await rc.registerRoutes(fastifyInstance);

  // Run the server!
  fastifyInstance.listen({ port: 3000 }, (err) => {
    if (err) {
      fastifyInstance.log.error(err);
      process.exit(1);
    }
  });
};

start();