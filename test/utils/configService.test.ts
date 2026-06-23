/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAll: vi.fn(),
  upsertMany: vi.fn(),
}));

vi.mock("../../src/types/db/serverConfig.js", () => ({
  ServerConfigDBModel: {
    findAll: (...args: unknown[]) => mocks.findAll(...args),
    upsertMany: (...args: unknown[]) => mocks.upsertMany(...args),
  },
}));

import { getConfig, updateConfig } from "../../src/utils/configService.js";

describe("configService.getConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges stored values over defaults and includes label+type", async () => {
    mocks.findAll.mockResolvedValue([{ key: "test.string", value: "stored" }]);

    const result = await getConfig("db" as any);

    expect(result).toEqual([
      {
        key: "test.string",
        label: "Test String",
        type: "string",
        value: "stored",
      },
      {
        key: "test.boolean",
        label: "Test Boolean",
        type: "boolean",
        value: false,
      },
    ]);
  });

  it("falls back to default when a key is not stored", async () => {
    mocks.findAll.mockResolvedValue([]);

    const result = await getConfig("db" as any);

    expect(result.find((e) => e.key === "test.string")?.value).toBe("");
    expect(result.find((e) => e.key === "test.boolean")?.value).toBe(false);
  });
});

describe("configService.updateConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findAll.mockResolvedValue([]);
    mocks.upsertMany.mockResolvedValue(undefined);
  });

  it("rejects an unknown key without persisting", async () => {
    const result = await updateConfig("db" as any, { "bad.key": "x" });

    expect(result).toEqual({ error: "Unknown configuration key: bad.key" });
    expect(mocks.upsertMany).not.toHaveBeenCalled();
  });

  it("returns the validation error for an invalid value without persisting", async () => {
    const result = await updateConfig("db" as any, { "test.string": "" });

    expect(result).toEqual({ error: "Test String must not be empty" });
    expect(mocks.upsertMany).not.toHaveBeenCalled();
  });

  it("persists valid values and returns the merged config", async () => {
    mocks.findAll.mockResolvedValue([
      { key: "test.string", value: "ok" },
      { key: "test.boolean", value: true },
    ]);

    const result = await updateConfig("db" as any, {
      "test.string": "ok",
      "test.boolean": true,
    });

    expect(mocks.upsertMany).toHaveBeenCalledWith("db", [
      { key: "test.string", value: "ok" },
      { key: "test.boolean", value: true },
    ]);
    expect(result).toEqual([
      { key: "test.string", label: "Test String", type: "string", value: "ok" },
      {
        key: "test.boolean",
        label: "Test Boolean",
        type: "boolean",
        value: true,
      },
    ]);
  });
});
