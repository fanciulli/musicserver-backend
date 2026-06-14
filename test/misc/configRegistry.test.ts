/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, expect, it } from "vitest";
import {
  CONFIG_REGISTRY,
  getDefinition,
  getAllDefinitions,
} from "../../src/misc/configRegistry.js";

describe("configRegistry", () => {
  it("seeds one string and one boolean test parameter", () => {
    const keys = getAllDefinitions().map((d) => d.key).sort();
    expect(keys).toEqual(["test.boolean", "test.string"]);
    expect(getDefinition("test.string")?.type).toBe("string");
    expect(getDefinition("test.boolean")?.type).toBe("boolean");
  });

  it("returns undefined for an unknown key", () => {
    expect(getDefinition("nope.missing")).toBeUndefined();
  });

  it("test.string rejects empty/non-string and accepts non-empty", () => {
    const def = getDefinition("test.string")!;
    expect(def.validate("hello")).toBeNull();
    expect(def.validate("")).toBe("Test String must not be empty");
    expect(def.validate(123)).toBe("Test String must be a string");
  });

  it("test.boolean accepts booleans and rejects non-boolean", () => {
    const def = getDefinition("test.boolean")!;
    expect(def.validate(true)).toBeNull();
    expect(def.validate(false)).toBeNull();
    expect(def.validate("true")).toBe("Test Boolean must be a boolean");
  });

  it("exposes registry as the same array reference via getAllDefinitions", () => {
    expect(getAllDefinitions()).toBe(CONFIG_REGISTRY);
  });
});
