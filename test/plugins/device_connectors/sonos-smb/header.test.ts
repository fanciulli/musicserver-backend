import { describe, it, expect } from "vitest";
import { parseHeader, serializeHeader } from "../../../../src/plugins/device_connectors/sonos-smb/smb/header.js";
import { Smb2Command, SMB2_FLAGS_SERVER_TO_REDIR } from "../../../../src/plugins/device_connectors/sonos-smb/smb/constants.js";

describe("SMB2 header codec", () => {
  it("round-trips a header", () => {
    const h = {
      creditCharge: 1, status: 0, command: Smb2Command.NEGOTIATE,
      creditReqResp: 1, flags: SMB2_FLAGS_SERVER_TO_REDIR, nextCommand: 0,
      messageId: 5n, treeId: 0, sessionId: 0n,
    };
    const parsed = parseHeader(serializeHeader(h));
    expect(parsed).toMatchObject(h);
  });

  it("rejects a non-SMB2 magic", () => {
    expect(() => parseHeader(Buffer.alloc(64))).toThrow();
  });
});
