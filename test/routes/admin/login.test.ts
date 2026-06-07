import { beforeEach, describe, expect, it, vi } from "vitest";

const FIXED_EXPIRES_AT = new Date("2026-06-01T00:00:00.000Z");

const mocks = vi.hoisted(() => ({
  findByUsername: vi.fn(),
  deleteByUsername: vi.fn(),
  sessionInsert: vi.fn(),
  verifyPassword: vi.fn(),
  generateSessionToken: vi.fn(),
  hashToken: vi.fn(),
  isRateLimited: vi.fn(),
  recordFailedAttempt: vi.fn(),
  resetAttempts: vi.fn(),
}));

vi.mock("../../../src/types/db/userPassword.js", () => ({
  UserPasswordDbModel: {
    findByUsername: (...args: unknown[]) => mocks.findByUsername(...args),
  },
}));

vi.mock("../../../src/types/db/userSession.js", () => ({
  UserSessionDbModel: class {
    username = "";
    tokenHash = "";
    expiresAt = FIXED_EXPIRES_AT;
    insert = mocks.sessionInsert;
    static deleteByUsername = (...args: unknown[]) =>
      mocks.deleteByUsername(...args);
  },
}));

vi.mock("../../../src/utils/sessionAuthUtils.js", () => ({
  verifyPassword: (...args: unknown[]) => mocks.verifyPassword(...args),
  generateSessionToken: (...args: unknown[]) =>
    mocks.generateSessionToken(...args),
  hashToken: (...args: unknown[]) => mocks.hashToken(...args),
}));

vi.mock("../../../src/utils/loginRateLimiter.js", () => ({
  isRateLimited: (...args: unknown[]) => mocks.isRateLimited(...args),
  recordFailedAttempt: (...args: unknown[]) =>
    mocks.recordFailedAttempt(...args),
  resetAttempts: (...args: unknown[]) => mocks.resetAttempts(...args),
}));

import { default as LoginRoute } from "../../../src/routes/admin/login.js";
import { HttpMethods } from "../../../src/misc/constants.js";

function createRoute() {
  return new LoginRoute({
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
    ip: "127.0.0.1",
    body: { username: "admin", password: "correctpass" },
    ...overrides,
  };
}

describe("LoginRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isRateLimited.mockReturnValue(false);
  });

  it("has correct URL", () => {
    expect(createRoute().url).toBe("/admin/login");
  });

  it("uses POST method", () => {
    expect(createRoute().method).toBe(HttpMethods.POST);
  });

  it("does not require auth", () => {
    expect(createRoute().requiresAuth).toBe(false);
  });

  it("returns 429 when IP is rate limited", async () => {
    mocks.isRateLimited.mockReturnValue(true);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest(), response);

    expect(response.code).toHaveBeenCalledWith(429);
  });

  it("uses request.ip for rate limiting", async () => {
    mocks.isRateLimited.mockReturnValue(true);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest({ ip: "10.0.0.1" }), response);

    expect(mocks.isRateLimited).toHaveBeenCalledWith("10.0.0.1");
  });

  it("defaults IP to 'unknown' when request.ip is missing", async () => {
    mocks.isRateLimited.mockReturnValue(true);

    const route = createRoute();
    const response = createResponseMock();
    const req = createRequest();
    delete (req as any).ip;

    await route.handler(req, response);

    expect(mocks.isRateLimited).toHaveBeenCalledWith("unknown");
  });

  it("returns 401 and records failed attempt when user not found", async () => {
    mocks.findByUsername.mockResolvedValue(undefined);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest(), response);

    expect(response.code).toHaveBeenCalledWith(401);
    expect(mocks.recordFailedAttempt).toHaveBeenCalledWith("127.0.0.1");
  });

  it("returns 401 and records failed attempt when password is wrong", async () => {
    mocks.findByUsername.mockResolvedValue({ passwordHash: "hash" });
    mocks.verifyPassword.mockResolvedValue(false);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest(), response);

    expect(response.code).toHaveBeenCalledWith(401);
    expect(mocks.recordFailedAttempt).toHaveBeenCalledWith("127.0.0.1");
  });

  it("returns token and expiresAt on successful login", async () => {
    mocks.findByUsername.mockResolvedValue({ passwordHash: "hash" });
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.generateSessionToken.mockReturnValue("mytoken");
    mocks.hashToken.mockReturnValue("mytokenhash");
    mocks.sessionInsert.mockResolvedValue(undefined);
    mocks.deleteByUsername.mockResolvedValue(undefined);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest(), response);

    expect(response.send).toHaveBeenCalledWith({
      token: "mytoken",
      expiresAt: FIXED_EXPIRES_AT.toISOString(),
    });
  });

  it("resets rate limiter attempts on successful login", async () => {
    mocks.findByUsername.mockResolvedValue({ passwordHash: "hash" });
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.generateSessionToken.mockReturnValue("token");
    mocks.hashToken.mockReturnValue("hash");
    mocks.sessionInsert.mockResolvedValue(undefined);
    mocks.deleteByUsername.mockResolvedValue(undefined);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest(), response);

    expect(mocks.resetAttempts).toHaveBeenCalledWith("127.0.0.1");
    expect(mocks.recordFailedAttempt).not.toHaveBeenCalled();
  });

  it("deletes existing sessions on successful login", async () => {
    mocks.findByUsername.mockResolvedValue({ passwordHash: "hash" });
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.generateSessionToken.mockReturnValue("token");
    mocks.hashToken.mockReturnValue("hash");
    mocks.sessionInsert.mockResolvedValue(undefined);
    mocks.deleteByUsername.mockResolvedValue(undefined);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest(), response);

    expect(mocks.deleteByUsername).toHaveBeenCalledWith(
      expect.anything(),
      "admin",
    );
  });

  it("stores hashed token in new session", async () => {
    mocks.findByUsername.mockResolvedValue({ passwordHash: "hash" });
    mocks.verifyPassword.mockResolvedValue(true);
    mocks.generateSessionToken.mockReturnValue("rawtoken");
    mocks.hashToken.mockReturnValue("hashedtoken");
    mocks.sessionInsert.mockResolvedValue(undefined);
    mocks.deleteByUsername.mockResolvedValue(undefined);

    const route = createRoute();
    const response = createResponseMock();

    await route.handler(createRequest(), response);

    expect(mocks.hashToken).toHaveBeenCalledWith("rawtoken");
    expect(mocks.sessionInsert).toHaveBeenCalled();
  });
});
