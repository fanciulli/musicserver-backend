import path from "path";
import { readdir } from "fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listFiles } from "../../src/utils/fsUtils.js";

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
    ] as never);

    const result = await listFiles("/music");

    expect(result).toEqual([
      path.join("/music", "song1.mp3"),
      path.join("/music/albums", "song2.flac"),
    ]);
  });

  it("calls readdir with recursive dirent options", async () => {
    vi.mocked(readdir).mockResolvedValue([] as never);

    await listFiles("/library");

    expect(readdir).toHaveBeenCalledWith("/library", {
      withFileTypes: true,
      recursive: true,
    });
  });
});
