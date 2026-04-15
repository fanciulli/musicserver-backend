/*
 * Created on Tue Apr 07 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpMethods } from "../../src/misc/constants.js";
import { SearchSchema } from "../../src/types/api/search.js";
const mocks = vi.hoisted(() => ({
  getPluginById: vi.fn(),
  getPluginManager: vi.fn(),
}));

vi.mock("../../src/server/musicServer.js", () => ({
  musicServerInstance: {
    getPluginManager: () => mocks.getPluginManager(),
  },
}));

vi.mock("../../src/utils/musicSourcePluginResolver.js", () => ({
  getPluginById: (...args: unknown[]) => mocks.getPluginById(...args),
}));

import { default as SearchRoute } from "../../src/routes/music/search.js";

function createResponseMock() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

describe("SearchRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers POST /music/search with the expected schema", () => {
    const route = new SearchRoute();

    expect(route.method).toBe(HttpMethods.POST);
    expect(route.url).toBe("/music/search");
    expect(route.schema).toBe(SearchSchema);
  });

  it("searches in all music source plugins when scheme is not specified", async () => {
    const pluginOne = {
      search: vi.fn().mockResolvedValue([{ id: "p1://a", type: "folder" }]),
    };
    const pluginTwo = {
      search: vi.fn().mockResolvedValue([{ id: "p2://a", type: "folder" }]),
    };
    mocks.getPluginManager.mockReturnValue({
      getPluginsInCategory: vi.fn().mockReturnValue([pluginOne, pluginTwo]),
    });

    const route = new SearchRoute();
    const response = createResponseMock();

    await route.handler(
      {
        body: {
          query: "nirvana",
          category: "album",
        },
      },
      response,
    );

    expect(pluginOne.search).toHaveBeenCalledWith("nirvana", "album");
    expect(pluginTwo.search).toHaveBeenCalledWith("nirvana", "album");
    expect(response.send).toHaveBeenCalledWith([
      { id: "p1://a", type: "folder" },
      { id: "p2://a", type: "folder" },
    ]);
  });

  it("searches only in the requested plugin when scheme is specified", async () => {
    const plugin = {
      search: vi
        .fn()
        .mockResolvedValue([{ id: "filesystem://x", type: "song" }]),
    };
    mocks.getPluginById.mockResolvedValue({
      pluginId: "filesystem",
      plugin,
    });

    const route = new SearchRoute();
    const response = createResponseMock();

    await route.handler(
      {
        body: {
          query: "queen",
          category: "song",
          scheme: "filesystem",
        },
      },
      response,
    );

    expect(mocks.getPluginById).toHaveBeenCalledWith("filesystem");
    expect(plugin.search).toHaveBeenCalledWith("queen", "song");
    expect(response.send).toHaveBeenCalledWith([
      { id: "filesystem://x", type: "song" },
    ]);
  });

  it("returns resolver error when requested plugin scheme is invalid", async () => {
    mocks.getPluginById.mockResolvedValue({
      pluginId: "broken",
      error: {
        status: 404,
        message: "Plugin broken not found",
      },
    });

    const route = new SearchRoute();
    const response = createResponseMock();

    await route.handler(
      {
        body: {
          query: "queen",
          category: "song",
          scheme: "broken",
        },
      },
      response,
    );

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.send).toHaveBeenCalledWith({
      error: "Specified plugin not found or not searchable",
    });
  });
});
