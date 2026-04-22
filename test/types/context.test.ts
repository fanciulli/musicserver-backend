/*
 * Created on Mon Mar 23 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, expect, it, vi } from "vitest";

import { Context } from "../../src/types/context.js";

describe("Context", () => {
  it("stores constructor dependencies", () => {
    const logger = { info: vi.fn(), error: vi.fn() } as any;
    const pluginManager = { getAllPlugins: vi.fn() } as any;
    const database = {} as any;

    const context = new Context(logger, pluginManager, database);

    expect(context.logger).toBe(logger);
    expect(context.pluginManager).toBe(pluginManager);
    expect(context.database).toBe(database);
  });

  it("creates a distinct instance for each constructor call", () => {
    const logger = { info: vi.fn(), error: vi.fn() } as any;
    const pluginManager = { getAllPlugins: vi.fn() } as any;
    const database = {} as any;

    const first = new Context(logger, pluginManager, database);
    const second = new Context(logger, pluginManager, database);

    expect(first).not.toBe(second);
    expect(first.logger).toBe(logger);
    expect(second.logger).toBe(logger);
    expect(first.pluginManager).toBe(pluginManager);
    expect(second.pluginManager).toBe(pluginManager);
    expect(first.database).toBe(database);
    expect(second.database).toBe(database);
  });
});
