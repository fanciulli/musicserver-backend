/*
 * Created on Wed Mar 25 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { RouteController } from "../../src/routes/routeController.js";

describe("RouteController", () => {
  it("registers routes discovered by folder scan", async () => {
    const fastifyInstance = {
      route: vi.fn(),
      register: vi.fn(),
    };
    const logger = {
      info: vi.fn(),
    };
    const temporaryRootFolder = await mkdtemp(
      path.join(os.tmpdir(), "route-controller-test-"),
    );
    const routesFolder = path.join(temporaryRootFolder, "routes");
    const mockRouteUrl = "/mock-route";

    await mkdir(routesFolder, { recursive: true });
    await writeFile(
      path.join(routesFolder, "mockRoute.js"),
      `export default class MockRoute {
  method = "GET";
  url = "${mockRouteUrl}";
  schema = {};
  handler = async () => undefined;
}
`,
    );

    const originalWorkingDirectory = process.cwd();

    try {
      process.chdir(temporaryRootFolder);

      const routeController = new RouteController(logger as any);
      await routeController.registerRoutes(fastifyInstance);

      const registeredUrls = fastifyInstance.route.mock.calls.map(
        (call: Array<any>) => call[0].url,
      );

      expect(registeredUrls).toContain(mockRouteUrl);
    } finally {
      process.chdir(originalWorkingDirectory);
      await rm(temporaryRootFolder, { recursive: true, force: true });
    }
  });
});
