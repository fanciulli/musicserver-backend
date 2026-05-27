// test/routes/admin/apiKeysList.test.ts
import { describe, it, expect, vi } from "vitest";
import ApiKeysList from "../../../src/routes/admin/apiKeysList.js";
import { HttpMethods } from "../../../src/misc/constants.js";

function makeContext(dbResult: unknown[] = []) {
  return {
    database: {
      collection: vi.fn().mockReturnValue({
        find: vi.fn().mockReturnValue({
          project: vi.fn().mockReturnValue({
            toArray: vi.fn().mockResolvedValue(dbResult),
          }),
        }),
      }),
    },
  } as any;
}

describe("ApiKeysList", () => {
  it("has correct URL and method", () => {
    const route = new ApiKeysList(makeContext());
    expect(route.url).toBe("/admin/api-keys");
    expect(route.method).toBe(HttpMethods.GET);
  });

  it("responds with list from DB", async () => {
    const keys = [
      { id: "1", name: "prod", keyPrefix: "ms_abc123", createdAt: new Date(), expiresAt: null },
    ];
    const route = new ApiKeysList(makeContext(keys));
    const send = vi.fn();
    await route.handler({}, { send });
    expect(send).toHaveBeenCalledWith(keys);
  });
});
