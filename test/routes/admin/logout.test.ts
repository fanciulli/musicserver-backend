import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  deleteByUsername: vi.fn(),
}));

vi.mock("../../../src/types/db/userSession.js", () => ({
  UserSessionDbModel: {
    deleteByUsername: (...args: unknown[]) => mocks.deleteByUsername(...args),
  },
}));

import { default as LogoutRoute } from "../../../src/routes/admin/logout.js";
import { HttpMethods } from "../../../src/misc/constants.js";

function createRoute() {
  return new LogoutRoute({
    database: {} as any,
    logger: { info: vi.fn(), error: vi.fn() },
  } as any);
}

function createResponseMock() {
  return {
    send: vi.fn().mockReturnThis(),
  };
}

function createRequest(username = "admin") {
  return { username };
}

describe("LogoutRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct URL", () => {
    expect(createRoute().url).toBe("/admin/logout");
  });

  it("uses POST method", () => {
    expect(createRoute().method).toBe(HttpMethods.POST);
  });

  it("requires auth", () => {
    expect(createRoute().requiresAuth).toBe(true);
  });

  it("deletes sessions for the authenticated user", async () => {
    mocks.deleteByUsername.mockResolvedValue(undefined);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest("alice"), response);

    expect(mocks.deleteByUsername).toHaveBeenCalledWith(expect.anything(), "alice");
  });

  it("returns success response", async () => {
    mocks.deleteByUsername.mockResolvedValue(undefined);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest(), response);

    expect(response.send).toHaveBeenCalledWith({ success: true });
  });
});
