/*
 * Created on Sun Sep 20 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchArtFromLastFm } from "../../src/plugins/system/coverart/lastfm.js";

describe("fetchArtFromLastFm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns undefined when no API key is configured", async () => {
    const result = await fetchArtFromLastFm("", "album", "Artist", "Album");
    expect(result).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fetches album art using the extralarge image", async () => {
    (fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          album: {
            image: [
              { "#text": "", size: "small" },
              { "#text": "http://example.com/large.jpg", size: "extralarge" },
            ],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      });

    const result = await fetchArtFromLastFm(
      "api-key",
      "album",
      "Artist",
      "Album",
    );

    expect(result).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("method=album.getinfo"),
    );
    expect(fetch).toHaveBeenNthCalledWith(2, "http://example.com/large.jpg");
  });

  it("returns undefined when Last.fm has no matching art", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ album: {} }),
    });

    const result = await fetchArtFromLastFm(
      "api-key",
      "album",
      "Artist",
      "Album",
    );

    expect(result).toBeUndefined();
  });

  it("returns undefined and does not throw on network error", async () => {
    (fetch as any).mockRejectedValueOnce(new Error("network down"));

    const result = await fetchArtFromLastFm(
      "api-key",
      "artist",
      "Artist",
      "Album",
    );

    expect(result).toBeUndefined();
  });
});
