/*
 * Created on Thu Mar 27 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fileSystemScan: vi.fn(),
  findPluginConfig: vi.fn(),
  upsertPluginConfig: vi.fn(),
}));

vi.mock(
  "../../src/plugins/music_sources/filesystem-music-source/scan.js",
  () => ({
    FileSystemScan: {
      scan: (...args: unknown[]) => mocks.fileSystemScan(...args),
    },
  }),
);

vi.mock("../../src/types/db/pluginConfig.js", () => ({
  PluginConfigDBModel: {
    findByPluginId: (...args: unknown[]) => mocks.findPluginConfig(...args),
    upsertSettings: (...args: unknown[]) => mocks.upsertPluginConfig(...args),
  },
}));

import { default as FilesystemMusicSourcePlugin } from "../../src/plugins/music_sources/filesystem-music-source/index.js";

describe("FilesystemMusicSourcePlugin configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findPluginConfig.mockResolvedValue(undefined);
    mocks.upsertPluginConfig.mockResolvedValue(undefined);
  });

  it("loads configuration from DB", async () => {
    mocks.findPluginConfig.mockResolvedValue({
      settings: {
        musicFolder: "/db/music",
      },
    });

    const plugin = new FilesystemMusicSourcePlugin({
      database: { client: "db-client" },
      logger: { info: vi.fn() },
    } as any);

    await plugin.loadConfiguration();

    await expect(plugin.getConfiguration()).resolves.toEqual({
      variables: [{ musicFolder: "string" }],
      values: {
        musicFolder: "/db/music",
      },
    });
  });

  it("uses default configuration when DB configuration is missing", async () => {
    mocks.findPluginConfig.mockResolvedValue(undefined);

    const plugin = new FilesystemMusicSourcePlugin({
      database: { client: "db-client" },
      logger: { info: vi.fn() },
    } as any);

    await plugin.loadConfiguration();

    await expect(plugin.getConfiguration()).resolves.toEqual({
      variables: [{ musicFolder: "string" }],
      values: {
        musicFolder: "/music",
      },
    });
  });

  it("updates musicFolder configuration and returns it", async () => {
    const plugin = new FilesystemMusicSourcePlugin({
      database: { client: "db-client" },
      logger: { info: vi.fn() },
    } as any);

    await plugin.updateConfiguration({ musicFolder: "/mnt/music" });

    await expect(plugin.getConfiguration()).resolves.toEqual({
      variables: [{ musicFolder: "string" }],
      values: {
        musicFolder: "/mnt/music",
      },
    });
    expect(mocks.upsertPluginConfig).toHaveBeenCalledWith(
      "db-client",
      "music_sources",
      "filesystem-music-source",
      {
        musicFolder: "/mnt/music",
      },
    );
  });

  it("rejects invalid musicFolder configuration", async () => {
    const plugin = new FilesystemMusicSourcePlugin({
      database: { client: "db-client" },
      logger: { info: vi.fn() },
    } as any);

    await expect(
      plugin.updateConfiguration({ musicFolder: "" }),
    ).rejects.toThrow("musicFolder must be a non-empty string");
  });

  it("uses configured musicFolder during scan", async () => {
    mocks.fileSystemScan.mockResolvedValue(undefined);

    const plugin = new FilesystemMusicSourcePlugin({
      database: { client: "db-client" },
      logger: { info: vi.fn() },
    } as any);

    await plugin.updateConfiguration({ musicFolder: "/data/audio" });
    await plugin.scan();

    expect(mocks.fileSystemScan).toHaveBeenCalledWith(
      "db-client",
      "filesystem-music-source",
      "/data/audio",
    );
  });
});
