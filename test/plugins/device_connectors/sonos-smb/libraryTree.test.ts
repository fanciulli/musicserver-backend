import { describe, it, expect, vi } from "vitest";
import { LibraryTree } from "../../../../src/plugins/device_connectors/sonos-smb/library/libraryTree.js";
import { ArtistDbModel } from "../../../../src/types/db/artist.js";
import { AlbumDbModel } from "../../../../src/types/db/album.js";
import { SongDbModel } from "../../../../src/types/db/song.js";
import { PluginDBModel, PluginStatus } from "../../../../src/types/db/plugin.js";
import { AlbumArtPlugin } from "../../../../src/types/plugins/albumArt.js";
import { DEFAULT_COVER_JPEG } from "../../../../src/plugins/device_connectors/sonos-smb/library/defaultCover.js";

class FakeAlbumArtPlugin extends AlbumArtPlugin {
  id = "albumart-service";
  name = "Album Art Service";
  #art: Uint8Array | undefined;
  constructor(art: Uint8Array | undefined) {
    super({} as any);
    this.#art = art;
  }
  async getArt() {
    return this.#art;
  }
  async storeArt() {}
}

function contextWith(plugin: unknown) {
  return {
    database: "db",
    logger: { info: vi.fn(), warn: vi.fn() },
    pluginManager: { getPluginById: () => plugin },
  } as any;
}

describe("LibraryTree", () => {
  it("resolves artist -> album -> song by name", async () => {
    vi.spyOn(ArtistDbModel, "findAll").mockResolvedValue([{ id: "ar1", name: "Beatles" } as any]);
    vi.spyOn(AlbumDbModel, "findAlbumsByArtistId").mockResolvedValue([{ id: "al1", name: "Abbey Road" } as any]);
    vi.spyOn(SongDbModel, "findSongsByAlbumId").mockResolvedValue([{ id: "s1", name: "Come Together", trackNumber: 1, metadata: { filePath: "/m/x.flac" } } as any]);
    const tree = new LibraryTree({} as any);
    const node = await tree.resolve(["Beatles", "Abbey Road", "01 - Come Together.flac"]);
    expect(node?.kind).toBe("song");
    expect(node?.filePath).toBe("/m/x.flac");
  });

  it("carries the song's originator pluginId", async () => {
    vi.spyOn(ArtistDbModel, "findAll").mockResolvedValue([{ id: "ar1", name: "Beatles" } as any]);
    vi.spyOn(AlbumDbModel, "findAlbumsByArtistId").mockResolvedValue([{ id: "al1", name: "Abbey Road" } as any]);
    vi.spyOn(SongDbModel, "findSongsByAlbumId").mockResolvedValue([
      {
        id: "s1",
        name: "Come Together",
        trackNumber: 1,
        pluginId: "filesystem-music-source",
        metadata: { filePath: "/m/x.flac" },
      } as any,
    ]);
    const tree = new LibraryTree({} as any);
    const node = await tree.resolve(["Beatles", "Abbey Road", "01 - Come Together.flac"]);
    expect(node?.pluginId).toBe("filesystem-music-source");
  });

  describe("getCover", () => {
    it("returns the stored art from the started album art plugin", async () => {
      const art = new Uint8Array([1, 2, 3]);
      vi.spyOn(PluginDBModel, "find").mockResolvedValue({
        status: PluginStatus.STARTED,
      } as any);
      const tree = new LibraryTree(contextWith(new FakeAlbumArtPlugin(art)));

      expect(await tree.getCover("al1")).toEqual(Buffer.from(art));
    });

    it("falls back to the default cover when the plugin has no art", async () => {
      vi.spyOn(PluginDBModel, "find").mockResolvedValue({
        status: PluginStatus.STARTED,
      } as any);
      const tree = new LibraryTree(
        contextWith(new FakeAlbumArtPlugin(undefined)),
      );

      expect(await tree.getCover("al1")).toBe(DEFAULT_COVER_JPEG);
    });

    it("falls back to the default cover when the plugin is unavailable", async () => {
      const tree = new LibraryTree(contextWith(undefined));

      expect(await tree.getCover("al1")).toBe(DEFAULT_COVER_JPEG);
    });
  });
});
