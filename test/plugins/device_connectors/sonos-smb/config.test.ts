import { describe, it, expect } from "vitest";
import {
  getConfiguration,
  updateConfiguration,
  DEFAULT_CONFIG,
} from "../../../../src/plugins/device_connectors/sonos-smb/config.js";

function fakeDatabase(upsertedSettings: Record<string, unknown> = {}): any {
  return {
    collection() {
      return {
        async updateOne(_filter: unknown, update: any) {
          Object.assign(upsertedSettings, update.$set?.settings ?? update.$set);
          return undefined;
        },
      };
    },
  };
}

describe("sonos-smb config", () => {
  it("exposes shareName and username with defaults, and no port or enabled setting", () => {
    const settings = getConfiguration(DEFAULT_CONFIG);
    expect(settings.values.port).toBeUndefined();
    expect(settings.values.enabled).toBeUndefined();
    expect(settings.values.shareName).toBe("Music");
    expect(settings.values.username).toBe("");
  });

  it("echoes the configured password back (UI needs it to render/edit)", () => {
    const settings = getConfiguration({
      shareName: "Music",
      username: "sonos",
      password: "secret",
    });
    expect(settings.values.password).toBe("secret");
  });

  it("rejects an empty username or password", async () => {
    const db = fakeDatabase();
    await expect(
      updateConfiguration(db, "device_connectors", "sonos-smb-connector", {
        shareName: "Music",
        username: "",
        password: "secret",
      }),
    ).rejects.toThrow(/Username/);

    await expect(
      updateConfiguration(db, "device_connectors", "sonos-smb-connector", {
        shareName: "Music",
        username: "sonos",
        password: "",
      }),
    ).rejects.toThrow(/Password/);
  });

  it("stores the password as given", async () => {
    const db = fakeDatabase();
    const config = await updateConfiguration(
      db,
      "device_connectors",
      "sonos-smb-connector",
      { shareName: "Music", username: "sonos", password: "secret" },
    );

    expect(config.password).toBe("secret");
  });
});
