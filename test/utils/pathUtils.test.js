import { describe, expect, it } from "vitest";
import {
  extractPathSections,
  extractPluginId,
} from "../../src/utils/pathUtils.js";
describe("extractPathSections", () => {
  it("returns null when path does not start with plugin prefix", () => {
    expect(extractPathSections("filesystem", "http://music/albums")).toBeNull();
    expect(extractPathSections("filesystem", "other://albums")).toBeNull();
  });
  it("returns empty array for plugin root", () => {
    expect(extractPathSections("filesystem", "filesystem://")).toEqual([]);
  });
  it("extracts sections for nested paths", () => {
    expect(
      extractPathSections("filesystem", "filesystem://albums/rock"),
    ).toEqual(["albums", "rock"]);
  });
  it("ignores empty sections from repeated or trailing slashes", () => {
    expect(
      extractPathSections("filesystem", "filesystem://albums//rock///"),
    ).toEqual(["albums", "rock"]);
  });
});

describe("extractPluginId", () => {
  it("extracts plugin id from a standard uri", () => {
    expect(extractPluginId("filesystem://albums/rock")).toBe("filesystem");
  });

  it("returns the first section before colon", () => {
    expect(extractPluginId("demo-music-source:custom")).toBe(
      "demo-music-source",
    );
  });

  it("returns empty string when uri starts with colon", () => {
    expect(extractPluginId("://invalid")).toBe("");
  });
});
