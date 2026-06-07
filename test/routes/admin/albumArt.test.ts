/*
 * Created on Wed Mar 25 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpHeaders, MimeTypes } from "../../../src/misc/constants.js";
import { DEFAULT_ALBUM_ART } from "../../../src/resources/defaultAlbumArt.js";

const mocks = vi.hoisted(() => ({
  extractPluginId: vi.fn(),
  getPluginById: vi.fn(),
}));

vi.mock("../../../src/utils/pathUtils.js", () => ({
  extractPluginId: (...args: unknown[]) => mocks.extractPluginId(...args),
}));

vi.mock("../../../src/utils/musicSourcePluginResolver.js", () => ({
  getPluginById: (...args: unknown[]) => mocks.getPluginById(...args),
}));

import { default as AlbumArtRoute } from "../../../src/routes/music/albumArt.js";

function createResponseMock() {
  return {
    header: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

describe("AlbumArtRoute", () => {
  function createRoute() {
    return new AlbumArtRoute({
      pluginManager: {},
      database: {},
      logger: { info: vi.fn(), error: vi.fn() },
    } as any);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fails when extractPluginId throws", async () => {
    mocks.extractPluginId.mockImplementation(() => {
      throw new Error("extractPluginId failed");
    });

    const route = createRoute();
    const response = createResponseMock();

    await expect(
      route.handler({ query: { id: "broken-uri" } }, response),
    ).rejects.toThrow("extractPluginId failed");
  });

  it("fails when getPluginById invocation throws", async () => {
    mocks.extractPluginId.mockReturnValue("filesystem");
    mocks.getPluginById.mockRejectedValue(new Error("getPluginById failed"));

    const route = createRoute();
    const response = createResponseMock();

    await expect(
      route.handler({ query: { id: "filesystem://cover" } }, response),
    ).rejects.toThrow("getPluginById failed");
  });

  it("returns 404 when route execution fails", async () => {
    mocks.extractPluginId.mockReturnValue("filesystem");
    mocks.getPluginById.mockResolvedValue({
      pluginId: "filesystem",
      plugin: {
        getAlbumArt: vi.fn().mockRejectedValue(new Error("not found")),
      },
    });

    const route = createRoute();
    const response = createResponseMock();

    await route.handler({ query: { id: "filesystem://cover" } }, response);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.send).toHaveBeenCalledWith({
      error: "Album art not found",
    });
  });

  it("sends album art stream on success", async () => {
    const stream = Buffer.from("album-art");
    mocks.extractPluginId.mockReturnValue("filesystem");
    mocks.getPluginById.mockResolvedValue({
      pluginId: "filesystem",
      plugin: {
        getAlbumArt: vi.fn().mockResolvedValue(stream),
      },
    });

    const route = createRoute();
    const response = createResponseMock();

    await route.handler({ query: { id: "filesystem://cover" } }, response);

    expect(response.header).toHaveBeenCalledWith(
      HttpHeaders.CONTENT_TYPE,
      MimeTypes.APPLICATION_OCTET_STREAM,
    );
    expect(response.send).toHaveBeenCalledWith(stream);
    expect(response.status).not.toHaveBeenCalled();
  });

  it("sends fallback album art when plugin returns undefined", async () => {
    mocks.extractPluginId.mockReturnValue("filesystem");
    mocks.getPluginById.mockResolvedValue({
      pluginId: "filesystem",
      plugin: {
        getAlbumArt: vi.fn().mockResolvedValue(undefined),
      },
    });

    const route = createRoute();
    const response = createResponseMock();

    await route.handler({ query: { id: "filesystem://cover" } }, response);

    expect(response.header).toHaveBeenCalledWith(
      HttpHeaders.CONTENT_TYPE,
      MimeTypes.IMAGE_SVG_XML,
    );
    expect(response.send).toHaveBeenCalledWith(DEFAULT_ALBUM_ART);
    expect(response.status).not.toHaveBeenCalled();
  });
});
