/*
 * Created on Wed Mar 25 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { RouteController } from "../../src/routes/routeController.js";

async function captureErrorHandler(
  logger: any,
): Promise<(...args: any[]) => Promise<void>> {
  const tempDir = await mkdtemp(
    path.join(os.tmpdir(), "error-handler-capture-"),
  );
  await mkdir(path.join(tempDir, "routes"), { recursive: true });

  let capturedHandler!: (...args: any[]) => Promise<void>;
  const fastifyInstance = {
    route: vi.fn(),
    register: vi.fn(),
    setErrorHandler: vi.fn((h) => {
      capturedHandler = h;
    }),
  };

  const origCwd = process.cwd();
  process.chdir(tempDir);
  try {
    const rc = new RouteController(logger);
    await rc.registerRoutes(fastifyInstance as any);
  } finally {
    process.chdir(origCwd);
    await rm(tempDir, { recursive: true, force: true });
  }

  return capturedHandler;
}

describe("RouteController", () => {
  describe("error handler", () => {
    let errorHandler: (...args: any[]) => Promise<void>;
    const logger = { info: vi.fn(), error: vi.fn() };

    beforeAll(async () => {
      errorHandler = await captureErrorHandler(logger);
    });

    afterAll(() => {
      vi.clearAllMocks();
    });

    it("uses error.statusCode when present", async () => {
      const send = vi.fn();
      const code = vi.fn().mockReturnValue({ send });
      await errorHandler({ statusCode: 400, message: "Bad input" }, {}, { code });
      expect(code).toHaveBeenCalledWith(400);
      expect(logger.error).toHaveBeenCalledWith("Unhandled route error: Bad input");
    });

    it("defaults to 500 when statusCode is missing", async () => {
      const send = vi.fn();
      const code = vi.fn().mockReturnValue({ send });
      await errorHandler({ message: "Something broke" }, {}, { code });
      expect(code).toHaveBeenCalledWith(500);
      expect(logger.error).toHaveBeenCalledWith("Unhandled route error: Something broke");
    });

    it("handles null error without throwing", async () => {
      const send = vi.fn();
      const code = vi.fn().mockReturnValue({ send });
      await errorHandler(null, {}, { code });
      expect(code).toHaveBeenCalledWith(500);
      expect(logger.error).toHaveBeenCalledWith("Unhandled route error: Internal Server Error");
    });

    it("logs the error message", async () => {
      const send = vi.fn();
      const code = vi.fn().mockReturnValue({ send });
      await errorHandler({ statusCode: 500, message: "DB timeout" }, {}, { code });
      expect(logger.error).toHaveBeenCalledWith("Unhandled route error: DB timeout");
    });
  });

  it("registers routes discovered by folder scan", async () => {
    const fastifyInstance = {
      route: vi.fn(),
      register: vi.fn(),
      setErrorHandler: vi.fn(),
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
