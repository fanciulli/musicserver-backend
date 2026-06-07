import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findByUsername: vi.fn(),
  updateHash: vi.fn(),
  deleteByUsername: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(),
}));

vi.mock("../../../src/types/db/userPassword.js", () => ({
  UserPasswordDbModel: {
    findByUsername: (...args: unknown[]) => mocks.findByUsername(...args),
    updateHash: (...args: unknown[]) => mocks.updateHash(...args),
  },
}));

vi.mock("../../../src/types/db/userSession.js", () => ({
  UserSessionDbModel: {
    deleteByUsername: (...args: unknown[]) => mocks.deleteByUsername(...args),
  },
}));

vi.mock("../../../src/utils/sessionAuthUtils.js", () => ({
  verifyPassword: (...args: unknown[]) => mocks.verifyPassword(...args),
  hashPassword: (...args: unknown[]) => mocks.hashPassword(...args),
}));

import { default as ChangePasswordRoute } from "../../../src/routes/admin/changePassword.js";
import { HttpMethods } from "../../../src/misc/constants.js";

function createRoute() {
  return new ChangePasswordRoute({
    database: {} as any,
    logger: { info: vi.fn(), error: vi.fn() },
  } as any);
}

function createResponseMock() {
  const mock = {
    code: vi.fn(),
    send: vi.fn().mockReturnThis(),
  };
  mock.code.mockReturnValue(mock);
  return mock;
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
    username: "admin",
    body: { currentPassword: "oldpass123", newPassword: "newpass123" },
    ...overrides,
  };
}

describe("ChangePasswordRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("has correct URL", () => {
    expect(createRoute().url).toBe("/admin/change-password");
  });

  it("uses POST method", () => {
    expect(createRoute().method).toBe(HttpMethods.POST);
  });

  it("requires auth", () => {
    expect(createRoute().requiresAuth).toBe(true);
  });

  it("returns 400 when newPassword is shorter than 8 characters", async () => {
    const route = createRoute();
    const response = createResponseMock();

    await route.handler(
      createRequest({ body: { currentPassword: "oldpass123", newPassword: "short" } }),
      response,
    );

    expect(response.code).toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith({
      error: "New password must be at least 8 characters",
    });
  });

  it("accepts newPassword of exactly 8 characters", async () => {
    mocks.findByUsername.mockResolvedValue({ passwordHash: "hash" });
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.hashPassword.mockResolvedValue("newhash");
    mocks.updateHash.mockResolvedValue(undefined);
    mocks.deleteByUsername.mockResolvedValue(undefined);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(
      createRequest({ body: { currentPassword: "oldpass123", newPassword: "exactly8" } }),
      response,
    );

    expect(response.code).not.toHaveBeenCalledWith(400);
    expect(response.send).toHaveBeenCalledWith({ success: true });
  });

  it("returns 401 when user is not found", async () => {
    mocks.findByUsername.mockResolvedValue(undefined);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest(), response);

    expect(response.code).toHaveBeenCalledWith(401);
    expect(response.send).toHaveBeenCalledWith({ error: "Invalid credentials" });
  });

  it("returns 401 when currentPassword does not match", async () => {
    mocks.findByUsername.mockResolvedValue({ passwordHash: "hash" });
    mocks.verifyPassword.mockResolvedValue(false);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest(), response);

    expect(response.code).toHaveBeenCalledWith(401);
    expect(response.send).toHaveBeenCalledWith({ error: "Invalid credentials" });
  });

  it("returns success on valid password change", async () => {
    mocks.findByUsername.mockResolvedValue({ passwordHash: "oldhash" });
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.hashPassword.mockResolvedValue("newhash");
    mocks.updateHash.mockResolvedValue(undefined);
    mocks.deleteByUsername.mockResolvedValue(undefined);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest(), response);

    expect(response.send).toHaveBeenCalledWith({ success: true });
  });

  it("updates password hash in DB on success", async () => {
    mocks.findByUsername.mockResolvedValue({ passwordHash: "oldhash" });
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.hashPassword.mockResolvedValue("newhash");
    mocks.updateHash.mockResolvedValue(undefined);
    mocks.deleteByUsername.mockResolvedValue(undefined);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest(), response);

    expect(mocks.updateHash).toHaveBeenCalledWith(expect.anything(), "admin", "newhash");
  });

  it("deletes user sessions on success", async () => {
    mocks.findByUsername.mockResolvedValue({ passwordHash: "oldhash" });
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.hashPassword.mockResolvedValue("newhash");
    mocks.updateHash.mockResolvedValue(undefined);
    mocks.deleteByUsername.mockResolvedValue(undefined);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest(), response);

    expect(mocks.deleteByUsername).toHaveBeenCalledWith(expect.anything(), "admin");
  });

  it("looks up user by username from request", async () => {
    mocks.findByUsername.mockResolvedValue(undefined);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest({ username: "otheruser" }), response);

    expect(mocks.findByUsername).toHaveBeenCalledWith(expect.anything(), "otheruser");
  });
});
