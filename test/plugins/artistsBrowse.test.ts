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
const ARTIST_UUID = "aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa";
const ALBUM_UUID = "bbbbbbbb-bbbb-1bbb-8bbb-bbbbbbbbbbbb";
const SONG_UUID = "cccccccc-cccc-1ccc-8ccc-cccccccccccc";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  findAlbumsByArtistId: vi.fn(),
  findSongsByAlbumId: vi.fn(),
  findByIdAndPluginId: vi.fn(),
}));

vi.mock("../../src/server/musicServer.js", () => ({
  musicServerInstance: {
    getDatabase: () => mocks.getDatabase(),
  },
}));

vi.mock("../../src/types/db/album.js", () => ({
  AlbumDbModel: {
    findAlbumsByArtistId: (...args: unknown[]) =>
      mocks.findAlbumsByArtistId(...args),
  },
}));

vi.mock("../../src/types/db/song.js", () => ({
  SongDbModel: {
    findSongsByAlbumId: (...args: unknown[]) =>
      mocks.findSongsByAlbumId(...args),
    findByIdAndPluginId: (...args: unknown[]) =>
      mocks.findByIdAndPluginId(...args),
  },
}));

import { browseArtists } from "../../src/plugins/music_sources/filesystem-music-source/artistsBrowse.js";

describe("browseArtists – direct artist ID path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabase.mockReturnValue({ client: "db-client" });
  });

  it("returns albums when called with a direct artist UUID", async () => {
    const album = {
      id: ALBUM_UUID,
      name: "Test Album",
      pluginId: PLUGIN_ID,
      artists: [ARTIST_UUID],
    };
    mocks.findAlbumsByArtistId.mockResolvedValue([album]);

    const result = await browseArtists(["artists", ARTIST_UUID]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(BrowseType.FOLDER);
    expect(result[0].id).toBe(
      `${PLUGIN_ID}://artists/${ARTIST_UUID}/${ALBUM_UUID}`,
    );
    expect(mocks.findAlbumsByArtistId).toHaveBeenCalledWith(
      "db-client",
      PLUGIN_ID,
      ARTIST_UUID,
    );
  });

  it("returns empty array when artist has no albums", async () => {
    mocks.findAlbumsByArtistId.mockResolvedValue([]);

    const result = await browseArtists(["artists", ARTIST_UUID]);

    expect(result).toEqual([]);
  });

  it("returns empty array for non-UUID sections[1]", async () => {
    const result = await browseArtists(["artists", "not-a-uuid"]);

    expect(result).toEqual([]);
    expect(mocks.findAlbumsByArtistId).not.toHaveBeenCalled();
  });
});

describe("browseArtists – direct artist ID + album ID path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabase.mockReturnValue({ client: "db-client" });
  });

  it("returns songs when both artist UUID and album UUID are provided", async () => {
    const song = {
      id: SONG_UUID,
      name: "Test Song",
      pluginId: PLUGIN_ID,
      albumId: ALBUM_UUID,
      album: "Test Album",
      artist: "Test Artist",
      artistsId: [ARTIST_UUID],
      trackNumber: 1,
      diskNumber: 1,
    };
    mocks.findSongsByAlbumId.mockResolvedValue([song]);

    const result = await browseArtists(["artists", ARTIST_UUID, ALBUM_UUID]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(BrowseType.SONG);
    expect(result[0].id).toBe(
      `${PLUGIN_ID}://artists/${ARTIST_UUID}/${ALBUM_UUID}/${SONG_UUID}`,
    );
    expect(mocks.findSongsByAlbumId).toHaveBeenCalledWith(
      "db-client",
      ALBUM_UUID,
      PLUGIN_ID,
    );
  });

  it("returns empty array when album has no songs", async () => {
    mocks.findSongsByAlbumId.mockResolvedValue([]);

    const result = await browseArtists(["artists", ARTIST_UUID, ALBUM_UUID]);

    expect(result).toEqual([]);
  });
});

describe("browseArtists – direct artist ID + album ID + song ID path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabase.mockReturnValue({ client: "db-client" });
  });

  it("returns the song when artist, album and song UUIDs are all valid", async () => {
    const song = {
      id: SONG_UUID,
      name: "Test Song",
      pluginId: PLUGIN_ID,
      albumId: ALBUM_UUID,
      album: "Test Album",
      artist: "Test Artist",
      artistsId: [ARTIST_UUID],
      trackNumber: 1,
      diskNumber: 1,
    };
    mocks.findByIdAndPluginId.mockResolvedValue(song);

    const result = await browseArtists([
      "artists",
      ARTIST_UUID,
      ALBUM_UUID,
      SONG_UUID,
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe(BrowseType.SONG);
    expect(result[0].id).toBe(
      `${PLUGIN_ID}://artists/${ARTIST_UUID}/${ALBUM_UUID}/${SONG_UUID}`,
    );
    expect(mocks.findByIdAndPluginId).toHaveBeenCalledWith(
      "db-client",
      SONG_UUID,
      PLUGIN_ID,
    );
  });

  it("returns empty array when the song does not belong to the album", async () => {
    const song = {
      id: SONG_UUID,
      pluginId: PLUGIN_ID,
      albumId: "different-album-id",
      artistsId: [ARTIST_UUID],
    };
    mocks.findByIdAndPluginId.mockResolvedValue(song);

    const result = await browseArtists([
      "artists",
      ARTIST_UUID,
      ALBUM_UUID,
      SONG_UUID,
    ]);

    expect(result).toEqual([]);
  });

  it("returns empty array when the song does not belong to the artist", async () => {
    const song = {
      id: SONG_UUID,
      pluginId: PLUGIN_ID,
      albumId: ALBUM_UUID,
      artistsId: ["different-artist-id"],
    };
    mocks.findByIdAndPluginId.mockResolvedValue(song);

    const result = await browseArtists([
      "artists",
      ARTIST_UUID,
      ALBUM_UUID,
      SONG_UUID,
    ]);

    expect(result).toEqual([]);
  });

  it("returns empty array when song is not found", async () => {
    mocks.findByIdAndPluginId.mockResolvedValue(null);

    const result = await browseArtists([
      "artists",
      ARTIST_UUID,
      ALBUM_UUID,
      SONG_UUID,
    ]);

    expect(result).toEqual([]);
  });
});
