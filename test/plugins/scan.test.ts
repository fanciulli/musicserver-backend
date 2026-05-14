/*
 * Created on Sat Apr 25 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../../src/types/context.js";

const PLUGIN_ID = "filesystem-music-source";
const DB_CLIENT = "db-client";
const MUSIC_FOLDER = "/music";

const mocks = vi.hoisted(() => ({
  listFiles: vi.fn(),
  parseFile: vi.fn(),

  artistFind: vi.fn(),
  artistInsert: vi.fn(),
  artistUpdate: vi.fn(),
  artistMarkAllAsNotExisting: vi.fn(),
  artistDeleteNotExisting: vi.fn(),

  albumFind: vi.fn(),
  albumInsert: vi.fn(),
  albumUpdate: vi.fn(),
  albumMarkAllAsNotExisting: vi.fn(),
  albumDeleteNotExisting: vi.fn(),

  songFind: vi.fn(),
  songInsert: vi.fn(),
  songUpdate: vi.fn(),
  songMarkAllAsNotExisting: vi.fn(),
  songDeleteNotExisting: vi.fn(),
}));

vi.mock("../../src/utils/fsUtils.js", () => ({
  listFiles: (...args: unknown[]) => mocks.listFiles(...args),
}));

vi.mock("music-metadata", () => ({
  parseFile: (...args: unknown[]) => mocks.parseFile(...args),
  UnsupportedFileTypeError: class UnsupportedFileTypeError extends Error {},
  CouldNotDetermineFileTypeError: class CouldNotDetermineFileTypeError extends Error {},
}));

vi.mock("../../src/types/db/artist.js", () => ({
  ArtistDbModel: class ArtistDbModel {
    id?: string;
    name?: string;
    pluginId?: string;
    exists?: boolean;

    async insert(db: unknown) {
      return mocks.artistInsert(db, this);
    }

    async update(db: unknown) {
      return mocks.artistUpdate(db, this);
    }

    static find(...args: unknown[]) {
      return mocks.artistFind(...args);
    }

    static markAllAsNotExisting(...args: unknown[]) {
      return mocks.artistMarkAllAsNotExisting(...args);
    }

    static deleteNotExisting(...args: unknown[]) {
      return mocks.artistDeleteNotExisting(...args);
    }
  },
}));

vi.mock("../../src/types/db/album.js", () => ({
  AlbumDbModel: class AlbumDbModel {
    id?: string;
    name?: string;
    pluginId?: string;
    artists?: string[];
    cover?: string;
    exists?: boolean;

    async insert(db: unknown) {
      return mocks.albumInsert(db, this);
    }

    async update(db: unknown) {
      return mocks.albumUpdate(db, this);
    }

    static find(...args: unknown[]) {
      return mocks.albumFind(...args);
    }

    static markAllAsNotExisting(...args: unknown[]) {
      return mocks.albumMarkAllAsNotExisting(...args);
    }

    static deleteNotExisting(...args: unknown[]) {
      return mocks.albumDeleteNotExisting(...args);
    }
  },
}));

vi.mock("../../src/types/db/song.js", () => ({
  SongDbModel: class SongDbModel {
    id?: string;
    name?: string;
    pluginId?: string;
    album?: string;
    albumId?: string;
    artist?: string;
    artistsId?: string[];
    trackNumber?: number;
    diskNumber?: number;
    metadata?: Record<string, any>;
    exists?: boolean;

    async insert(db: unknown) {
      return mocks.songInsert(db, this);
    }

    async update(db: unknown) {
      return mocks.songUpdate(db, this);
    }

    static find(...args: unknown[]) {
      return mocks.songFind(...args);
    }

    static markAllAsNotExisting(...args: unknown[]) {
      return mocks.songMarkAllAsNotExisting(...args);
    }

    static deleteNotExisting(...args: unknown[]) {
      return mocks.songDeleteNotExisting(...args);
    }
  },
}));

import { FileSystemScan } from "../../src/plugins/music_sources/filesystem-music-source/scan.js";

const makeContext = (): Context =>
  ({
    database: DB_CLIENT,
    logger: { info: vi.fn(), error: vi.fn() },
  }) as unknown as Context;

const makeMetadata = (overrides: Record<string, any> = {}) => ({
  common: {
    albumartists: ["Test Artist"],
    album: "Test Album",
    title: "Test Song",
    track: { no: 1 },
    disk: { no: 1 },
    picture: undefined,
    ...overrides,
  },
  format: {
    bitrate: 1000,
    sampleRate: 44100,
    container: "mp3",
  },
});

describe("FileSystemScan.scan – lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.artistMarkAllAsNotExisting.mockResolvedValue(undefined);
    mocks.albumMarkAllAsNotExisting.mockResolvedValue(undefined);
    mocks.songMarkAllAsNotExisting.mockResolvedValue(undefined);
    mocks.artistDeleteNotExisting.mockResolvedValue(undefined);
    mocks.albumDeleteNotExisting.mockResolvedValue(undefined);
    mocks.songDeleteNotExisting.mockResolvedValue(undefined);
    mocks.listFiles.mockResolvedValue([]);
  });

  it("throws when musicFolder is empty", async () => {
    await expect(
      FileSystemScan.scan(makeContext(), PLUGIN_ID, "  "),
    ).rejects.toThrow("musicFolder must be configured before scan");
  });

  it("marks all entries as not existing at the start and deletes them at the end of scan", async () => {
    await FileSystemScan.scan(makeContext(), PLUGIN_ID, MUSIC_FOLDER);

    expect(mocks.artistMarkAllAsNotExisting).toHaveBeenCalledWith(
      DB_CLIENT,
      PLUGIN_ID,
    );
    expect(mocks.albumMarkAllAsNotExisting).toHaveBeenCalledWith(
      DB_CLIENT,
      PLUGIN_ID,
    );
    expect(mocks.songMarkAllAsNotExisting).toHaveBeenCalledWith(
      DB_CLIENT,
      PLUGIN_ID,
    );

    expect(mocks.artistDeleteNotExisting).toHaveBeenCalledWith(
      DB_CLIENT,
      PLUGIN_ID,
    );
    expect(mocks.albumDeleteNotExisting).toHaveBeenCalledWith(
      DB_CLIENT,
      PLUGIN_ID,
    );
    expect(mocks.songDeleteNotExisting).toHaveBeenCalledWith(
      DB_CLIENT,
      PLUGIN_ID,
    );
  });
});

describe("Successfully adds new data", () => {
  it("Inserts new artist, album and song", async () => {
    vi.clearAllMocks();
    mocks.artistMarkAllAsNotExisting.mockResolvedValue(undefined);
    mocks.albumMarkAllAsNotExisting.mockResolvedValue(undefined);
    mocks.songMarkAllAsNotExisting.mockResolvedValue(undefined);
    mocks.artistDeleteNotExisting.mockResolvedValue(undefined);
    mocks.albumDeleteNotExisting.mockResolvedValue(undefined);
    mocks.songDeleteNotExisting.mockResolvedValue(undefined);
    mocks.artistInsert.mockResolvedValue(undefined);
    mocks.albumInsert.mockResolvedValue(undefined);
    mocks.songInsert.mockResolvedValue(undefined);

    mocks.listFiles.mockResolvedValue(["/music/song.mp3"]);
    mocks.parseFile.mockResolvedValue(makeMetadata());

    mocks.artistFind.mockResolvedValue(null);
    mocks.albumFind.mockResolvedValue(null);
    mocks.songFind.mockResolvedValue(null);

    await FileSystemScan.scan(makeContext(), PLUGIN_ID, MUSIC_FOLDER);

    expect(mocks.artistInsert).toHaveBeenCalledOnce();
    const insertedArtist = mocks.artistInsert.mock.calls[0][1];
    expect(insertedArtist.name).toBe("Test Artist");
    expect(insertedArtist.pluginId).toBe(PLUGIN_ID);
    expect(insertedArtist.exists).toBe(true);

    expect(mocks.albumInsert).toHaveBeenCalledOnce();
    const insertedAlbum = mocks.albumInsert.mock.calls[0][1];
    expect(insertedAlbum.name).toBe("Test Album");
    expect(insertedAlbum.pluginId).toBe(PLUGIN_ID);
    expect(insertedAlbum.exists).toBe(true);

    expect(mocks.songInsert).toHaveBeenCalledOnce();
    const insertedSong = mocks.songInsert.mock.calls[0][1];
    expect(insertedSong.name).toBe("Test Song");
    expect(insertedSong.pluginId).toBe(PLUGIN_ID);
    expect(insertedSong.exists).toBe(true);

    expect(mocks.artistUpdate).not.toHaveBeenCalled();
    expect(mocks.albumUpdate).not.toHaveBeenCalled();
    expect(mocks.songUpdate).not.toHaveBeenCalled();
  });
});

describe("Existing data is preserved and updated", () => {
  const existingArtist = {
    id: "artist-id-1",
    name: "Test Artist",
    pluginId: PLUGIN_ID,
    exists: false,
    update: vi.fn().mockResolvedValue(undefined),
  };

  const existingAlbum = {
    id: "album-id-1",
    name: "Test Album",
    pluginId: PLUGIN_ID,
    artists: ["artist-id-1"],
    exists: false,
    cover: undefined,
    update: vi.fn().mockResolvedValue(undefined),
  };

  const existingSong = {
    id: "song-id-1",
    name: "Test Song",
    pluginId: PLUGIN_ID,
    albumId: "album-id-1",
    exists: false,
    metadata: { filePath: "/old/path/song.mp3" },
    update: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.artistMarkAllAsNotExisting.mockResolvedValue(undefined);
    mocks.albumMarkAllAsNotExisting.mockResolvedValue(undefined);
    mocks.songMarkAllAsNotExisting.mockResolvedValue(undefined);
    mocks.artistDeleteNotExisting.mockResolvedValue(undefined);
    mocks.albumDeleteNotExisting.mockResolvedValue(undefined);
    mocks.songDeleteNotExisting.mockResolvedValue(undefined);

    existingArtist.update.mockResolvedValue(undefined);
    existingAlbum.update.mockResolvedValue(undefined);
    existingSong.update.mockResolvedValue(undefined);

    mocks.listFiles.mockResolvedValue(["/music/song.mp3"]);
    mocks.parseFile.mockResolvedValue(makeMetadata());

    mocks.artistFind.mockResolvedValue(existingArtist);
    mocks.albumFind.mockResolvedValue(existingAlbum);
    mocks.songFind.mockResolvedValue(existingSong);
  });

  it("Updates existing artist, album and song", async () => {
    await FileSystemScan.scan(makeContext(), PLUGIN_ID, MUSIC_FOLDER);

    expect(existingArtist.exists).toBe(true);
    expect(existingArtist.update).toHaveBeenCalledOnce();
    expect(mocks.artistInsert).not.toHaveBeenCalled();

    expect(existingAlbum.exists).toBe(true);
    expect(existingAlbum.update).toHaveBeenCalledOnce();
    expect(mocks.albumInsert).not.toHaveBeenCalled();

    expect(existingSong.exists).toBe(true);
    expect(existingSong.update).toHaveBeenCalledOnce();
    expect(mocks.songInsert).not.toHaveBeenCalled();
  });

  it("Updates song fields and preserves id, name and albumId when song already exists", async () => {
    mocks.parseFile.mockResolvedValue(
      makeMetadata({ track: { no: 5 }, disk: { no: 2 } }),
    );

    await FileSystemScan.scan(makeContext(), PLUGIN_ID, MUSIC_FOLDER);

    expect(existingSong.trackNumber).toBe(5);
    expect(existingSong.diskNumber).toBe(2);
    expect(existingSong.metadata?.filePath).toBe("/music/song.mp3");

    expect(existingSong.id).toBe("song-id-1");
    expect(existingSong.name).toBe("Test Song");
    expect(existingSong.albumId).toBe("album-id-1");
  });

  it("finds song by name and albumId to ensure correct matching", async () => {
    await FileSystemScan.scan(makeContext(), PLUGIN_ID, MUSIC_FOLDER);

    expect(mocks.songFind).toHaveBeenCalledWith(
      DB_CLIENT,
      "Test Song",
      PLUGIN_ID,
      existingAlbum.id,
    );
  });
});

describe("Stale data is removed", () => {
  it("marks before scanning and deletes non-existing entries after empty scan", async () => {
    vi.clearAllMocks();
    mocks.artistMarkAllAsNotExisting.mockResolvedValue(undefined);
    mocks.albumMarkAllAsNotExisting.mockResolvedValue(undefined);
    mocks.songMarkAllAsNotExisting.mockResolvedValue(undefined);
    mocks.artistDeleteNotExisting.mockResolvedValue(undefined);
    mocks.albumDeleteNotExisting.mockResolvedValue(undefined);
    mocks.songDeleteNotExisting.mockResolvedValue(undefined);
    mocks.listFiles.mockResolvedValue([]);

    const callOrder: string[] = [];
    mocks.artistMarkAllAsNotExisting.mockImplementation(() => {
      callOrder.push("markArtists");
      return Promise.resolve();
    });
    mocks.listFiles.mockImplementation(() => {
      callOrder.push("listFiles");
      return Promise.resolve([]);
    });
    mocks.artistDeleteNotExisting.mockImplementation(() => {
      callOrder.push("deleteArtists");
      return Promise.resolve();
    });

    await FileSystemScan.scan(makeContext(), PLUGIN_ID, MUSIC_FOLDER);

    expect(callOrder.indexOf("markArtists")).toBeLessThan(
      callOrder.indexOf("listFiles"),
    );
    expect(callOrder.indexOf("listFiles")).toBeLessThan(
      callOrder.indexOf("deleteArtists"),
    );

    expect(mocks.artistDeleteNotExisting).toHaveBeenCalledWith(
      DB_CLIENT,
      PLUGIN_ID,
    );
    expect(mocks.albumDeleteNotExisting).toHaveBeenCalledWith(
      DB_CLIENT,
      PLUGIN_ID,
    );
    expect(mocks.songDeleteNotExisting).toHaveBeenCalledWith(
      DB_CLIENT,
      PLUGIN_ID,
    );
  });
});
