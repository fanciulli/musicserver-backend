import { describe, it, expect, vi } from "vitest";
import { hashApiKey, generateApiKey, validateApiKey } from "../../src/utils/apiKeyUtils.js";
import { ApiKeyCheckStatus } from "fastify-auth-by-api-key";

describe("hashApiKey", () => {
  it("returns a 64-char hex string", () => {
    const hash = hashApiKey("ms_abc123");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic", () => {
    expect(hashApiKey("same-key")).toBe(hashApiKey("same-key"));
  });

  it("differs for different inputs", () => {
    expect(hashApiKey("key-a")).not.toBe(hashApiKey("key-b"));
  });
});

describe("generateApiKey", () => {
  it("returns key starting with ms_", () => {
    const { key } = generateApiKey();
    expect(key).toMatch(/^ms_[0-9a-f]{64}$/);
  });

  it("returns prefix equal to first 10 chars of key", () => {
    const { key, prefix } = generateApiKey();
    expect(prefix).toBe(key.substring(0, 10));
  });

  it("returns hash equal to sha256 of key", () => {
    const { key, hash } = generateApiKey();
    expect(hash).toBe(hashApiKey(key));
  });

  it("generates unique keys", () => {
    const { key: k1 } = generateApiKey();
    const { key: k2 } = generateApiKey();
    expect(k1).not.toBe(k2);
  });
});

describe("validateApiKey", () => {
  it("returns Valid when hash found and not expired", async () => {
    const hash = hashApiKey("ms_testkey");
    const mockDb = {
      collection: vi.fn().mockReturnValue({
        findOne: vi.fn().mockResolvedValue({ keyHash: hash, expiresAt: null }),
      }),
    } as any;
    const result = await validateApiKey(mockDb, "ms_testkey");
    expect(result).toBe(ApiKeyCheckStatus.Valid);
  });

  it("returns Invalid when key not found", async () => {
    const mockDb = {
      collection: vi.fn().mockReturnValue({
        findOne: vi.fn().mockResolvedValue(null),
      }),
    } as any;
    const result = await validateApiKey(mockDb, "ms_unknown");
    expect(result).toBe(ApiKeyCheckStatus.Invalid);
  });

  it("returns Invalid when key is expired", async () => {
    const hash = hashApiKey("ms_expired");
    const mockDb = {
      collection: vi.fn().mockReturnValue({
        findOne: vi.fn().mockResolvedValue({
          keyHash: hash,
          expiresAt: new Date("2000-01-01"),
        }),
      }),
    } as any;
    const result = await validateApiKey(mockDb, "ms_expired");
    expect(result).toBe(ApiKeyCheckStatus.Invalid);
  });

  it("returns Error when DB throws", async () => {
    const mockDb = {
      collection: vi.fn().mockReturnValue({
        findOne: vi.fn().mockRejectedValue(new Error("db down")),
      }),
    } as any;
    const result = await validateApiKey(mockDb, "ms_anykey");
    expect(result).toBe(ApiKeyCheckStatus.Error);
  });
});
