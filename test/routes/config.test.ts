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
import { default as ConfigUpdateRoute } from "../../src/routes/admin/configUpdate.js";

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

describe("Config PUT route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabase.mockReturnValue("db-client");
  });

  it("uses PUT /admin/config and requires auth", () => {
    const route = new ConfigUpdateRoute(createRouteContext());
    expect(route.url).toBe("/admin/config");
    expect(route.method).toBe("PUT");
    expect(route.requiresAuth).toBe(true);
  });

  it("returns updated config on success", async () => {
    const updated = [
      { key: "test.string", label: "Test String", type: "string", value: "ok" },
    ];
    mocks.updateConfig.mockResolvedValue(updated);

    const route = new ConfigUpdateRoute(createRouteContext());
    const response = createResponseMock();

    await route.handler(
      { body: { values: { "test.string": "ok" } } },
      response,
    );

    expect(mocks.updateConfig).toHaveBeenCalledWith("db-client", {
      "test.string": "ok",
    });
    expect(response.send).toHaveBeenCalledWith(updated);
    expect(response.status).not.toHaveBeenCalled();
  });

  it("returns 400 with the error message when validation fails", async () => {
    mocks.updateConfig.mockResolvedValue({
      error: "Test String must not be empty",
    });

    const route = new ConfigUpdateRoute(createRouteContext());
    const response = createResponseMock();

    await route.handler({ body: { values: { "test.string": "" } } }, response);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith({
      error: "Test String must not be empty",
    });
  });
});
