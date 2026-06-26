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
  let sortMock: ReturnType<typeof vi.fn>;
  let findMock: ReturnType<typeof vi.fn>;
  let collectionMock: { find: ReturnType<typeof vi.fn> };
  let dbMock: { collection: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    toArrayMock = vi.fn();
    sortMock = vi.fn().mockReturnValue({ toArray: toArrayMock });
    findMock = vi.fn().mockReturnValue({ sort: sortMock });
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

  it("sorts songs by disk number then track number, ascending", async () => {
    toArrayMock.mockResolvedValue([]);

    await SongDbModel.findSongsByAlbumId(dbMock as any, "album-1");

    expect(sortMock).toHaveBeenCalledWith({ diskNumber: 1, trackNumber: 1 });
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

describe("SongDbModel.count", () => {
  let countDocumentsMock: ReturnType<typeof vi.fn>;
  let collectionMock: { countDocuments: ReturnType<typeof vi.fn> };
  let dbMock: { collection: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    countDocumentsMock = vi.fn().mockResolvedValue(0);
    collectionMock = {
      countDocuments: countDocumentsMock,
    };
    dbMock = {
      collection: vi.fn().mockReturnValue(collectionMock),
    };
  });

  it("counts all songs when no pluginId is provided", async () => {
    countDocumentsMock.mockResolvedValue(42);

    const result = await SongDbModel.count(dbMock as any);

    expect(dbMock.collection).toHaveBeenCalledWith("songs");
    expect(countDocumentsMock).toHaveBeenCalledWith({});
    expect(result).toBe(42);
  });

  it("counts only the given plugin's songs when pluginId is provided", async () => {
    countDocumentsMock.mockResolvedValue(7);

    const result = await SongDbModel.count(dbMock as any, "plugin-1");

    expect(countDocumentsMock).toHaveBeenCalledWith({ pluginId: "plugin-1" });
    expect(result).toBe(7);
  });
});
