import { describe, it, expect } from "vitest";
import {
  handleNegotiate,
  handleSmb1Negotiate,
  isSmb1Negotiate,
} from "../../../../src/plugins/device_connectors/sonos-smb/smb/handlers/negotiate.js";
import { parseHeader } from "../../../../src/plugins/device_connectors/sonos-smb/smb/header.js";
import { SmbSession } from "../../../../src/plugins/device_connectors/sonos-smb/smb/session.js";

function smb1NegotiateRequest(): Buffer {
  const header = Buffer.alloc(32);
  Buffer.from([0xff, 0x53, 0x4d, 0x42]).copy(header, 0); // 0xFF 'SMB'
  header.writeUInt8(0x72, 4); // SMB_COM_NEGOTIATE
  const dialects = Buffer.from(
    "\x02NT LM 0.12\0\x02SMB 2.002\0\x02SMB 2.???\0",
    "latin1",
  );
  const byteCount = Buffer.alloc(2);
  byteCount.writeUInt16LE(dialects.length, 0);
  return Buffer.concat([header, Buffer.from([0]), byteCount, dialects]);
}

function negotiateBody(dialects: number[]): Buffer {
  const b = Buffer.alloc(36 + dialects.length * 2);
  b.writeUInt16LE(36, 0); b.writeUInt16LE(dialects.length, 2);
  dialects.forEach((d, i) => b.writeUInt16LE(d, 36 + i * 2));
  return b;
}

describe("NEGOTIATE", () => {
  it("selects the highest common dialect", () => {
    const session = new SmbSession();
    const reqHeader = { creditCharge:1, status:0, command:0, creditReqResp:1, flags:0, nextCommand:0, messageId:0n, treeId:0, sessionId:0n };
    const resp = handleNegotiate(reqHeader as any, negotiateBody([0x0202,0x0210,0x0300]), session);
    const h = parseHeader(resp);
    expect(h.status).toBe(0);
    expect(resp.readUInt16LE(64 + 4)).toBe(0x0300); // DialectRevision
    expect(session.dialect).toBe(0x0300);
  });
});

describe("SMB1 multi-protocol NEGOTIATE compatibility", () => {
  it("detects a legacy SMB1 NEGOTIATE and ignores SMB2 packets", () => {
    expect(isSmb1Negotiate(smb1NegotiateRequest())).toBe(true);
    // An SMB2 packet (magic 0xFE 'SMB') must not be treated as SMB1.
    const smb2 = Buffer.concat([Buffer.from([0xfe, 0x53, 0x4d, 0x42]), Buffer.alloc(60)]);
    expect(isSmb1Negotiate(smb2)).toBe(false);
  });

  it("answers an SMB1 NEGOTIATE with an SMB2 wildcard (0x02FF) response", () => {
    const resp = handleSmb1Negotiate();
    const h = parseHeader(resp);
    expect(h.status).toBe(0);
    expect(h.command).toBe(0); // NEGOTIATE
    expect(resp.readUInt16LE(64 + 4)).toBe(0x02ff); // DialectRevision = wildcard
  });
});
