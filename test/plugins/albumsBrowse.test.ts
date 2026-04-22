/*
 * Created on Tue Apr 15 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowseType } from "../../src/types/api/browse.js";

const PLUGIN_ID = "filesystem-music-source";
const ALBUM_UUID = "aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa";
const SONG_UUID = "bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb";
const DB_CLIENT = "db-client";

const mocks = vi.hoisted(() => ({
  findSongsByAlbumId: vi.fn(),
  findByIdAndPluginId: vi.fn(),
}));

vi.mock("../../src/types/db/song.js", () => ({
  SongDbModel: {
    findSongsByAlbumId: (...args: unknown[]) =>
      mocks.findSongsByAlbumId(...args),
    findByIdAndPluginId: (...args: unknown[]) =>
      mocks.findByIdAndPluginId(...args),
  },
}));

import { browseAlbums } from "../../src/plugins/music_sources/filesystem-music-source/albumsBrowse.js";

describe("browseAlbums – direct album ID path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns songs when called with a direct album UUID", async () => {
    const song = {
      id: SONG_UUID,
      name: "Test Song",
      pluginId: PLUGIN_ID,
      albumId: ALBUM_UUID,
      album: "Test Album",
      artist: "Test Artist",
      artistsId: ["artist-uuid"],
      trackNumber: 1,
      diskNumber: 1,
    };
    mocks.findSongsByAlbumId.mockResolvedValue([song]);

    const result = await browseAlbums(DB_CLIENT as any, ["albums", ALBUM_UUID]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(BrowseType.SONG);
    expect(result[0].id).toBe(
      `${PLUGIN_ID}://albums/${ALBUM_UUID}/${SONG_UUID}`,
    );
    expect(mocks.findSongsByAlbumId).toHaveBeenCalledWith(
      DB_CLIENT,
      ALBUM_UUID,
      PLUGIN_ID,
    );
  });

  it("returns empty array when album has no songs", async () => {
    mocks.findSongsByAlbumId.mockResolvedValue([]);

    const result = await browseAlbums(DB_CLIENT as any, ["albums", ALBUM_UUID]);

    expect(result).toEqual([]);
  });

  it("returns empty array for non-UUID sections[1]", async () => {
    const result = await browseAlbums(DB_CLIENT as any, [
      "albums",
      "not-a-uuid",
    ]);

    expect(result).toEqual([]);
    expect(mocks.findSongsByAlbumId).not.toHaveBeenCalled();
  });
});

describe("browseAlbums – direct album ID + song ID path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a song when both album UUID and song UUID are provided", async () => {
    const song = {
      id: SONG_UUID,
      name: "Test Song",
      pluginId: PLUGIN_ID,
      albumId: ALBUM_UUID,
      album: "Test Album",
      artist: "Test Artist",
      artistsId: ["artist-uuid"],
      trackNumber: 1,
      diskNumber: 1,
    };
    mocks.findByIdAndPluginId.mockResolvedValue(song);

    const result = await browseAlbums(DB_CLIENT as any, [
      "albums",
      ALBUM_UUID,
      SONG_UUID,
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(BrowseType.SONG);
    expect(result[0].id).toBe(
      `${PLUGIN_ID}://albums/${ALBUM_UUID}/${SONG_UUID}`,
    );
    expect(mocks.findByIdAndPluginId).toHaveBeenCalledWith(
      DB_CLIENT,
      SONG_UUID,
      PLUGIN_ID,
    );
  });

  it("returns empty array when song does not belong to the album", async () => {
    const song = {
      id: SONG_UUID,
      name: "Test Song",
      pluginId: PLUGIN_ID,
      albumId: "cccccccc-cccc-1ccc-8ccc-cccccccccccc",
    };
    mocks.findByIdAndPluginId.mockResolvedValue(song);

    const result = await browseAlbums(DB_CLIENT as any, [
      "albums",
      ALBUM_UUID,
      SONG_UUID,
    ]);

    expect(result).toEqual([]);
  });

  it("returns empty array when song is not found", async () => {
    mocks.findByIdAndPluginId.mockResolvedValue(null);

    const result = await browseAlbums(DB_CLIENT as any, [
      "albums",
      ALBUM_UUID,
      SONG_UUID,
    ]);

    expect(result).toEqual([]);
  });
});
