import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListFiles = vi.fn();
const mockReadFile = vi.fn();

vi.mock("../../src/utils/fsUtils.js", () => ({
  listFiles: (...args: unknown[]) => mockListFiles(...args),
}));

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

import {
  getWizardsFolder,
  getWizardImagesFolder,
  listWizardFiles,
  loadWizard,
} from "../../src/utils/wizardLoader.js";

describe("wizardLoader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getWizardsFolder / getWizardImagesFolder", () => {
    it("resolves the wizards folder against cwd", () => {
      expect(getWizardsFolder().endsWith("wizards")).toBe(true);
    });

    it("resolves the wizard images folder", () => {
      const folder = getWizardImagesFolder();
      expect(folder.endsWith(`wizards/images`)).toBe(true);
    });
  });

  describe("listWizardFiles", () => {
    it("keeps only .json files and sorts them ascending", async () => {
      mockListFiles.mockResolvedValue([
        "/w/0002-b.json",
        "/w/images/pic.svg",
        "/w/0001-a.json",
        "/w/notes.txt",
      ]);

      const result = await listWizardFiles();

      expect(result).toEqual(["/w/0001-a.json", "/w/0002-b.json"]);
    });

    it("returns empty array when there are no files", async () => {
      mockListFiles.mockResolvedValue([]);
      expect(await listWizardFiles()).toEqual([]);
    });
  });

  describe("loadWizard", () => {
    it("parses a valid wizard definition", async () => {
      const def = {
        id: "welcome-v1",
        steps: [{ image: "a.svg", text: "hello" }],
      };
      mockReadFile.mockResolvedValue(JSON.stringify(def));

      expect(await loadWizard("/w/0001-a.json")).toEqual(def);
    });

    it("returns undefined on malformed JSON", async () => {
      mockReadFile.mockResolvedValue("{ not json");
      expect(await loadWizard("/w/bad.json")).toBeUndefined();
    });

    it("returns undefined when id is missing", async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ steps: [] }));
      expect(await loadWizard("/w/noid.json")).toBeUndefined();
    });

    it("returns undefined when steps is not an array", async () => {
      mockReadFile.mockResolvedValue(
        JSON.stringify({ id: "x", steps: "nope" }),
      );
      expect(await loadWizard("/w/nosteps.json")).toBeUndefined();
    });

    it("returns undefined when readFile throws", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));
      expect(await loadWizard("/w/missing.json")).toBeUndefined();
    });
  });
});
