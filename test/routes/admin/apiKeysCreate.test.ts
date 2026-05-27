// test/routes/admin/apiKeysCreate.test.ts
import { describe, it, expect, vi } from "vitest";

const mockInsert = vi.fn().mockResolvedValue(undefined);

vi.mock("../../../src/types/db/apiKey.js", () => ({
  ApiKeyDbModel: class {
    id = "generated-id";
    name = "";
    keyHash = "";
    keyPrefix = "";
    createdAt = new Date();
    expiresAt: Date | null = null;
    insert = mockInsert;
  },
}));

import ApiKeysCreate from "../../../src/routes/admin/apiKeysCreate.js";
import { HttpMethods } from "../../../src/misc/constants.js";

function makeContext() {
  return { database: {} } as any;
}

describe("ApiKeysCreate", () => {
  it("has correct URL and method", () => {
    const route = new ApiKeysCreate(makeContext());
    expect(route.url).toBe("/admin/api-keys");
    expect(route.method).toBe(HttpMethods.POST);
  });

  it("creates a key without expiry when durationDays is null", async () => {
    const route = new ApiKeysCreate(makeContext());
    const send = vi.fn();
    await route.handler(
      { body: { name: "my-key", durationDays: null } },
      { send },
    );
    expect(mockInsert).toHaveBeenCalled();
    const payload = send.mock.calls[0][0];
    expect(payload.name).toBe("my-key");
    expect(payload.key).toMatch(/^ms_[0-9a-f]{64}$/);
    expect(payload.expiresAt).toBeNull();
  });

  it("sets expiresAt when durationDays is given", async () => {
    const before = Date.now();
    const route = new ApiKeysCreate(makeContext());
    const send = vi.fn();
    await route.handler(
      { body: { name: "expiring", durationDays: 30 } },
      { send },
    );
    const payload = send.mock.calls[0][0];
    const expiresAt = new Date(payload.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThan(before + 29 * 24 * 3600 * 1000);
  });
});
