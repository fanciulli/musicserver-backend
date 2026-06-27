/*
 * Created on Fri Jun 27 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Dirent } from "node:fs";

const mockReaddir = vi.fn();

vi.mock("fs/promises", () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
}));

import { listFiles } from "../../src/utils/fsUtils.js";

function makeDirent(
  name: string,
  parentPath: string,
  isDir = false,
): Dirent<string> {
  return {
    name,
    parentPath,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    path: parentPath,
  } as unknown as Dirent<string>;
}

describe("listFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when folder does not exist", async () => {
    mockReaddir.mockRejectedValue(new Error("ENOENT: no such file or directory"));

    const result = await listFiles("/nonexistent");

    expect(result).toEqual([]);
  });

  it("returns empty array when folder is empty", async () => {
    mockReaddir.mockResolvedValue([]);

    const result = await listFiles("/music");

    expect(result).toEqual([]);
  });

  it("returns full paths for files in folder", async () => {
    mockReaddir.mockResolvedValue([
      makeDirent("song.mp3", "/music"),
      makeDirent("track.flac", "/music"),
    ]);

    const result = await listFiles("/music");

    expect(result).toEqual(["/music/song.mp3", "/music/track.flac"]);
  });

  it("excludes directories from result", async () => {
    mockReaddir.mockResolvedValue([
      makeDirent("subfolder", "/music", true),
      makeDirent("song.mp3", "/music"),
    ]);

    const result = await listFiles("/music");

    expect(result).toEqual(["/music/song.mp3"]);
  });

  it("returns files from nested subfolders", async () => {
    mockReaddir.mockResolvedValue([
      makeDirent("subfolder", "/music", true),
      makeDirent("song.mp3", "/music/subfolder"),
    ]);

    const result = await listFiles("/music");

    expect(result).toEqual(["/music/subfolder/song.mp3"]);
  });

  it("skips files matching skipFileNames", async () => {
    mockReaddir.mockResolvedValue([
      makeDirent("song.mp3", "/music"),
      makeDirent("cover.jpg", "/music"),
      makeDirent("folder.jpg", "/music"),
    ]);

    const result = await listFiles("/music", ["folder.jpg"]);

    expect(result).toEqual(["/music/song.mp3", "/music/cover.jpg"]);
  });

  it("skips files with extensions in skipExtensions", async () => {
    mockReaddir.mockResolvedValue([
      makeDirent("song.mp3", "/music"),
      makeDirent("cover.jpg", "/music"),
      makeDirent("info.nfo", "/music"),
    ]);

    const result = await listFiles("/music", [], [".jpg", ".nfo"]);

    expect(result).toEqual(["/music/song.mp3"]);
  });

  it("applies both skipFileNames and skipExtensions together", async () => {
    mockReaddir.mockResolvedValue([
      makeDirent("song.mp3", "/music"),
      makeDirent("cover.jpg", "/music"),
      makeDirent("folder.jpg", "/music"),
      makeDirent("info.nfo", "/music"),
    ]);

    const result = await listFiles("/music", ["folder.jpg"], [".nfo"]);

    expect(result).toEqual(["/music/song.mp3", "/music/cover.jpg"]);
  });

  it("uses recursive readdir", async () => {
    mockReaddir.mockResolvedValue([]);

    await listFiles("/music");

    expect(mockReaddir).toHaveBeenCalledWith("/music", {
      withFileTypes: true,
      recursive: true,
    });
  });

  it("returns empty array with no skipFileNames and no skipExtensions by default", async () => {
    mockReaddir.mockResolvedValue([
      makeDirent("song.mp3", "/music"),
    ]);

    const result = await listFiles("/music");

    expect(result).toHaveLength(1);
  });
});
