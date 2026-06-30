/*
 * Created on Mon Jan 26 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import type { Logger as PinoLogger } from "pino";
import type { Context } from "../types/context.js";
import type { FastifyInstance } from "fastify";
import { Route } from "../types/route.js";
import { listFiles } from "../utils/fsUtils.js";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { apiKeyPlugin } from "fastify-auth-by-api-key";
import { validateApiKey } from "../utils/apiKeyUtils.js";
import {
  extractUsernameFromToken,
  hashToken,
} from "../utils/sessionAuthUtils.js";
import { UserSessionDbModel } from "../types/db/userSession.js";

export class RouteController {
  #logger: PinoLogger;
  #context?: Context;

  constructor(logger: PinoLogger, context?: Context) {
    this.#logger = logger;
    this.#context = context;
  }

  /**
   * Function to register all the routes into Fastify instance
   * @param fastifyInstance The Fastify instance
   */
  async registerRoutes(fastifyInstance: FastifyInstance): Promise<void> {
    fastifyInstance.setErrorHandler(
      async (error: any, _request: any, reply: any) => {
        const statusCode: number = error?.statusCode ?? 500;
        const errorMessage: string = error?.message ?? "Internal Server Error";
        this.#logger.error(`Unhandled route error: ${errorMessage}`);
        await reply.code(statusCode).send();
      },
    );

    const routeFiles: string[] = await this.getRouteFiles();
    const allRoutes: Route[] = [];

    for (const routeFile of routeFiles) {
      const routeModule = await import(pathToFileURL(routeFile).href);
      const route: Route = new routeModule.default(this.#context);
      allRoutes.push(route);
    }

    const publicRoutes = allRoutes.filter((r) => !r.requiresAuth);
    const apiKeyRoutes = allRoutes.filter(
      (r) => r.requiresAuth && !r.url.startsWith("/admin"),
    );
    const adminRoutes = allRoutes.filter(
      (r) => r.requiresAuth && r.url.startsWith("/admin"),
    );

    for (const route of publicRoutes) {
      this.#logger.info(
        `Registering public route: [${route.method}] ${route.url}`,
      );
      await this.registerRoute(fastifyInstance, route);
    }

    await fastifyInstance.register(async (app) => {
      const db = this.#context!.database;
      await app.register(apiKeyPlugin, {
        checkApiKey: (key: string) => validateApiKey(db, key),
        allowInHeader: true,
        allowAsQueryParameter: true,
      });

      for (const route of apiKeyRoutes) {
        this.#logger.info(
          `Registering api-key-auth route: [${route.method}] ${route.url}`,
        );
        await this.registerRoute(app, route);
      }
    });

    await fastifyInstance.register(async (app) => {
      const db = this.#context!.database;

      app.addHook("onRequest", async (request: any, reply: any) => {
        const authHeader = request.headers["authorization"] as
          | string
          | undefined;
        const token = authHeader?.startsWith("Bearer ")
          ? authHeader.slice(7)
          : null;

        if (!token) {
          return reply.code(401).send();
        }

        const username = extractUsernameFromToken(token);
        if (!username) {
          return reply.code(401).send();
        }

        const hash = hashToken(token);
        const session = await UserSessionDbModel.findValid(db, username, hash);
        if (!session) {
          return reply.code(401).send();
        }

        (request as any).username = username;
      });

      for (const route of adminRoutes) {
        this.#logger.info(
          `Registering session-auth admin route: [${route.method}] ${route.url}`,
        );
        await this.registerRoute(app, route);
      }
    });
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
