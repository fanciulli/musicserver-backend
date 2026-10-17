/*
 * Created on Wed Sep 24 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchArtFromDeezer } from "../../src/plugins/system/coverart/deezer.js";

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body } as any;
}

function bytesResponse(bytes: number[]) {
  return {
    ok: true,
    arrayBuffer: async () => new Uint8Array(bytes).buffer,
  } as any;
}

afterEach(() => vi.restoreAllMocks());

describe("fetchArtFromDeezer", () => {
  it("returns album cover bytes from a search/album lookup", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch" as any)
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ cover_xl: "https://img/cover.jpg" }] }),
      )
      .mockResolvedValueOnce(bytesResponse([1, 2, 3]));

    const art = await fetchArtFromDeezer("album", "Artist", "Album");

    expect(art).toEqual(new Uint8Array([1, 2, 3]));
    const searchUrl = String(fetchMock.mock.calls[0][0]);
    expect(searchUrl).toContain("search/album");
    expect(searchUrl).toContain(encodeURIComponent('artist:"Artist"'));
    expect(fetchMock.mock.calls[1][0]).toBe("https://img/cover.jpg");
  });

  it("returns artist picture bytes from a search/artist lookup", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch" as any)
      .mockResolvedValueOnce(
        jsonResponse({ data: [{ picture_xl: "https://img/artist.jpg" }] }),
      )
      .mockResolvedValueOnce(bytesResponse([4, 5]));

    const art = await fetchArtFromDeezer("artist", "Artist", undefined);

    expect(art).toEqual(new Uint8Array([4, 5]));
    expect(String(fetchMock.mock.calls[0][0])).toContain("search/artist");
  });

  it("returns undefined when the search has no results", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValue(
      jsonResponse({ data: [] }),
    );

    await expect(
      fetchArtFromDeezer("album", "Artist", "Album"),
    ).resolves.toBeUndefined();
  });

  it("returns undefined when an album lookup has no album name", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch" as any);

    await expect(
      fetchArtFromDeezer("album", "Artist", undefined),
    ).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns undefined and does not throw when the request fails", async () => {
    vi.spyOn(globalThis, "fetch" as any).mockRejectedValue(
      new Error("network"),
    );

    await expect(
      fetchArtFromDeezer("artist", "Artist", undefined),
    ).resolves.toBeUndefined();
  });
});
