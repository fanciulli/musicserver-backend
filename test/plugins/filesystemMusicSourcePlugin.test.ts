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

const DEFAULT_ALBUM_COVER_FILENAMES = "cover.jpg,folder.jpg,front.jpg";

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
      database: "db-client",
      logger: { info: vi.fn() },
    } as any);

    await plugin.loadConfiguration();

    await expect(plugin.getConfiguration()).resolves.toEqual({
      variables: [
        { musicFolder: "string" },
        { smartMergeArtists: "boolean" },
        { albumCoverFileNames: "string" },
      ],
      labels: {
        musicFolder: "Music folder",
        smartMergeArtists: "Smart merge artists",
        albumCoverFileNames: "Album covers file names",
      },
      values: {
        musicFolder: "/db/music",
        smartMergeArtists: true,
        albumCoverFileNames: DEFAULT_ALBUM_COVER_FILENAMES,
      },
    });
  });

  it("uses default configuration when DB configuration is missing", async () => {
    mocks.findPluginConfig.mockResolvedValue(undefined);

    const plugin = new FilesystemMusicSourcePlugin({
      database: "db-client",
      logger: { info: vi.fn() },
    } as any);

    await plugin.loadConfiguration();

    await expect(plugin.getConfiguration()).resolves.toEqual({
      variables: [
        { musicFolder: "string" },
        { smartMergeArtists: "boolean" },
        { albumCoverFileNames: "string" },
      ],
      labels: {
        musicFolder: "Music folder",
        smartMergeArtists: "Smart merge artists",
        albumCoverFileNames: "Album covers file names",
      },
      values: {
        musicFolder: "/music",
        smartMergeArtists: true,
        albumCoverFileNames: DEFAULT_ALBUM_COVER_FILENAMES,
      },
    });
  });

  it("updates musicFolder configuration and returns it", async () => {
    const plugin = new FilesystemMusicSourcePlugin({
      database: "db-client",
      logger: { info: vi.fn() },
    } as any);

    await plugin.updateConfiguration({
      musicFolder: "/mnt/music",
      smartMergeArtists: true,
      albumCoverFileNames: DEFAULT_ALBUM_COVER_FILENAMES,
    });

    await expect(plugin.getConfiguration()).resolves.toEqual({
      variables: [
        { musicFolder: "string" },
        { smartMergeArtists: "boolean" },
        { albumCoverFileNames: "string" },
      ],
      labels: {
        musicFolder: "Music folder",
        smartMergeArtists: "Smart merge artists",
        albumCoverFileNames: "Album covers file names",
      },
      values: {
        musicFolder: "/mnt/music",
        smartMergeArtists: true,
        albumCoverFileNames: DEFAULT_ALBUM_COVER_FILENAMES,
      },
    });
    expect(mocks.upsertPluginConfig).toHaveBeenCalledWith(
      "db-client",
      "music_sources",
      "filesystem-music-source",
      {
        musicFolder: "/mnt/music",
        smartMergeArtists: true,
        albumCoverFileNames: DEFAULT_ALBUM_COVER_FILENAMES,
      },
    );
  });

  it("persists the smartMergeArtists flag when provided", async () => {
    const plugin = new FilesystemMusicSourcePlugin({
      database: "db-client",
      logger: { info: vi.fn() },
    } as any);

    await plugin.updateConfiguration({
      musicFolder: "/mnt/music",
      smartMergeArtists: false,
      albumCoverFileNames: DEFAULT_ALBUM_COVER_FILENAMES,
    });

    await expect(plugin.getConfiguration()).resolves.toEqual({
      variables: [
        { musicFolder: "string" },
        { smartMergeArtists: "boolean" },
        { albumCoverFileNames: "string" },
      ],
      labels: {
        musicFolder: "Music folder",
        smartMergeArtists: "Smart merge artists",
        albumCoverFileNames: "Album covers file names",
      },
      values: {
        musicFolder: "/mnt/music",
        smartMergeArtists: false,
        albumCoverFileNames: DEFAULT_ALBUM_COVER_FILENAMES,
      },
    });
    expect(mocks.upsertPluginConfig).toHaveBeenCalledWith(
      "db-client",
      "music_sources",
      "filesystem-music-source",
      {
        musicFolder: "/mnt/music",
        smartMergeArtists: false,
        albumCoverFileNames: DEFAULT_ALBUM_COVER_FILENAMES,
      },
    );
  });

  it("rejects a non-boolean smartMergeArtists value", async () => {
    const plugin = new FilesystemMusicSourcePlugin({
      database: "db-client",
      logger: { info: vi.fn() },
    } as any);

    await expect(
      plugin.updateConfiguration({
        musicFolder: "/mnt/music",
        smartMergeArtists: "yes",
        albumCoverFileNames: DEFAULT_ALBUM_COVER_FILENAMES,
      }),
    ).rejects.toThrow("Smart merge artists must be a boolean");
  });

  it("rejects invalid musicFolder configuration", async () => {
    const plugin = new FilesystemMusicSourcePlugin({
      database: "db-client",
      logger: { info: vi.fn() },
    } as any);

    await expect(
      plugin.updateConfiguration({
        musicFolder: "",
        smartMergeArtists: true,
        albumCoverFileNames: DEFAULT_ALBUM_COVER_FILENAMES,
      }),
    ).rejects.toThrow("Music folder must be a non-empty string");
  });

  it("uses configured musicFolder during scan", async () => {
    mocks.fileSystemScan.mockResolvedValue(undefined);

    const context = {
      database: "db-client",
      logger: { info: vi.fn() },
    } as any;

    const plugin = new FilesystemMusicSourcePlugin(context);

    await plugin.updateConfiguration({
      musicFolder: "/data/audio",
      smartMergeArtists: true,
      albumCoverFileNames: DEFAULT_ALBUM_COVER_FILENAMES,
    });
    await plugin.scan();

    expect(mocks.fileSystemScan).toHaveBeenCalledWith(
      context,
      "filesystem-music-source",
      {
        musicFolder: "/data/audio",
        smartMergeArtists: true,
        albumCoverFileNames: DEFAULT_ALBUM_COVER_FILENAMES,
      },
    );
  });
});
