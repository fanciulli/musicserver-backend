import { describe, it, expect, vi } from "vitest";
import { LibraryTree } from "../../../../src/plugins/device_connectors/sonos-smb/library/libraryTree.js";
import { ArtistDbModel } from "../../../../src/types/db/artist.js";
import { AlbumDbModel } from "../../../../src/types/db/album.js";
import { SongDbModel } from "../../../../src/types/db/song.js";

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
});
