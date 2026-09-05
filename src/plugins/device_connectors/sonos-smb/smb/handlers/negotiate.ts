/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { randomBytes } from "node:crypto";
import {
  NtStatus,
  SMB2_FLAGS_SERVER_TO_REDIR,
  Smb2Command,
  DIALECT_202,
  DIALECT_210,
  DIALECT_300,
  DIALECT_WILDCARD,
  MAX_READ_SIZE,
} from "../constants.js";
import { serializeHeader, type Smb2Header } from "../header.js";
import type { SmbSession } from "../session.js";
import { buildNegTokenInit } from "../spnego.js";

const RESPONSE_STRUCTURE_SIZE = 65;
const SECURITY_MODE_SIGNING_ENABLED = 0x1;
const MAX_TRANSACT_SIZE = 0x100000;
const MAX_WRITE_SIZE = 0x100000;
const SECURITY_BUFFER_OFFSET = 128;
const FILETIME_EPOCH_OFFSET_MS = 11644473600000n;

const SUPPORTED_DIALECTS = [DIALECT_300, DIALECT_210, DIALECT_202];

/** Fixed for the lifetime of the process; identifies this server instance. */
const SERVER_GUID = randomBytes(16);

function pickDialect(body: Buffer): number {
  const dialectCount = body.readUInt16LE(2);
  const offered = new Set<number>();
  for (let i = 0; i < dialectCount; i++) {
    offered.add(body.readUInt16LE(36 + i * 2));
  }

  for (const dialect of SUPPORTED_DIALECTS) {
    if (offered.has(dialect)) {
      return dialect;
    }
  }

  return DIALECT_202;
}

function toFiletime(date: number): bigint {
  return (BigInt(date) + FILETIME_EPOCH_OFFSET_MS) * 10000n;
}

/** Builds the SMB2 NEGOTIATE response body (65-byte struct + security buffer). */
function buildNegotiateResponseBody(dialect: number): Buffer {
  const securityBuffer = buildNegTokenInit();

  const responseBody = Buffer.alloc(64 + securityBuffer.length);
  responseBody.writeUInt16LE(RESPONSE_STRUCTURE_SIZE, 0);
  responseBody.writeUInt16LE(SECURITY_MODE_SIGNING_ENABLED, 2);
  responseBody.writeUInt16LE(dialect, 4);
  responseBody.writeUInt16LE(0, 6); // NegotiateContextCount
  SERVER_GUID.copy(responseBody, 8);
  responseBody.writeUInt32LE(0, 24); // Capabilities
  responseBody.writeUInt32LE(MAX_TRANSACT_SIZE, 28);
  responseBody.writeUInt32LE(MAX_READ_SIZE, 32);
  responseBody.writeUInt32LE(MAX_WRITE_SIZE, 36);
  responseBody.writeBigUInt64LE(toFiletime(Date.now()), 40); // SystemTime
  responseBody.writeBigUInt64LE(0n, 48); // ServerStartTime
  responseBody.writeUInt16LE(SECURITY_BUFFER_OFFSET, 56);
  responseBody.writeUInt16LE(securityBuffer.length, 58); // SecurityBufferLength
  responseBody.writeUInt32LE(0, 60); // NegotiateContextOffset
  securityBuffer.copy(responseBody, 64);

  return responseBody;
}

/** SMB1 header magic (0xFF 'SMB') and the SMB1 NEGOTIATE command byte. */
const SMB1_MAGIC = Buffer.from([0xff, 0x53, 0x4d, 0x42]);
const SMB1_COM_NEGOTIATE = 0x72;

/**
 * True when a raw session payload is a legacy SMB1 NEGOTIATE — the
 * multi-protocol probe most native clients (Windows, macOS Finder/smbutil,
 * Sonos) send first before switching to SMB2.
 */
export function isSmb1Negotiate(payload: Buffer): boolean {
  return (
    payload.length >= 5 &&
    payload.subarray(0, 4).equals(SMB1_MAGIC) &&
    payload.readUInt8(4) === SMB1_COM_NEGOTIATE
  );
}

/**
 * Answers a legacy SMB1 multi-protocol NEGOTIATE with an SMB2 NEGOTIATE
 * response advertising the wildcard dialect (0x02FF). Per MS-SMB2 the client
 * then re-negotiates with a real SMB2 NEGOTIATE (handled by handleNegotiate).
 * Returns the full (header + body) response, unframed.
 */
export function handleSmb1Negotiate(): Buffer {
  const responseHeader: Smb2Header = {
    creditCharge: 1,
    status: NtStatus.SUCCESS,
    command: Smb2Command.NEGOTIATE,
    creditReqResp: 1,
    flags: SMB2_FLAGS_SERVER_TO_REDIR,
    nextCommand: 0,
    messageId: 0n,
    treeId: 0,
    sessionId: 0n,
  };

  return Buffer.concat([
    serializeHeader(responseHeader),
    buildNegotiateResponseBody(DIALECT_WILDCARD),
  ]);
}

/**
 * Handles an SMB2 NEGOTIATE request: selects the highest dialect the
 * client and server both support, records it on the session and returns
 * the full (header + body) NEGOTIATE response, unframed.
 */
export function handleNegotiate(
  header: Smb2Header,
  body: Buffer,
  session: SmbSession,
): Buffer {
  const dialect = pickDialect(body);
  session.dialect = dialect;

  const responseHeader: Smb2Header = {
    creditCharge: header.creditCharge,
    status: NtStatus.SUCCESS,
    command: Smb2Command.NEGOTIATE,
    creditReqResp: 1,
    flags: header.flags | SMB2_FLAGS_SERVER_TO_REDIR,
    nextCommand: 0,
    messageId: header.messageId,
    treeId: header.treeId,
    sessionId: header.sessionId,
  };

  return Buffer.concat([
    serializeHeader(responseHeader),
    buildNegotiateResponseBody(dialect),
  ]);
}
