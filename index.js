/*
 * Created on Mon Jan 26 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
const fastify = require("fastify")({ logger: true });
const routeController = require("./routes/routeController");

const start = async () => {
  const rc = new routeController();
  await rc.registerRoutes(fastify);

  // Run the server!
  fastify.listen({ port: 3000 }, (err) => {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  });
};

start();