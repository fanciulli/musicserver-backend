/*
 * Created on Sun Sep 20 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fileExists: vi.fn(),
  folderExists: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  fetchArtFromDeezer: vi.fn(),
  findPluginConfig: vi.fn(),
  upsertPluginConfig: vi.fn(),
}));

vi.mock("../../src/utils/fsUtils.js", () => ({
  fileExists: (...args: unknown[]) => mocks.fileExists(...args),
  folderExists: (...args: unknown[]) => mocks.folderExists(...args),
}));

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => mocks.readFile(...args),
  writeFile: (...args: unknown[]) => mocks.writeFile(...args),
  mkdir: (...args: unknown[]) => mocks.mkdir(...args),
}));

vi.mock("../../src/plugins/system/coverart/deezer.js", () => ({
  fetchArtFromDeezer: (...args: unknown[]) => mocks.fetchArtFromDeezer(...args),
}));

vi.mock("../../src/types/db/pluginConfig.js", () => ({
  PluginConfigDBModel: {
    findByPluginId: (...args: unknown[]) => mocks.findPluginConfig(...args),
    upsertSettings: (...args: unknown[]) => mocks.upsertPluginConfig(...args),
  },
}));

import { default as CoverArtPlugin } from "../../src/plugins/system/coverart/index.js";

const UUID = "f81d4fae-7dec-11d0-a765-00a0c91e6bf6";
const ART_PATH = `/albumart/f8/1d/${UUID}`;

function createPlugin() {
  return new CoverArtPlugin({
    database: "db-client",
    logger: { info: vi.fn(), warn: vi.fn() },
  } as any);
}

describe("CoverArtPlugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findPluginConfig.mockResolvedValue(undefined);
    mocks.upsertPluginConfig.mockResolvedValue(undefined);
    mocks.folderExists.mockResolvedValue(true);
  });

  describe("configuration", () => {
    it("uses default configuration when DB configuration is missing", async () => {
      const plugin = createPlugin();
      await plugin.loadConfiguration();

      await expect(plugin.getConfiguration()).resolves.toEqual({
        variables: [{ rootFolder: "string" }],
        labels: {
          rootFolder: "Root folder",
        },
        values: { rootFolder: "/albumart" },
      });
    });

    it("loads configuration from DB", async () => {
      mocks.findPluginConfig.mockResolvedValue({
        settings: { rootFolder: "/data/art" },
      });

      const plugin = createPlugin();
      await plugin.loadConfiguration();

      await expect(plugin.getConfiguration()).resolves.toEqual({
        variables: [{ rootFolder: "string" }],
        labels: {
          rootFolder: "Root folder",
        },
        values: { rootFolder: "/data/art" },
      });
    });

    it("rejects an empty rootFolder", async () => {
      const plugin = createPlugin();

      await expect(
        plugin.updateConfiguration({ rootFolder: "" }),
      ).rejects.toThrow("Root folder must be a non-empty string");
    });

    it("rejects a rootFolder that does not exist on disk", async () => {
      mocks.folderExists.mockResolvedValue(false);
      const plugin = createPlugin();

      await expect(
        plugin.updateConfiguration({
          rootFolder: "/does/not/exist",
        }),
      ).rejects.toThrow(
        'Root folder "/does/not/exist" does not exist or is not a folder',
      );
      expect(mocks.upsertPluginConfig).not.toHaveBeenCalled();
    });

    it("updates and persists configuration", async () => {
      const plugin = createPlugin();

      await plugin.updateConfiguration({
        rootFolder: "/data/art",
      });

      expect(mocks.folderExists).toHaveBeenCalledWith("/data/art");
      expect(mocks.upsertPluginConfig).toHaveBeenCalledWith(
        "db-client",
        "system",
        "coverart",
        { rootFolder: "/data/art" },
      );
    });

    it("updates in-memory configuration after a successful update", async () => {
      const plugin = createPlugin();

      await plugin.updateConfiguration({
        rootFolder: "/data/art",
      });

      await expect(plugin.getConfiguration()).resolves.toMatchObject({
        values: { rootFolder: "/data/art" },
      });
    });
  });

  describe("getArt", () => {
    it("returns the art from disk when already stored", async () => {
      mocks.fileExists.mockResolvedValue(true);
      mocks.readFile.mockResolvedValue(Buffer.from([1, 2, 3]));

      const plugin = createPlugin();
      const result = await plugin.getArt(UUID, "album");

      expect(mocks.fileExists).toHaveBeenCalledWith(ART_PATH);
      expect(mocks.readFile).toHaveBeenCalledWith(ART_PATH);
      expect(mocks.fetchArtFromDeezer).not.toHaveBeenCalled();
      expect(result).toEqual(Buffer.from([1, 2, 3]));
    });

    it("returns undefined on a miss without artist/album to fall back on", async () => {
      mocks.fileExists.mockResolvedValue(false);

      const plugin = createPlugin();
      const result = await plugin.getArt(UUID, "album");

      expect(result).toBeUndefined();
      expect(mocks.fetchArtFromDeezer).not.toHaveBeenCalled();
    });

    it("downloads and stores the art from Deezer on a miss", async () => {
      mocks.fileExists.mockResolvedValue(false);
      mocks.fetchArtFromDeezer.mockResolvedValue(new Uint8Array([9, 9, 9]));

      const plugin = createPlugin();
      const result = await plugin.getArt(
        UUID,
        "album",
        "Some Artist",
        "Some Album",
      );

      expect(mocks.fetchArtFromDeezer).toHaveBeenCalledWith(
        "album",
        "Some Artist",
        "Some Album",
        expect.anything(),
      );
      expect(mocks.mkdir).toHaveBeenCalledWith("/albumart/f8/1d", {
        recursive: true,
      });
      expect(mocks.writeFile).toHaveBeenCalledWith(
        ART_PATH,
        new Uint8Array([9, 9, 9]),
      );
      expect(result).toEqual(new Uint8Array([9, 9, 9]));
    });

    it("looks up artist art on Deezer with only an artist name", async () => {
      mocks.fileExists.mockResolvedValue(false);
      mocks.fetchArtFromDeezer.mockResolvedValue(new Uint8Array([7, 7, 7]));

      const plugin = createPlugin();
      const result = await plugin.getArt(UUID, "artist", "Some Artist");

      expect(mocks.fetchArtFromDeezer).toHaveBeenCalledWith(
        "artist",
        "Some Artist",
        undefined,
        expect.anything(),
      );
      expect(result).toEqual(new Uint8Array([7, 7, 7]));
    });

    it("returns undefined when the remote fetch cannot find any art", async () => {
      mocks.fileExists.mockResolvedValue(false);
      mocks.fetchArtFromDeezer.mockResolvedValue(undefined);

      const plugin = createPlugin();
      const result = await plugin.getArt(
        UUID,
        "artist",
        "Some Artist",
      );

      expect(result).toBeUndefined();
      expect(mocks.writeFile).not.toHaveBeenCalled();
    });
  });

  describe("storeArt", () => {
    it("writes the provided art directly to disk", async () => {
      const plugin = createPlugin();
      const art = new Uint8Array([1, 2, 3]);

      await plugin.storeArt({ uuid: UUID, art });

      expect(mocks.fetchArtFromDeezer).not.toHaveBeenCalled();
      expect(mocks.mkdir).toHaveBeenCalledWith("/albumart/f8/1d", {
        recursive: true,
      });
      expect(mocks.writeFile).toHaveBeenCalledWith(ART_PATH, art);
    });

    it("downloads album art from Deezer and stores it", async () => {
      mocks.fetchArtFromDeezer.mockResolvedValue(new Uint8Array([9, 9, 9]));

      const plugin = createPlugin();
      await plugin.storeArt({
        uuid: UUID,
        artistName: "Some Artist",
        albumName: "Some Album",
      });

      expect(mocks.fetchArtFromDeezer).toHaveBeenCalledWith(
        "album",
        "Some Artist",
        "Some Album",
        expect.anything(),
      );
      expect(mocks.writeFile).toHaveBeenCalledWith(
        ART_PATH,
        new Uint8Array([9, 9, 9]),
      );
    });

    it("downloads artist art from Deezer with only an artist name", async () => {
      mocks.fetchArtFromDeezer.mockResolvedValue(new Uint8Array([5, 5, 5]));

      const plugin = createPlugin();
      await plugin.storeArt({ uuid: UUID, artistName: "Some Artist" });

      expect(mocks.fetchArtFromDeezer).toHaveBeenCalledWith(
        "artist",
        "Some Artist",
        undefined,
        expect.anything(),
      );
      expect(mocks.writeFile).toHaveBeenCalledWith(
        ART_PATH,
        new Uint8Array([5, 5, 5]),
      );
    });

    it("throws when the remote fetch cannot find any art", async () => {
      mocks.fetchArtFromDeezer.mockResolvedValue(undefined);

      const plugin = createPlugin();

      await expect(
        plugin.storeArt({
          uuid: UUID,
          artistName: "Some Artist",
          albumName: "Some Album",
        }),
      ).rejects.toThrow("No album art found on Deezer");
      expect(mocks.writeFile).not.toHaveBeenCalled();
    });
  });

  describe("hasArt", () => {
    it("returns true when the art file exists", async () => {
      mocks.fileExists.mockResolvedValue(true);

      const plugin = createPlugin();

      await expect(plugin.hasArt(UUID)).resolves.toBe(true);
      expect(mocks.fileExists).toHaveBeenCalledWith(ART_PATH);
    });

    it("returns false when the art file does not exist", async () => {
      mocks.fileExists.mockResolvedValue(false);

      const plugin = createPlugin();

      await expect(plugin.hasArt(UUID)).resolves.toBe(false);
    });
  });
});
