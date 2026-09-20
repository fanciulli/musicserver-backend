/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, it, expect, vi } from "vitest";
import SonosSmbPlugin from "../../../../src/plugins/device_connectors/sonos-smb/index.js";
import { SmbServer } from "../../../../src/plugins/device_connectors/sonos-smb/smb/server.js";

/**
 * Minimal fake Mongo `Db` sufficient for `updateConfiguration`'s
 * `PluginConfigDBModel.upsertSettings` call (a single `collection().updateOne()`)
 * and for `new LibraryTree(db)`, which only stores the reference and never
 * queries it unless a client connects.
 */
function fakeDatabase(): any {
  return {
    collection() {
      return {
        async updateOne() {
          return undefined;
        },
        async findOne() {
          return undefined;
        },
      };
    },
  };
}

function fakeContext(): any {
  return {
    logger: { info() {}, error() {} },
    database: fakeDatabase(),
  };
}

describe("SonosSmbPlugin.start()", () => {
  describe("bind failure", () => {
    it("does not throw and leaves running=false when the well-known port is already in use", async () => {
      const listenSpy = vi
        .spyOn(SmbServer.prototype, "listen")
        .mockRejectedValueOnce(new Error("EADDRINUSE: address already in use"));

      let errorLogged = false;
      const context = fakeContext();
      context.logger.error = () => {
        errorLogged = true;
      };

      const plugin = new SonosSmbPlugin(context);
      await plugin.updateConfiguration({
        shareName: "Music",
        username: "sonos",
        password: "correct horse battery staple",
      });

      await expect(plugin.start()).resolves.toBeUndefined();

      expect(errorLogged).toBe(true);

      await plugin.stop();
      listenSpy.mockRestore();
    });
  });
});
