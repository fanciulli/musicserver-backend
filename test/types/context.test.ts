/*
 * Created on Mon Mar 23 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const spies = vi.hoisted(() => ({
  getLogger: vi.fn(),
  getPluginManager: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock("../../src/server/logging.js", () => ({
  Logger: class MockLogger {},
}));

vi.mock("../../src/plugins/pluginManager.js", () => ({
  PluginManager: class MockPluginManager {},
}));

vi.mock("../../src/server/musicServer.js", () => ({
  musicServerInstance: {
    getLogger: (...args: unknown[]) => spies.getLogger(...args),
    getPluginManager: (...args: unknown[]) => spies.getPluginManager(...args),
    getDatabase: (...args: unknown[]) => spies.getDatabase(...args),
  },
}));

import { Context } from "../../src/types/context.js";

describe("Context.create", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    spies.getLogger.mockReturnValue({ info: vi.fn(), error: vi.fn() });
    spies.getPluginManager.mockReturnValue({ getAllPlugins: vi.fn() });
    spies.getDatabase.mockReturnValue({ client: {} });
  });

  it("builds context with logger, plugin manager and database from musicServerInstance", () => {
    const context = Context.create();

    expect(spies.getLogger).toHaveBeenCalledTimes(1);
    expect(spies.getPluginManager).toHaveBeenCalledTimes(1);
    expect(spies.getDatabase).toHaveBeenCalledTimes(1);

    expect(context.logger).toBe(spies.getLogger.mock.results[0].value);
    expect(context.pluginManager).toBe(
      spies.getPluginManager.mock.results[0].value,
    );
    expect(context.database).toBe(spies.getDatabase.mock.results[0].value);
  });

  it("returns a new Context instance on each call", () => {
    const first = Context.create();
    const second = Context.create();

    expect(first).not.toBe(second);
    expect(first.logger).toBe(second.logger);
    expect(first.pluginManager).toBe(second.pluginManager);
    expect(first.database).toBe(second.database);
    expect(spies.getLogger).toHaveBeenCalledTimes(2);
    expect(spies.getPluginManager).toHaveBeenCalledTimes(2);
    expect(spies.getDatabase).toHaveBeenCalledTimes(2);
  });
});
