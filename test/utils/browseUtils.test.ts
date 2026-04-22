/*
 * Created on Fri Apr 18 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, expect, it } from "vitest";
import { BrowseUtils } from "../../src/utils/browseUtils.js";
import { BrowseType } from "../../src/types/api/browse.js";
import type { ArtistDbModel } from "../../src/types/db/artist.js";
import type { SongDbModel } from "../../src/types/db/song.js";

describe("BrowseUtils", () => {
  describe("createArtistsFolderResponses", () => {
    it("returns an empty array when artists list is empty", () => {
      const result = BrowseUtils.createArtistsFolderResponses("/prefix", []);

      expect(result).toEqual([]);
    });

    it("returns one folder response per artist", () => {
      const artists: ArtistDbModel[] = [
        { id: "artist-1", name: "The Beatles" },
        { id: "artist-2", name: "Pink Floyd" },
      ];

      const result = BrowseUtils.createArtistsFolderResponses(
        "/music/artists",
        artists,
      );

      expect(result).toHaveLength(2);
    });

    it("builds correct id using pathPrefix and artist id", () => {
      const artists: ArtistDbModel[] = [
        { id: "artist-1", name: "The Beatles" },
      ];

      const result = BrowseUtils.createArtistsFolderResponses(
        "/music/artists",
        artists,
      );

      expect(result[0].id).toBe("/music/artists/artist-1");
    });

    it("sets BrowseType.FOLDER on each response", () => {
      const artists: ArtistDbModel[] = [
        { id: "artist-1", name: "The Beatles" },
      ];

      const result = BrowseUtils.createArtistsFolderResponses(
        "/music/artists",
        artists,
      );

      expect(result[0].type).toBe(BrowseType.FOLDER);
    });

    it("sets artist name as folder name in metadata", () => {
      const artists: ArtistDbModel[] = [
        { id: "artist-1", name: "The Beatles" },
      ];

      const result = BrowseUtils.createArtistsFolderResponses(
        "/music/artists",
        artists,
      );

      expect((result[0].metadata as any).name).toBe("The Beatles");
    });
  });

  describe("createSongsBrowseResponses", () => {
    it("returns an empty array when songs list is empty", () => {
      const result = BrowseUtils.createSongsBrowseResponses("/prefix", []);

      expect(result).toEqual([]);
    });

    it("returns one song response per song", () => {
      const songs: SongDbModel[] = [
        {
          id: "song-1",
          name: "Hey Jude",
          artist: "The Beatles",
          artistsId: [],
        },
        {
          id: "song-2",
          name: "Comfortably Numb",
          artist: "Pink Floyd",
          artistsId: [],
        },
      ];

      const result = BrowseUtils.createSongsBrowseResponses(
        "/music/songs",
        songs,
      );

      expect(result).toHaveLength(2);
    });

    it("builds correct id using pathPrefix and song id", () => {
      const songs: SongDbModel[] = [
        {
          id: "song-1",
          name: "Hey Jude",
          artist: "The Beatles",
          artistsId: [],
        },
      ];

      const result = BrowseUtils.createSongsBrowseResponses(
        "/music/songs",
        songs,
      );

      expect(result[0].id).toBe("/music/songs/song-1");
    });

    it("sets BrowseType.SONG on each response", () => {
      const songs: SongDbModel[] = [
        {
          id: "song-1",
          name: "Hey Jude",
          artist: "The Beatles",
          artistsId: [],
        },
      ];

      const result = BrowseUtils.createSongsBrowseResponses(
        "/music/songs",
        songs,
      );

      expect(result[0].type).toBe(BrowseType.SONG);
    });

    it("maps song title and artist from db model", () => {
      const songs: SongDbModel[] = [
        {
          id: "song-1",
          name: "Hey Jude",
          artist: "The Beatles",
          artistsId: ["artist-1"],
          album: "The Beatles Again",
          albumId: "album-1",
          trackNumber: 1,
          diskNumber: 1,
        },
      ];

      const result = BrowseUtils.createSongsBrowseResponses(
        "/music/songs",
        songs,
      );

      const song = result[0].metadata as any;
      expect(song.title).toBe("Hey Jude");
      expect(song.artist).toBe("The Beatles");
      expect(song.artistsId).toEqual(["artist-1"]);
      expect(song.album).toBe("The Beatles Again");
      expect(song.albumId).toBe("album-1");
      expect(song.trackNumber).toBe(1);
      expect(song.diskNumber).toBe(1);
    });
  });
});
