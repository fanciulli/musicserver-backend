import { describe, it, expect } from "vitest";
import SonosSmbPlugin from "../../../../src/plugins/device_connectors/sonos-smb/index.js";

const ctx = { logger: { info() {}, error() {} }, database: {} } as any;

describe("SonosSmbPlugin bootstrap", () => {
  it("has the sharing category and stable id", () => {
    const plugin = new SonosSmbPlugin(ctx);
    expect(plugin.category).toBe("device_connectors");
    expect(plugin.id).toBe("sonos-smb-connector");
  });
});
