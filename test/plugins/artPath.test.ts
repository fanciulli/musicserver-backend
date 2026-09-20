/*
 * Created on Sun Sep 20 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, expect, it } from "vitest";
import { buildArtPath } from "../../src/plugins/system/albumart-service/artPath.js";

describe("buildArtPath", () => {
  it("splits the uuid into two subfolders as described in the spec", () => {
    const uuid = "f81d4fae-7dec-11d0-a765-00a0c91e6bf6";

    expect(buildArtPath("/root", uuid)).toBe(
      `/root/f8/1d/${uuid}`,
    );
  });
});
