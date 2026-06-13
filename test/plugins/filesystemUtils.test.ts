/*
 * Created on Sat Jun 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, expect, it } from "vitest";
import { pickBestArtistName } from "../../src/plugins/music_sources/filesystem-music-source/utils.js";

describe("pickBestArtistName", () => {
  it("prefers the title-cased variant over an all-caps one", () => {
    expect(
      pickBestArtistName("ARTIST NAME", "Artist Name"),
    ).toBe("Artist Name");
    expect(
      pickBestArtistName("Artist Name", "ARTIST NAME"),
    ).toBe("Artist Name");
  });

  it("prefers title case over all-lower case", () => {
    expect(pickBestArtistName("band name", "Band Name")).toBe(
      "Band Name",
    );
  });

  it("keeps the current name on a tie to avoid needless writes", () => {
    expect(pickBestArtistName("Artist Name", "Artist name")).toBe(
      "Artist Name",
    );
    expect(pickBestArtistName("Band Name", "Band Name")).toBe(
      "Band Name",
    );
  });
});
