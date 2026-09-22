/*
 * Created on Mon Sep 22 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStartedAlbumArtPlugin } from "../../src/utils/albumArtPluginResolver.js";
import { AlbumArtPlugin } from "../../src/types/plugins/albumArt.js";
import { PluginDBModel, PluginStatus } from "../../src/types/db/plugin.js";
import type { Context } from "../../src/types/context.js";

class FakeAlbumArtPlugin extends AlbumArtPlugin {
  id = "albumart-service";
  name = "Album Art Service";
  async getArt() {
    return undefined;
  }
  async storeArt() {}
}

function makeContext(plugin: unknown): Context {
  return {
    database: "db" as any,
    logger: { info: vi.fn(), warn: vi.fn() },
    pluginManager: { getPluginById: () => plugin },
  } as unknown as Context;
}

describe("getStartedAlbumArtPlugin", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns the plugin when present and started", async () => {
    const plugin = new FakeAlbumArtPlugin({} as any);
    vi.spyOn(PluginDBModel, "find").mockResolvedValue({
      status: PluginStatus.STARTED,
    } as any);

    await expect(getStartedAlbumArtPlugin(makeContext(plugin))).resolves.toBe(
      plugin,
    );
  });

  it("returns undefined when the plugin is present but not started", async () => {
    const plugin = new FakeAlbumArtPlugin({} as any);
    vi.spyOn(PluginDBModel, "find").mockResolvedValue({
      status: PluginStatus.STOPPED,
    } as any);

    await expect(
      getStartedAlbumArtPlugin(makeContext(plugin)),
    ).resolves.toBeUndefined();
  });

  it("returns undefined when the plugin is not registered", async () => {
    await expect(
      getStartedAlbumArtPlugin(makeContext(undefined)),
    ).resolves.toBeUndefined();
  });
});
