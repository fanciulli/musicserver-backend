/*
 * Created on Sun Sep 20 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: (...args: unknown[]) => mocks.mkdir(...args),
  writeFile: (...args: unknown[]) => mocks.writeFile(...args),
}));

import {
  buildArtPath,
  writeArt,
} from "../../src/plugins/system/albumart-service/artPath.js";

describe("buildArtPath", () => {
  it("splits the uuid into two subfolders as described in the spec", () => {
    const uuid = "f81d4fae-7dec-11d0-a765-00a0c91e6bf6";

    expect(buildArtPath("/root", uuid)).toBe(
      `/root/f8/1d/${uuid}`,
    );
  });
});

describe("writeArt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates the parent folder and writes the art to its path", async () => {
    const uuid = "f81d4fae-7dec-11d0-a765-00a0c91e6bf6";
    const art = new Uint8Array([1, 2, 3]);

    await writeArt("/root", uuid, art);

    expect(mocks.mkdir).toHaveBeenCalledWith("/root/f8/1d", {
      recursive: true,
    });
    expect(mocks.writeFile).toHaveBeenCalledWith(`/root/f8/1d/${uuid}`, art);
  });
});
