// test/routes/admin/apiKeysDelete.test.ts
import { describe, it, expect, vi } from "vitest";

const mockDelete = vi.hoisted(() => vi.fn());
vi.mock("../../../src/types/db/apiKey.js", () => ({
  ApiKeyDbModel: { deleteById: mockDelete },
}));

import ApiKeysDelete from "../../../src/routes/admin/apiKeysDelete.js";
import { HttpMethods } from "../../../src/misc/constants.js";

function makeContext() {
  return { database: {} } as any;
}

describe("ApiKeysDelete", () => {
  it("has correct URL and method", () => {
    const route = new ApiKeysDelete(makeContext());
    expect(route.url).toBe("/admin/api-keys/:id");
    expect(route.method).toBe(HttpMethods.DELETE);
  });

  it("deletes key and returns ok", async () => {
    mockDelete.mockResolvedValue(true);
    const route = new ApiKeysDelete(makeContext());
    const send = vi.fn();
    await route.handler({ params: { id: "abc" } }, { send, code: vi.fn().mockReturnThis() });
    expect(mockDelete).toHaveBeenCalledWith({}, "abc");
    expect(send).toHaveBeenCalledWith({ status: "ok" });
  });

  it("returns 404 when key not found", async () => {
    mockDelete.mockResolvedValue(false);
    const route = new ApiKeysDelete(makeContext());
    const code = vi.fn().mockReturnThis();
    const send = vi.fn();
    await route.handler({ params: { id: "missing" } }, { send, code });
    expect(code).toHaveBeenCalledWith(404);
  });
});
