/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { randomBytes } from "node:crypto";
import { NtStatus, SMB2_FLAGS_SERVER_TO_REDIR, Smb2Command } from "../constants.js";
import { serializeHeader, buildErrorResponse, type Smb2Header } from "../header.js";
import type { SmbSession } from "../session.js";
import {
  buildNtlmChallenge,
  buildSpnegoAcceptCompleted,
  buildSpnegoChallenge,
  isBareNtlmToken,
  isNtlmNegotiate,
} from "../spnego.js";
import { verifyNtlmAuthenticate, type SonosSmbCredentials } from "../ntlmAuth.js";
import type { Logger } from "../logger.js";

const RESPONSE_STRUCTURE_SIZE = 9;
const RESPONSE_SECURITY_BUFFER_OFFSET = 72; // 64-byte header + 8 bytes of body before the buffer
const SESSION_ID = 1n;
const SERVER_CHALLENGE_LENGTH = 8;

export interface SessionSetupResult {
  response: Buffer;
  assignSessionId?: bigint;
}

function readSecurityBuffer(header: Smb2Header, body: Buffer): Buffer {
  const HEADER_LENGTH = 64;
  const securityBufferOffset = body.readUInt16LE(12);
  const securityBufferLength = body.readUInt16LE(14);
  const start = securityBufferOffset - HEADER_LENGTH;
  return body.subarray(start, start + securityBufferLength);
}

function buildResponse(
  header: Smb2Header,
  status: number,
  sessionFlags: number,
  securityBuffer: Buffer,
): Buffer {
  const responseHeader: Smb2Header = {
    creditCharge: header.creditCharge,
    status,
    command: Smb2Command.SESSION_SETUP,
    creditReqResp: 1,
    flags: header.flags | SMB2_FLAGS_SERVER_TO_REDIR,
    nextCommand: 0,
    messageId: header.messageId,
    treeId: header.treeId,
    sessionId: header.sessionId,
  };

  const body = Buffer.alloc(8 + securityBuffer.length);
  body.writeUInt16LE(RESPONSE_STRUCTURE_SIZE, 0);
  body.writeUInt16LE(sessionFlags, 2);
  body.writeUInt16LE(RESPONSE_SECURITY_BUFFER_OFFSET, 4);
  body.writeUInt16LE(securityBuffer.length, 6);
  securityBuffer.copy(body, 8);

  return Buffer.concat([serializeHeader(responseHeader), body]);
}

/**
 * Handles an SMB2 SESSION_SETUP request, authenticating against the
 * plugin's configured username/password. An NTLMSSP NEGOTIATE (type 1)
 * token yields a CHALLENGE (type 2) wrapped in SPNEGO with
 * STATUS_MORE_PROCESSING_REQUIRED; the follow-up AUTHENTICATE (type 3)
 * token's NTLMv2 response is verified against `credentials` before the
 * session is granted. NTLMv1-only clients (whose response is too short to
 * be an NTLMv2 response) are rejected, as are wrong username/password.
 */
const FAILURE_REASON_MESSAGE: Record<string, string> = {
  "malformed-token": "malformed or unparseable NTLM AUTHENTICATE message",
  "username-mismatch": "username does not match the configured sonos-smb username",
  "response-too-short":
    "NTLM response too short to be NTLMv2 — client likely only supports NTLMv1, which is unsupported",
  "proof-mismatch": "wrong password",
};

export function handleSessionSetup(
  header: Smb2Header,
  body: Buffer,
  session: SmbSession,
  credentials: SonosSmbCredentials,
  logger: Logger,
): SessionSetupResult {
  const securityBuffer = readSecurityBuffer(header, body);

  if (isNtlmNegotiate(securityBuffer)) {
    const serverChallenge = randomBytes(SERVER_CHALLENGE_LENGTH);
    session.ntlmServerChallenge = serverChallenge;

    // Some clients (e.g. @marsaud/smb2, via its `ntlm` dependency) exchange
    // bare NTLM messages with no SPNEGO/GSS-API framing at all, and expect
    // a bare NTLM CHALLENGE back rather than one wrapped in a NegTokenResp.
    const challengeToken = isBareNtlmToken(securityBuffer)
      ? buildNtlmChallenge(serverChallenge)
      : buildSpnegoChallenge(serverChallenge);
    // Assign the session id on the interim (MORE_PROCESSING_REQUIRED)
    // response too. Per MS-SMB2 the client must carry the server-assigned
    // SessionId into the follow-up AUTHENTICATE request; strict clients
    // (e.g. macOS smbutil/Finder) reject the exchange when it stays 0.
    session.sessionId = SESSION_ID;
    const response = buildResponse(
      header,
      NtStatus.MORE_PROCESSING_REQUIRED,
      0,
      challengeToken,
    );
    return { response, assignSessionId: SESSION_ID };
  }

  const result = verifyNtlmAuthenticate(
    securityBuffer,
    session.ntlmServerChallenge,
    credentials,
  );
  session.ntlmServerChallenge = undefined;

  if (!result.authenticated) {
    const reason = result.failureReason
      ? FAILURE_REASON_MESSAGE[result.failureReason]
      : "unknown reason";
    logger.warn?.(
      `sonos-smb: rejected SMB login from user "${result.receivedUsername ?? "?"}": ${reason}`,
    );
    // A generic SMB2 ERROR response, not a SESSION_SETUP-shaped body: per
    // MS-SMB2, only STATUS_MORE_PROCESSING_REQUIRED reuses the command's
    // own response shape on this path. Sending the wrong shape here left
    // real clients (e.g. Sonos) hanging instead of surfacing the failure.
    return { response: buildErrorResponse(header, NtStatus.LOGON_FAILURE) };
  }

  session.sessionId = SESSION_ID;
  const response = buildResponse(
    header,
    NtStatus.SUCCESS,
    0,
    buildSpnegoAcceptCompleted(),
  );
  return { response, assignSessionId: SESSION_ID };
}
