/*
 * Created on Sat Jun 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ArtistDbModel } from "../../../src/types/db/artist.js";

describe("ArtistDbModel.findCaseInsensitive", () => {
  let findOneMock: ReturnType<typeof vi.fn>;
  let collectionMock: { findOne: ReturnType<typeof vi.fn> };
  let dbMock: { collection: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    findOneMock = vi.fn();
    collectionMock = { findOne: findOneMock };
    dbMock = {
      collection: vi.fn().mockReturnValue(collectionMock),
    };
  });

  it("queries the artists collection with an anchored case-insensitive regex", async () => {
    findOneMock.mockResolvedValue(null);

    await ArtistDbModel.findCaseInsensitive(
      dbMock as any,
      "Artist Name",
      "plugin-1",
    );

    expect(dbMock.collection).toHaveBeenCalledWith("artists");
    expect(findOneMock).toHaveBeenCalledWith({
      name: { $regex: "^Artist Name$", $options: "i" },
      pluginId: "plugin-1",
    });
  });

  it("escapes regex metacharacters in the name", async () => {
    findOneMock.mockResolvedValue(null);

    await ArtistDbModel.findCaseInsensitive(dbMock as any, "A+B (live)", "p");

    expect(findOneMock).toHaveBeenCalledWith({
      name: { $regex: "^A\\+B \\(live\\)$", $options: "i" },
      pluginId: "p",
    });
  });

  it("maps a match to an ArtistDbModel and returns undefined when absent", async () => {
    findOneMock.mockResolvedValueOnce({
      id: "id-1",
      name: "Artist Name",
      pluginId: "plugin-1",
      exists: true,
    });

    const found = await ArtistDbModel.findCaseInsensitive(
      dbMock as any,
      "ARTIST NAME",
      "plugin-1",
    );

    expect(found).toBeInstanceOf(ArtistDbModel);
    expect(found?.name).toBe("Artist Name");

    findOneMock.mockResolvedValueOnce(null);
    const missing = await ArtistDbModel.findCaseInsensitive(
      dbMock as any,
      "Nobody",
      "plugin-1",
    );
    expect(missing).toBeUndefined();
  });
});

describe("ArtistDbModel.findAll", () => {
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

  it("sorts artists alphabetically ascending, case-insensitively", async () => {
    await ArtistDbModel.findAll(dbMock as any);

    expect(dbMock.collection).toHaveBeenCalledWith("artists");
    expect(findMock).toHaveBeenCalledWith({});
    expect(collationMock).toHaveBeenCalledWith({ locale: "en", strength: 1 });
    expect(sortMock).toHaveBeenCalledWith({ name: 1 });
  });

  it("maps DB results to ArtistDbModel instances", async () => {
    toArrayMock.mockResolvedValue([
      { id: "id-1", name: "Alpha", pluginId: "p", exists: true },
      { id: "id-2", name: "beta", pluginId: "p", exists: true },
    ]);

    const artists = await ArtistDbModel.findAll(dbMock as any);

    expect(artists).toHaveLength(2);
    expect(artists[0]).toBeInstanceOf(ArtistDbModel);
    expect(artists.map((a) => a.name)).toEqual(["Alpha", "beta"]);
  });
});
