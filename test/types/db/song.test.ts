/*
 * Created on Fri May 16 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SongDbModel } from "../../../src/types/db/song.js";

describe("SongDbModel.findSongsByAlbumId", () => {
  let toArrayMock: ReturnType<typeof vi.fn>;
  let findMock: ReturnType<typeof vi.fn>;
  let collectionMock: { find: ReturnType<typeof vi.fn> };
  let dbMock: { collection: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    toArrayMock = vi.fn();
    findMock = vi.fn().mockReturnValue({ toArray: toArrayMock });
    collectionMock = {
      find: findMock,
    };
    dbMock = {
      collection: vi.fn().mockReturnValue(collectionMock),
    };
  });

  it("filters by albumId and pluginId when pluginId is provided", async () => {
    toArrayMock.mockResolvedValue([]);

    await SongDbModel.findSongsByAlbumId(dbMock as any, "album-1", "plugin-1");

    expect(dbMock.collection).toHaveBeenCalledWith("songs");
    expect(findMock).toHaveBeenCalledWith(
      {
        albumId: "album-1",
        pluginId: "plugin-1",
      },
      {},
    );
  });

  it("filters only by albumId when pluginId is not provided", async () => {
    toArrayMock.mockResolvedValue([]);

    await SongDbModel.findSongsByAlbumId(dbMock as any, "album-1");

    expect(findMock).toHaveBeenCalledWith(
      {
        albumId: "album-1",
      },
      {},
    );
  });

  it("maps DB results to SongDbModel instances", async () => {
    toArrayMock.mockResolvedValue([
      {
        id: "song-1",
        name: "Song One",
        albumId: "album-1",
        pluginId: "plugin-1",
      },
    ]);

    const result = await SongDbModel.findSongsByAlbumId(
      dbMock as any,
      "album-1",
      "plugin-1",
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toBeInstanceOf(SongDbModel);
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: "song-1",
        name: "Song One",
        albumId: "album-1",
        pluginId: "plugin-1",
      }),
    );
  });
});
