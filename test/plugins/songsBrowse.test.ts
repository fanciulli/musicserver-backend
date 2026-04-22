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
const SONG_UUID = "aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa";
const ALBUM_UUID = "bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb";
const DB_CLIENT = "db-client";

const mocks = vi.hoisted(() => ({
  findByIdAndPluginId: vi.fn(),
}));

vi.mock("../../src/types/db/song.js", () => ({
  SongDbModel: {
    findByIdAndPluginId: (...args: unknown[]) =>
      mocks.findByIdAndPluginId(...args),
  },
}));

import { browseSongs } from "../../src/plugins/music_sources/filesystem-music-source/songsBrowse.js";

describe("browseSongs – direct song ID path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the song when called with a direct song UUID", async () => {
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

    const result = await browseSongs(DB_CLIENT as any, ["songs", SONG_UUID]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(BrowseType.SONG);
    expect(result[0].id).toBe(`${PLUGIN_ID}://songs/${SONG_UUID}`);
    expect(mocks.findByIdAndPluginId).toHaveBeenCalledWith(
      DB_CLIENT,
      SONG_UUID,
      PLUGIN_ID,
    );
  });

  it("returns empty array when song is not found", async () => {
    mocks.findByIdAndPluginId.mockResolvedValue(null);

    const result = await browseSongs(DB_CLIENT as any, ["songs", SONG_UUID]);

    expect(result).toEqual([]);
  });

  it("returns empty array for non-UUID sections[1]", async () => {
    const result = await browseSongs(DB_CLIENT as any, ["songs", "not-a-uuid"]);

    expect(result).toEqual([]);
    expect(mocks.findByIdAndPluginId).not.toHaveBeenCalled();
  });
});
