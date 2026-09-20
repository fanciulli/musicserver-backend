/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, it, expect } from "vitest";
import { handleTreeConnect } from "../../../../src/plugins/device_connectors/sonos-smb/smb/handlers/treeConnect.js";
import { parseHeader } from "../../../../src/plugins/device_connectors/sonos-smb/smb/header.js";
import { SmbSession } from "../../../../src/plugins/device_connectors/sonos-smb/smb/session.js";
import { NtStatus } from "../../../../src/plugins/device_connectors/sonos-smb/smb/constants.js";

function treeBody(path: string): Buffer {
  const p = Buffer.from(path, "utf16le");
  const head = Buffer.alloc(8);
  head.writeUInt16LE(9, 0);
  head.writeUInt16LE(8 + 64, 4);
  head.writeUInt16LE(p.length, 6);
  return Buffer.concat([head, p]);
}
const hdr = {
  creditCharge: 1,
  status: 0,
  command: 3,
  creditReqResp: 1,
  flags: 0,
  nextCommand: 0,
  messageId: 2n,
  treeId: 0,
  sessionId: 1n,
} as any;

function fakeLogger() {
  const warnings: string[] = [];
  return {
    info() {},
    error() {},
    warn: (msg: string) => warnings.push(msg),
    warnings,
  };
}

describe("TREE_CONNECT", () => {
  it("accepts the Music share", () => {
    const r = handleTreeConnect(
      hdr,
      treeBody("\\\\srv\\Music"),
      new SmbSession(),
      "Music",
      fakeLogger(),
    );
    expect(parseHeader(r).status).toBe(NtStatus.SUCCESS);
    expect(r.readUInt8(64 + 2)).toBe(1);
  });
  it("rejects unknown shares and logs why", () => {
    const logger = fakeLogger();
    const r = handleTreeConnect(
      hdr,
      treeBody("\\\\srv\\Nope"),
      new SmbSession(),
      "Music",
      logger,
    );
    expect(parseHeader(r).status >>> 0).toBe(NtStatus.OBJECT_NAME_NOT_FOUND);
    expect(logger.warnings[0]).toMatch(/Nope/);
  });
});
