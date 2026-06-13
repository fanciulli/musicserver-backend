/*
 * Created on Sat Jun 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AlbumDbModel } from "../../../src/types/db/album.js";

describe("AlbumDbModel.findAlbumsByArtistId", () => {
  let toArrayMock: ReturnType<typeof vi.fn>;
  let sortMock: ReturnType<typeof vi.fn>;
  let collationMock: ReturnType<typeof vi.fn>;
  let findMock: ReturnType<typeof vi.fn>;
  let dbMock: { collection: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    toArrayMock = vi.fn().mockResolvedValue([]);
    sortMock = vi.fn().mockReturnValue({ toArray: toArrayMock });
    collationMock = vi.fn().mockReturnValue({ sort: sortMock });
    findMock = vi.fn().mockReturnValue({ collation: collationMock });
    dbMock = {
      collection: vi.fn().mockReturnValue({ find: findMock }),
    };
  });

  it("filters by artistId and sorts alphabetically ascending, case-insensitively", async () => {
    await AlbumDbModel.findAlbumsByArtistId(dbMock as any, "artist-1");

    expect(dbMock.collection).toHaveBeenCalledWith("albums");
    expect(findMock).toHaveBeenCalledWith({ artists: "artist-1" });
    expect(collationMock).toHaveBeenCalledWith({ locale: "en", strength: 1 });
    expect(sortMock).toHaveBeenCalledWith({ name: 1 });
  });

  it("maps DB results to AlbumDbModel instances", async () => {
    toArrayMock.mockResolvedValue([
      { id: "id-1", name: "Abbey", pluginId: "p", artists: ["artist-1"] },
      { id: "id-2", name: "zenith", pluginId: "p", artists: ["artist-1"] },
    ]);

    const albums = await AlbumDbModel.findAlbumsByArtistId(
      dbMock as any,
      "artist-1",
    );

    expect(albums).toHaveLength(2);
    expect(albums[0]).toBeInstanceOf(AlbumDbModel);
    expect(albums.map((a) => a.name)).toEqual(["Abbey", "zenith"]);
  });
});
