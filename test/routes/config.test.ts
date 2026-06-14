/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
  getDatabase: vi.fn(),
}));

vi.mock("../../src/utils/configService.js", () => ({
  getConfig: (...args: unknown[]) => mocks.getConfig(...args),
  updateConfig: (...args: unknown[]) => mocks.updateConfig(...args),
}));

import { default as ConfigGetRoute } from "../../src/routes/admin/configGet.js";

function createResponseMock() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

function createRouteContext() {
  return {
    database: mocks.getDatabase(),
    logger: { info: vi.fn(), error: vi.fn() },
  } as any;
}

describe("Config GET route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabase.mockReturnValue("db-client");
  });

  it("uses GET /admin/config and requires auth", () => {
    const route = new ConfigGetRoute(createRouteContext());
    expect(route.url).toBe("/admin/config");
    expect(route.method).toBe("GET");
    expect(route.requiresAuth).toBe(true);
  });

  it("returns the merged config from the service", async () => {
    const config = [
      { key: "test.string", label: "Test String", type: "string", value: "" },
    ];
    mocks.getConfig.mockResolvedValue(config);

    const route = new ConfigGetRoute(createRouteContext());
    const response = createResponseMock();

    await route.handler({}, response);

    expect(mocks.getConfig).toHaveBeenCalledWith("db-client");
    expect(response.send).toHaveBeenCalledWith(config);
  });
});
