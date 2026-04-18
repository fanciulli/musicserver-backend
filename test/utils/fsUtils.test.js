/*
 * Created on Sat Apr 18 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import path from "path";
import { readdir } from "fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listFiles, listFolderNames } from "../../src/utils/fsUtils.js";
vi.mock("fs/promises", () => ({
  readdir: vi.fn(),
}));
describe("listFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("propagates readdir errors", async () => {
    const readError = new Error("read failed");
    vi.mocked(readdir).mockRejectedValue(readError);
    await expect(listFiles("/broken")).rejects.toThrow("read failed");
  });
  it("returns only files with full paths", async () => {
    vi.mocked(readdir).mockResolvedValue([
      { isDirectory: () => true, parentPath: "/music", name: "albums" },
      { isDirectory: () => false, parentPath: "/music", name: "song1.mp3" },
      {
        isDirectory: () => false,
        parentPath: "/music/albums",
        name: "song2.flac",
      },
    ]);
    const result = await listFiles("/music");
    expect(result).toEqual([
      path.join("/music", "song1.mp3"),
      path.join("/music/albums", "song2.flac"),
    ]);
  });
  it("calls readdir with recursive dirent options", async () => {
    vi.mocked(readdir).mockResolvedValue([]);
    await listFiles("/library");
    expect(readdir).toHaveBeenCalledWith("/library", {
      withFileTypes: true,
      recursive: true,
    });
  });
});

describe("listFolderNames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("propagates readdir errors", async () => {
    const readError = new Error("read failed");
    vi.mocked(readdir).mockRejectedValue(readError);

    await expect(listFolderNames("/broken")).rejects.toThrow("read failed");
  });

  it("returns only directories", async () => {
    vi.mocked(readdir).mockResolvedValue([
      { isDirectory: () => true, name: "albums" },
      { isDirectory: () => false, name: "song1.mp3" },
      { isDirectory: () => true, name: "artists" },
    ]);

    const result = await listFolderNames("/music");

    expect(result).toEqual(["albums", "artists"]);
  });

  it("calls readdir with dirent options", async () => {
    vi.mocked(readdir).mockResolvedValue([]);

    await listFolderNames("/library");

    expect(readdir).toHaveBeenCalledWith("/library", {
      withFileTypes: true,
    });
  });
});
