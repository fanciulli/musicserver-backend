/*
 * Created on Fri May 15 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  artistCount: vi.fn(),
  artistFindAll: vi.fn(),
  artistFindById: vi.fn(),
  albumCount: vi.fn(),
  albumFindAlbumsByArtistIdAllPlugins: vi.fn(),
  albumFindByIdAcrossPlugins: vi.fn(),
  songCount: vi.fn(),
  songFindSongsByAlbumIdAllPlugins: vi.fn(),
}));

vi.mock("../../src/types/db/artist.js", () => ({
  ArtistDbModel: {
    count: (...args: unknown[]) => mocks.artistCount(...args),
    findAll: (...args: unknown[]) => mocks.artistFindAll(...args),
    findById: (...args: unknown[]) => mocks.artistFindById(...args),
  },
}));

vi.mock("../../src/types/db/album.js", () => ({
  AlbumDbModel: {
    count: (...args: unknown[]) => mocks.albumCount(...args),
    findAlbumsByArtistIdAllPlugins: (...args: unknown[]) =>
      mocks.albumFindAlbumsByArtistIdAllPlugins(...args),
    findByIdAcrossPlugins: (...args: unknown[]) =>
      mocks.albumFindByIdAcrossPlugins(...args),
  },
}));

vi.mock("../../src/types/db/song.js", () => ({
  SongDbModel: {
    count: (...args: unknown[]) => mocks.songCount(...args),
    findSongsByAlbumIdAllPlugins: (...args: unknown[]) =>
      mocks.songFindSongsByAlbumIdAllPlugins(...args),
  },
}));

import { default as DbSummaryRoute } from "../../src/routes/admin/dbSummary.js";
import { default as DbArtistsRoute } from "../../src/routes/admin/dbArtists.js";
import { default as DbAlbumsRoute } from "../../src/routes/admin/dbAlbums.js";
import { default as DbSongsRoute } from "../../src/routes/admin/dbSongs.js";

function createResponseMock() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

function createRouteContext() {
  return {
    database: mocks.getDatabase(),
    logger: { info: vi.fn(), error: vi.fn() },
  } as any;
}

describe("Admin DB routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDatabase.mockReturnValue("db-client");
  });

  describe("URL contracts", () => {
    it("uses /admin/db prefix for all DB routes", () => {
      const ctx = createRouteContext();
      expect(new DbSummaryRoute(ctx).url).toBe("/admin/db/summary");
      expect(new DbArtistsRoute(ctx).url).toBe("/admin/db/artists");
      expect(new DbAlbumsRoute(ctx).url).toBe(
        "/admin/db/artists/:artistId/albums",
      );
      expect(new DbSongsRoute(ctx).url).toBe("/admin/db/albums/:albumId/songs");
    });
  });

  describe("GET /admin/db/summary", () => {
    it("returns total counts for artists, albums and songs", async () => {
      mocks.artistCount.mockResolvedValue(5);
      mocks.albumCount.mockResolvedValue(20);
      mocks.songCount.mockResolvedValue(100);

      const route = new DbSummaryRoute(createRouteContext());
      const response = createResponseMock();

      await route.handler({}, response);

      expect(mocks.artistCount).toHaveBeenCalledWith("db-client");
      expect(mocks.albumCount).toHaveBeenCalledWith("db-client");
      expect(mocks.songCount).toHaveBeenCalledWith("db-client");
      expect(response.send).toHaveBeenCalledWith({
        artists: 5,
        albums: 20,
        songs: 100,
      });
    });
  });

  describe("GET /admin/db/artists", () => {
    it("returns the list of all artists", async () => {
      const artists = [
        { id: "a1", name: "Artist One", pluginId: "filesystem" },
        { id: "a2", name: "Artist Two", pluginId: "filesystem" },
      ];
      mocks.artistFindAll.mockResolvedValue(artists);

      const route = new DbArtistsRoute(createRouteContext());
      const response = createResponseMock();

      await route.handler({}, response);

      expect(mocks.artistFindAll).toHaveBeenCalledWith("db-client");
      expect(response.send).toHaveBeenCalledWith(artists);
    });
  });

  describe("GET /admin/db/artists/:artistId/albums", () => {
    it("returns albums for an existing artist", async () => {
      const artist = { id: "a1", name: "Artist One", pluginId: "filesystem" };
      const albums = [
        { id: "al1", name: "Album One", pluginId: "filesystem", artists: ["a1"] },
      ];
      mocks.artistFindById.mockResolvedValue(artist);
      mocks.albumFindAlbumsByArtistIdAllPlugins.mockResolvedValue(albums);

      const route = new DbAlbumsRoute(createRouteContext());
      const response = createResponseMock();

      await route.handler({ params: { artistId: "a1" } }, response);

      expect(mocks.artistFindById).toHaveBeenCalledWith("db-client", "a1");
      expect(mocks.albumFindAlbumsByArtistIdAllPlugins).toHaveBeenCalledWith(
        "db-client",
        "a1",
      );
      expect(response.send).toHaveBeenCalledWith(albums);
    });

    it("returns 404 when artist is not found", async () => {
      mocks.artistFindById.mockResolvedValue(null);

      const route = new DbAlbumsRoute(createRouteContext());
      const response = createResponseMock();

      await route.handler({ params: { artistId: "missing" } }, response);

      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.send).toHaveBeenCalledWith();
      expect(mocks.albumFindAlbumsByArtistIdAllPlugins).not.toHaveBeenCalled();
    });
  });

  describe("GET /admin/db/albums/:albumId/songs", () => {
    it("returns songs for an existing album", async () => {
      const album = {
        id: "al1",
        name: "Album One",
        pluginId: "filesystem",
        artists: ["a1"],
      };
      const songs = [
        { id: "s1", name: "Song One", pluginId: "filesystem", albumId: "al1" },
        { id: "s2", name: "Song Two", pluginId: "filesystem", albumId: "al1" },
      ];
      mocks.albumFindByIdAcrossPlugins.mockResolvedValue(album);
      mocks.songFindSongsByAlbumIdAllPlugins.mockResolvedValue(songs);

      const route = new DbSongsRoute(createRouteContext());
      const response = createResponseMock();

      await route.handler({ params: { albumId: "al1" } }, response);

      expect(mocks.albumFindByIdAcrossPlugins).toHaveBeenCalledWith(
        "db-client",
        "al1",
      );
      expect(mocks.songFindSongsByAlbumIdAllPlugins).toHaveBeenCalledWith(
        "db-client",
        "al1",
      );
      expect(response.send).toHaveBeenCalledWith(songs);
    });

    it("returns 404 when album is not found", async () => {
      mocks.albumFindByIdAcrossPlugins.mockResolvedValue(undefined);

      const route = new DbSongsRoute(createRouteContext());
      const response = createResponseMock();

      await route.handler({ params: { albumId: "missing" } }, response);

      expect(response.status).toHaveBeenCalledWith(404);
      expect(response.send).toHaveBeenCalledWith();
      expect(mocks.songFindSongsByAlbumIdAllPlugins).not.toHaveBeenCalled();
    });
  });
});
