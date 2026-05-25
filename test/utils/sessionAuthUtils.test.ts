import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  hashToken,
  extractUsernameFromToken,
} from "../../src/utils/sessionAuthUtils.js";

describe("hashPassword", () => {
  it("returns scrypt-formatted string", async () => {
    const hash = await hashPassword("mypassword");
    expect(hash).toMatch(/^scrypt:\d+:\d+:\d+:[0-9a-f]+:[0-9a-f]+$/);
  });

  it("produces different hashes for same password due to random salt", async () => {
    const h1 = await hashPassword("same");
    const h2 = await hashPassword("same");
    expect(h1).not.toBe(h2);
  });
});

describe("verifyPassword", () => {
  it("returns true for correct password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("correct", hash)).toBe(true);
  });

  it("returns false for wrong password", async () => {
    const hash = await hashPassword("correct");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("returns false for malformed hash string", async () => {
    expect(await verifyPassword("any", "not-a-valid-hash")).toBe(false);
  });
});

describe("generateSessionToken", () => {
  it("starts with base64url-encoded username before the dot", () => {
    const token = generateSessionToken("admin");
    const [userPart] = token.split(".");
    expect(Buffer.from(userPart, "base64url").toString("utf8")).toBe("admin");
  });

  it("contains a dot separator", () => {
    expect(generateSessionToken("admin")).toContain(".");
  });

  it("produces different tokens on each call", () => {
    expect(generateSessionToken("admin")).not.toBe(generateSessionToken("admin"));
  });
});

describe("hashToken", () => {
  it("returns a 64-character hex string", () => {
    const h = hashToken("anytoken");
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic for the same input", () => {
    expect(hashToken("x")).toBe(hashToken("x"));
  });

  it("differs for different inputs", () => {
    expect(hashToken("a")).not.toBe(hashToken("b"));
  });
});

describe("extractUsernameFromToken", () => {
  it("extracts the correct username from a generated token", () => {
    const token = generateSessionToken("admin");
    expect(extractUsernameFromToken(token)).toBe("admin");
  });

  it("extracts username with special characters", () => {
    const token = generateSessionToken("user@example.com");
    expect(extractUsernameFromToken(token)).toBe("user@example.com");
  });

  it("returns null for a token without a dot", () => {
    expect(extractUsernameFromToken("nodothere")).toBeNull();
  });
});
