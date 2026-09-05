import { describe, it, expect } from "vitest";
import { songFileName, dedupe, sanitize } from "../../../../src/plugins/device_connectors/sonos-smb/library/naming.js";

describe("naming", () => {
  it("builds a track-prefixed filename with real extension", () => {
    expect(songFileName({ name: "Come Together", trackNumber: 1, filePath: "/m/a.flac" }))
      .toBe("01 - Come Together.flac");
  });
  it("omits the disk prefix for disk 1 or unset disk", () => {
    expect(songFileName({ name: "T", trackNumber: 3, diskNumber: 1, filePath: "/m/a.flac" }))
      .toBe("03 - T.flac");
    expect(songFileName({ name: "T", trackNumber: 3, filePath: "/m/a.flac" }))
      .toBe("03 - T.flac");
  });
  it("prefixes the disk number for multi-disk albums (disk > 1)", () => {
    expect(songFileName({ name: "T", trackNumber: 3, diskNumber: 2, filePath: "/m/a.flac" }))
      .toBe("2-03 - T.flac");
  });
  it("sanitizes illegal characters", () => {
    expect(sanitize("AC/DC: Live?")).toBe("AC_DC_ Live_");
  });
  it("dedupes collisions before the extension", () => {
    expect(dedupe(["a.flac", "a.flac"])).toEqual(["a.flac", "a (1).flac"]);
  });
});
