import { describe, it, expect } from "vitest";
import { md4 } from "../../../../src/plugins/device_connectors/sonos-smb/smb/md4.js";

// RFC 1320, Appendix A.5 test suite. Verified against node:crypto's own
// (legacy-provider) MD4 implementation as ground truth.
const VECTORS: Array<[string, string]> = [
  ["", "31d6cfe0d16ae931b73c59d7e0c089c0"],
  ["a", "bde52cb31de33e46245e05fbdbd6fb24"],
  ["abc", "a448017aaf21d8525fc10ae87aa6729d"],
  ["message digest", "d9130a8164549fe818874806e1c7014b"],
  ["abcdefghijklmnopqrstuvwxyz", "d79e1c308aa5bbcdeea8ed63df412da9"],
  [
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    "043f8582f241db351ce627e153e7f0e4",
  ],
  [
    "1234567890".repeat(8),
    "e33b4ddc9c38f2199c3e7b164fcc0536",
  ],
];

describe("md4", () => {
  it.each(VECTORS)("matches the RFC 1320 vector for %j", (input, expected) => {
    expect(md4(Buffer.from(input, "ascii")).toString("hex")).toBe(expected);
  });
});
