/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { SMB2_MAGIC, SMB2_FLAGS_SERVER_TO_REDIR } from "./constants.js";

const HEADER_LENGTH = 64;
const STRUCTURE_SIZE = 64;
const SIGNATURE_LENGTH = 16;
const ERROR_RESPONSE_STRUCTURE_SIZE = 9;

export interface Smb2Header {
  creditCharge: number;
  status: number;
  command: number;
  creditReqResp: number;
  flags: number;
  nextCommand: number;
  messageId: bigint;
  treeId: number;
  sessionId: bigint;
}

export function serializeHeader(header: Smb2Header): Buffer {
  const buf = Buffer.alloc(HEADER_LENGTH);

  SMB2_MAGIC.copy(buf, 0);
  buf.writeUInt16LE(STRUCTURE_SIZE, 4);
  buf.writeUInt16LE(header.creditCharge, 6);
  buf.writeUInt32LE(header.status, 8);
  buf.writeUInt16LE(header.command, 12);
  buf.writeUInt16LE(header.creditReqResp, 14);
  buf.writeUInt32LE(header.flags, 16);
  buf.writeUInt32LE(header.nextCommand, 20);
  buf.writeBigUInt64LE(header.messageId, 24);
  buf.writeUInt32LE(0, 32);
  buf.writeUInt32LE(header.treeId, 36);
  buf.writeBigUInt64LE(header.sessionId, 40);
  buf.fill(0, 48, 48 + SIGNATURE_LENGTH);

  return buf;
}

export function parseHeader(buf: Buffer): Smb2Header {
  if (buf.length < HEADER_LENGTH || !buf.subarray(0, 4).equals(SMB2_MAGIC)) {
    throw new Error("not an SMB2 message");
  }

  return {
    creditCharge: buf.readUInt16LE(6),
    status: buf.readUInt32LE(8),
    command: buf.readUInt16LE(12),
    creditReqResp: buf.readUInt16LE(14),
    flags: buf.readUInt32LE(16),
    nextCommand: buf.readUInt32LE(20),
    messageId: buf.readBigUInt64LE(24),
    treeId: buf.readUInt32LE(36),
    sessionId: buf.readBigUInt64LE(40),
  };
}

/**
 * Builds a generic SMB2 ERROR Response (MS-SMB2 §2.2.2): StructureSize(2)=9,
 * ErrorContextCount(1)=0, Reserved(1)=0, ByteCount(4)=0, no ErrorData. This
 * is the response shape any command must send on failure unless it
 * specifically documents a different failure body — used for both
 * dispatch-level failures and command handlers that reject a request
 * (e.g. SESSION_SETUP on a bad NTLM proof).
 */
export function buildErrorResponse(request: Smb2Header, status: number): Buffer {
  const responseHeader: Smb2Header = {
    creditCharge: request.creditCharge,
    status,
    command: request.command,
    creditReqResp: 1,
    flags: request.flags | SMB2_FLAGS_SERVER_TO_REDIR,
    nextCommand: 0,
    messageId: request.messageId,
    treeId: request.treeId,
    sessionId: request.sessionId,
  };

  const body = Buffer.alloc(8);
  body.writeUInt16LE(ERROR_RESPONSE_STRUCTURE_SIZE, 0);
  // ErrorContextCount(1)=0, Reserved(1)=0, ByteCount(4)=0 — left zeroed.

  return Buffer.concat([serializeHeader(responseHeader), body]);
}
