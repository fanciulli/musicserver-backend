/*
 * Created on Sat Mar 29 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PluginConfigDBModel } from "../../../src/types/db/pluginConfig.js";

describe("PluginConfigDBModel.findByPluginId", () => {
  let collectionMock: { findOne: ReturnType<typeof vi.fn> };
  let dbMock: { collection: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    collectionMock = {
      findOne: vi.fn(),
    };

    dbMock = {
      collection: vi.fn().mockReturnValue(collectionMock),
    };
  });

  it("returns undefined when plugin is not present in collection", async () => {
    collectionMock.findOne.mockResolvedValue(undefined);

    const result = await PluginConfigDBModel.findByPluginId(
      dbMock as any,
      "music_sources",
      "missing-plugin",
    );

    expect(dbMock.collection).toHaveBeenCalledWith("pluginConfigs");
    expect(collectionMock.findOne).toHaveBeenCalledWith({
      pluginCategory: "music_sources",
      pluginId: "missing-plugin",
    });
    expect(result).toBeUndefined();
  });

  it("returns the plugin configuration when plugin exists", async () => {
    const existingPluginConfig = {
      pluginCategory: "music_sources",
      pluginId: "filesystem-music-source",
      settings: {
        musicFolder: "/music",
      },
    };
    collectionMock.findOne.mockResolvedValue(existingPluginConfig);

    const result = await PluginConfigDBModel.findByPluginId(
      dbMock as any,
      "music_sources",
      "filesystem-music-source",
    );

    expect(result).toEqual(existingPluginConfig);
  });

  it("does not return plugin when pluginCategory or pluginId do not match", async () => {
    const existingPluginConfig = {
      pluginCategory: "music_sources",
      pluginId: "filesystem-music-source",
      settings: {
        musicFolder: "/music",
      },
    };

    collectionMock.findOne.mockImplementation(async (filter) => {
      const categoryMatches =
        filter.pluginCategory === existingPluginConfig.pluginCategory;
      const idMatches = filter.pluginId === existingPluginConfig.pluginId;

      return categoryMatches && idMatches ? existingPluginConfig : undefined;
    });

    const wrongCategoryResult = await PluginConfigDBModel.findByPluginId(
      dbMock as any,
      "effects",
      "filesystem-music-source",
    );
    const wrongPluginIdResult = await PluginConfigDBModel.findByPluginId(
      dbMock as any,
      "music_sources",
      "other-plugin",
    );

    expect(wrongCategoryResult).toBeUndefined();
    expect(wrongPluginIdResult).toBeUndefined();
  });
});
