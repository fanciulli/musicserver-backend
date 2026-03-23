/*
 * Created on Mon Mar 23 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rmError: null as Error | null,
  loggerCtorError: null as Error | null,
  databaseStartError: null as Error | null,
  registerRoutesError: null as Error | null,
  loadPluginsError: null as Error | null,
  startPluginsError: null as Error | null,
}));

const spies = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerError: vi.fn(),
  consoleError: vi.fn(),
  processExit: vi.fn(),
  rm: vi.fn(),
  databaseStart: vi.fn(),
  registerRoutes: vi.fn(),
  fastifyListen: vi.fn(),
  fastifyFactory: vi.fn(),
  pluginManagerCtor: vi.fn(),
  loadPlugins: vi.fn(),
  startPlugins: vi.fn(),
  pinoTransport: vi.fn(),
  pinoFactory: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  rm: (...args: unknown[]) => {
    spies.rm(...args);

    if (state.rmError) {
      return Promise.reject(state.rmError);
    }

    return Promise.resolve();
  },
}));

vi.mock("../../src/server/logging.js", () => ({
  Logger: class MockLogger {
    constructor() {
      if (state.loggerCtorError) {
        throw state.loggerCtorError;
      }
    }

    info(message: string) {
      spies.loggerInfo(message);
    }

    error(message: string) {
      spies.loggerError(message);
    }
  },
}));

vi.mock("../../src/server/database.js", () => ({
  Database: class MockDatabase {
    async start() {
      spies.databaseStart();

      if (state.databaseStartError) {
        throw state.databaseStartError;
      }

      return true;
    }
  },
}));

vi.mock("../../src/routes/routeController.js", () => ({
  RouteController: class MockRouteController {
    async registerRoutes(instance: unknown) {
      spies.registerRoutes(instance);

      if (state.registerRoutesError) {
        throw state.registerRoutesError;
      }
    }
  },
}));

vi.mock("fastify", () => ({
  fastify: (options: unknown) => {
    spies.fastifyFactory(options);

    const instance = {
      listen: (listenOptions: unknown, callback: (err?: unknown) => void) => {
        spies.fastifyListen(listenOptions);
        callback(undefined);
      },
      log: {
        error: vi.fn(),
      },
    };

    return instance;
  },
}));

vi.mock("../../src/plugins/pluginManager.js", () => ({
  PluginManager: class MockPluginManager {
    constructor(pluginDir: string | undefined) {
      spies.pluginManagerCtor(pluginDir);
    }

    async loadPlugins() {
      spies.loadPlugins();

      if (state.loadPluginsError) {
        throw state.loadPluginsError;
      }
    }

    async startPlugins() {
      spies.startPlugins();

      if (state.startPluginsError) {
        throw state.startPluginsError;
      }
    }
  },
}));

vi.mock("pino", () => {
  const pinoMock = Object.assign(
    (...args: unknown[]) => spies.pinoFactory(...args),
    {
      transport: (...args: unknown[]) => spies.pinoTransport(...args),
    },
  );

  return {
    default: pinoMock,
  };
});

describe("MusicServer.run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    state.rmError = null;
    state.loggerCtorError = null;
    state.databaseStartError = null;
    state.registerRoutesError = null;
    state.loadPluginsError = null;
    state.startPluginsError = null;

    spies.pinoTransport.mockReturnValue("transport-instance");
    spies.pinoFactory.mockReturnValue("pino-instance");

    vi.spyOn(console, "error").mockImplementation(spies.consoleError);
    vi.spyOn(process, "exit").mockImplementation(spies.processExit as never);
  });

  it("completes startup successfully", async () => {
    const { musicServerInstance } =
      await import("../../src/server/musicServer.js");

    await expect(musicServerInstance.run()).resolves.toBeUndefined();

    expect(spies.loggerInfo).toHaveBeenCalledWith("Starting Music Server");
    expect(spies.databaseStart).toHaveBeenCalledTimes(1);
    expect(spies.registerRoutes).toHaveBeenCalledTimes(1);
    expect(spies.loadPlugins).toHaveBeenCalledTimes(1);
    expect(spies.startPlugins).toHaveBeenCalledTimes(1);
    expect(spies.loggerError).not.toHaveBeenCalled();
    expect(spies.consoleError).not.toHaveBeenCalled();
    expect(spies.processExit).not.toHaveBeenCalled();
  });

  it("handles #createLogger exception with console error and exit code 1", async () => {
    const loggerError = new Error("create logger failed");
    state.rmError = loggerError;

    const { musicServerInstance } =
      await import("../../src/server/musicServer.js");

    await expect(musicServerInstance.run()).resolves.toBeUndefined();

    expect(spies.consoleError).toHaveBeenCalledWith(
      "Error during Music Server initialization:",
      loggerError,
    );
    expect(spies.loggerError).not.toHaveBeenCalled();
    expect(spies.processExit).toHaveBeenCalledWith(1);
  });

  it("handles #startDatabase exception with logger.error and exit code 1", async () => {
    const databaseError = new Error("database start failed");
    state.databaseStartError = databaseError;

    const { musicServerInstance } =
      await import("../../src/server/musicServer.js");

    await expect(musicServerInstance.run()).resolves.toBeUndefined();

    expect(spies.loggerError).toHaveBeenCalledTimes(1);
    expect(spies.loggerError.mock.calls[0][0]).toContain(
      "Error during Music Server initialization:",
    );
    expect(spies.consoleError).not.toHaveBeenCalled();
    expect(spies.processExit).toHaveBeenCalledWith(1);
  });

  it("handles #startFastify exception with logger.error and exit code 1", async () => {
    const fastifyError = new Error("register routes failed");
    state.registerRoutesError = fastifyError;

    const { musicServerInstance } =
      await import("../../src/server/musicServer.js");

    await expect(musicServerInstance.run()).resolves.toBeUndefined();

    expect(spies.loggerError).toHaveBeenCalledTimes(1);
    expect(spies.loggerError.mock.calls[0][0]).toContain(
      "Error during Music Server initialization:",
    );
    expect(spies.consoleError).not.toHaveBeenCalled();
    expect(spies.processExit).toHaveBeenCalledWith(1);
  });

  it("handles #startPluginManager exception with logger.error and exit code 1", async () => {
    const pluginError = new Error("start plugins failed");
    state.startPluginsError = pluginError;

    const { musicServerInstance } =
      await import("../../src/server/musicServer.js");

    await expect(musicServerInstance.run()).resolves.toBeUndefined();

    expect(spies.loggerError).toHaveBeenCalledTimes(1);
    expect(spies.loggerError.mock.calls[0][0]).toContain(
      "Error during Music Server initialization:",
    );
    expect(spies.consoleError).not.toHaveBeenCalled();
    expect(spies.processExit).toHaveBeenCalledWith(1);
  });
});
