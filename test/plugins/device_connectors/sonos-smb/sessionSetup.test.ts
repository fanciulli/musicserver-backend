import { createHmac, randomBytes } from "node:crypto";
import { describe, it, expect } from "vitest";
import { handleSessionSetup } from "../../../../src/plugins/device_connectors/sonos-smb/smb/handlers/sessionSetup.js";
import { parseHeader } from "../../../../src/plugins/device_connectors/sonos-smb/smb/header.js";
import { SmbSession } from "../../../../src/plugins/device_connectors/sonos-smb/smb/session.js";
import { NtStatus } from "../../../../src/plugins/device_connectors/sonos-smb/smb/constants.js";
import {
  ntHash,
  ntHashHex,
  type SonosSmbCredentials,
} from "../../../../src/plugins/device_connectors/sonos-smb/smb/ntlmAuth.js";

function setupBody(security: Buffer): Buffer {
  const head = Buffer.alloc(24);
  head.writeUInt16LE(25, 0);
  head.writeUInt16LE(24 + 64, 12); // SecurityBufferOffset from header start
  head.writeUInt16LE(security.length, 14);
  return Buffer.concat([head, security]);
}
const ntlm = (type: number) => { const b = Buffer.alloc(12); b.write("NTLMSSP\0", 0, "latin1"); b.writeUInt32LE(type, 8); return b; };

const NEGOTIATE_UNICODE = 0x00000001;

function fakeLogger() {
  const warnings: string[] = [];
  return {
    info() {},
    error() {},
    warn: (msg: string) => warnings.push(msg),
    warnings,
  };
}

/**
 * Builds a spec-shaped NTLMSSP AUTHENTICATE (type 3) message with a real
 * NTLMv2 NTChallengeResponse, exactly as a compliant client would compute
 * it from `password` and the server's `serverChallenge`. Independent of
 * `verifyNtlmAuthenticate`'s implementation (only the `ntHash` primitive is
 * shared), so this exercises the server's verification logic for real.
 */
function buildNtlmv2Authenticate(
  username: string,
  domain: string,
  password: string,
  serverChallenge: Buffer,
): Buffer {
  const identity = Buffer.from(username.toUpperCase() + domain, "utf16le");
  const ntlmv2Hash = createHmac("md5", ntHash(password)).update(identity).digest();

  const clientChallenge = randomBytes(8);
  const temp = Buffer.concat([
    Buffer.from([0x01, 0x01, 0, 0, 0, 0, 0, 0]), // RespType, HiRespType, Z(6)
    Buffer.alloc(8), // Time
    clientChallenge,
    Buffer.alloc(4), // Z(4)
    Buffer.alloc(4), // target info: single AV_EOL
    Buffer.alloc(4), // Z(4) trailing
  ]);
  const ntProofStr = createHmac("md5", ntlmv2Hash)
    .update(Buffer.concat([serverChallenge, temp]))
    .digest();
  const ntChallengeResponse = Buffer.concat([ntProofStr, temp]);

  const domainBuf = Buffer.from(domain, "utf16le");
  const usernameBuf = Buffer.from(username, "utf16le");

  const HEADER_LEN = 64; // up to and including NegotiateFlags
  const domainOff = HEADER_LEN;
  const usernameOff = domainOff + domainBuf.length;
  const ntRespOff = usernameOff + usernameBuf.length;
  const totalLen = ntRespOff + ntChallengeResponse.length;

  const msg = Buffer.alloc(totalLen);
  Buffer.from("NTLMSSP\0", "latin1").copy(msg, 0);
  msg.writeUInt32LE(3, 8); // MessageType

  msg.writeUInt16LE(0, 12); // LmChallengeResponseLen
  msg.writeUInt16LE(0, 14); // LmChallengeResponseMaxLen

  msg.writeUInt16LE(ntChallengeResponse.length, 20); // NtChallengeResponseLen
  msg.writeUInt16LE(ntChallengeResponse.length, 22); // NtChallengeResponseMaxLen
  msg.writeUInt32LE(ntRespOff, 24); // NtChallengeResponseOffset

  msg.writeUInt16LE(domainBuf.length, 28); // DomainNameLen
  msg.writeUInt16LE(domainBuf.length, 30); // DomainNameMaxLen
  msg.writeUInt32LE(domainOff, 32); // DomainNameOffset

  msg.writeUInt16LE(usernameBuf.length, 36); // UserNameLen
  msg.writeUInt16LE(usernameBuf.length, 38); // UserNameMaxLen
  msg.writeUInt32LE(usernameOff, 40); // UserNameOffset

  msg.writeUInt32LE(NEGOTIATE_UNICODE, 60); // NegotiateFlags

  domainBuf.copy(msg, domainOff);
  usernameBuf.copy(msg, usernameOff);
  ntChallengeResponse.copy(msg, ntRespOff);

  return msg;
}

/** Runs the NEGOTIATE step and returns the server challenge it issued. */
function negotiateAndGetChallenge(
  hdr: any,
  session: SmbSession,
  credentials: SonosSmbCredentials,
): Buffer {
  const r = handleSessionSetup(hdr, setupBody(ntlm(1)), session, credentials, fakeLogger());
  // Bare NTLM negotiate (no SPNEGO wrapping) yields a bare NTLM CHALLENGE
  // back; its security buffer starts right after the 64-byte header + the
  // 8-byte SESSION_SETUP response body prefix.
  const challengeToken = r.response.subarray(64 + 8);
  return challengeToken.subarray(24, 32); // ServerChallenge, per buildNtlmChallenge()
}

describe("SESSION_SETUP", () => {
  const hdr = { creditCharge: 1, status: 0, command: 1, creditReqResp: 1, flags: 0, nextCommand: 0, messageId: 1n, treeId: 0, sessionId: 0n } as any;
  const credentials: SonosSmbCredentials = {
    username: "sonos",
    passwordNtHashHex: ntHashHex("correct horse battery staple"),
  };

  it("challenges on type 1 and assigns a non-zero session id", () => {
    const r = handleSessionSetup(hdr, setupBody(ntlm(1)), new SmbSession(), credentials, fakeLogger());
    expect(parseHeader(r.response).status >>> 0).toBe(NtStatus.MORE_PROCESSING_REQUIRED);
    // Strict clients (macOS smbutil/Finder) need the server-assigned
    // SessionId on the interim response to continue the exchange.
    expect(r.assignSessionId).toBeDefined();
    expect(r.assignSessionId).not.toBe(0n);
  });

  it("accepts a matching NTLMv2 username/password", () => {
    const session = new SmbSession();
    const serverChallenge = negotiateAndGetChallenge(hdr, session, credentials);
    const authenticate = buildNtlmv2Authenticate(
      "sonos",
      "",
      "correct horse battery staple",
      serverChallenge,
    );

    const r = handleSessionSetup(hdr, setupBody(authenticate), session, credentials, fakeLogger());
    expect(parseHeader(r.response).status >>> 0).toBe(NtStatus.SUCCESS);
    expect(r.assignSessionId).toBeDefined();
  });

  it("rejects a wrong password and logs why", () => {
    const session = new SmbSession();
    const serverChallenge = negotiateAndGetChallenge(hdr, session, credentials);
    const authenticate = buildNtlmv2Authenticate("sonos", "", "wrong password", serverChallenge);
    const logger = fakeLogger();

    const r = handleSessionSetup(hdr, setupBody(authenticate), session, credentials, logger);
    expect(parseHeader(r.response).status >>> 0).toBe(NtStatus.LOGON_FAILURE);
    expect(r.assignSessionId).toBeUndefined();
    expect(logger.warnings[0]).toMatch(/wrong password/);
    // A generic SMB2 ERROR body (not the SESSION_SETUP-shaped one), per
    // MS-SMB2 §2.2.2: StructureSize=9, ErrorContextCount=0, Reserved=0,
    // ByteCount=0, no trailing ErrorData. A malformed shape here previously
    // left real clients hanging instead of seeing the rejection.
    const responseBody = r.response.subarray(64);
    expect(responseBody.length).toBe(8);
    expect(responseBody.readUInt16LE(0)).toBe(9); // StructureSize
    expect(responseBody.readUInt32LE(4)).toBe(0); // ByteCount
  });

  it("rejects a wrong username and logs why", () => {
    const session = new SmbSession();
    const serverChallenge = negotiateAndGetChallenge(hdr, session, credentials);
    const authenticate = buildNtlmv2Authenticate(
      "someone-else",
      "",
      "correct horse battery staple",
      serverChallenge,
    );
    const logger = fakeLogger();

    const r = handleSessionSetup(hdr, setupBody(authenticate), session, credentials, logger);
    expect(parseHeader(r.response).status >>> 0).toBe(NtStatus.LOGON_FAILURE);
    expect(logger.warnings[0]).toMatch(/username/);
  });

  it("rejects unconfigured credentials (empty username/password)", () => {
    const emptyCredentials: SonosSmbCredentials = { username: "", passwordNtHashHex: "" };
    const session = new SmbSession();
    const serverChallenge = negotiateAndGetChallenge(hdr, session, emptyCredentials);
    const authenticate = buildNtlmv2Authenticate("sonos", "", "anything", serverChallenge);

    const r = handleSessionSetup(
      hdr,
      setupBody(authenticate),
      session,
      emptyCredentials,
      fakeLogger(),
    );
    expect(parseHeader(r.response).status >>> 0).toBe(NtStatus.LOGON_FAILURE);
  });
});
