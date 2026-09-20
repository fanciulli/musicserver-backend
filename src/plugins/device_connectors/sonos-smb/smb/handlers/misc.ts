/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { randomBytes } from "node:crypto";
import { NtStatus, SMB2_FLAGS_SERVER_TO_REDIR, Smb2Command, DIALECT_300 } from "../constants.js";
import { serializeHeader, type Smb2Header } from "../header.js";
import type { SmbSession } from "../session.js";

const FSCTL_VALIDATE_NEGOTIATE_INFO = 0x00140204;

function buildResponseHeader(header: Smb2Header, status: number, command: number): Smb2Header {
  return {
    creditCharge: header.creditCharge,
    status,
    command,
    creditReqResp: 1,
    flags: header.flags | SMB2_FLAGS_SERVER_TO_REDIR,
    nextCommand: 0,
    messageId: header.messageId,
    treeId: header.treeId,
    sessionId: header.sessionId,
  };
}

function buildErrorResponse(header: Smb2Header, status: number, command: number): Buffer {
  const responseHeader = buildResponseHeader(header, status, command);
  const body = Buffer.from([9, 0, 0, 0]);
  return Buffer.concat([serializeHeader(responseHeader), body]);
}

function buildSimpleResponse(header: Smb2Header, command: number): Buffer {
  const responseHeader = buildResponseHeader(header, NtStatus.SUCCESS, command);
  const body = Buffer.alloc(4);
  body.writeUInt16LE(4, 0); // StructureSize
  body.writeUInt16LE(0, 2); // Reserved
  return Buffer.concat([serializeHeader(responseHeader), body]);
}

/**
 * Handles an SMB2 CLOSE request: drops the open handle identified by the
 * request's FileId and returns a zeroed-out close response.
 */
export function handleClose(header: Smb2Header, body: Buffer, session: SmbSession): Buffer {
  const fileId = body.subarray(8, 24);
  const handle = session.handles.get(fileId.toString("hex"));
  // Releases the plugin's underlying stream (Readable's async iterator
  // destroys it on return()) so an interrupted playback doesn't leak it.
  handle?.activeStream?.iterator.return?.();
  session.handles.delete(fileId.toString("hex"));

  const responseHeader = buildResponseHeader(header, NtStatus.SUCCESS, Smb2Command.CLOSE);

  const response = Buffer.alloc(60);
  response.writeUInt16LE(60, 0); // StructureSize
  response.writeUInt16LE(0, 2); // Flags
  response.writeUInt32LE(0, 4); // Reserved
  response.writeBigUInt64LE(0n, 8); // CreationTime
  response.writeBigUInt64LE(0n, 16); // LastAccessTime
  response.writeBigUInt64LE(0n, 24); // LastWriteTime
  response.writeBigUInt64LE(0n, 32); // ChangeTime
  response.writeBigUInt64LE(0n, 40); // AllocationSize
  response.writeBigUInt64LE(0n, 48); // EndOfFile
  response.writeUInt32LE(0, 56); // FileAttributes

  return Buffer.concat([serializeHeader(responseHeader), response]);
}

/**
 * Handles an SMB2 TREE_DISCONNECT request.
 */
export function handleTreeDisconnect(header: Smb2Header): Buffer {
  return buildSimpleResponse(header, Smb2Command.TREE_DISCONNECT);
}

/**
 * Handles an SMB2 LOGOFF request.
 */
export function handleLogoff(header: Smb2Header): Buffer {
  return buildSimpleResponse(header, Smb2Command.LOGOFF);
}

/**
 * Handles an SMB2 FLUSH request. The server is read-only, so there is
 * nothing to flush; it just acknowledges the request.
 */
export function handleFlush(header: Smb2Header): Buffer {
  return buildSimpleResponse(header, Smb2Command.FLUSH);
}

/**
 * Handles an SMB2 ECHO request (keep-alive).
 */
export function handleEcho(header: Smb2Header): Buffer {
  return buildSimpleResponse(header, Smb2Command.ECHO);
}

/**
 * Handles an SMB2 CANCEL request. CANCEL never gets a response.
 */
export function handleCancel(): undefined {
  return undefined;
}

/**
 * Handles an SMB2 IOCTL request. Only FSCTL_VALIDATE_NEGOTIATE_INFO is
 * supported (required by some clients after negotiation); every other
 * control code is rejected with NOT_SUPPORTED.
 */
export function handleIoctl(header: Smb2Header, body: Buffer, session: SmbSession): Buffer {
  const ctlCode = body.readUInt32LE(4);
  const fileId = body.subarray(8, 24);

  if (ctlCode !== FSCTL_VALIDATE_NEGOTIATE_INFO) {
    return buildErrorResponse(header, NtStatus.NOT_SUPPORTED, Smb2Command.IOCTL);
  }

  const responseHeader = buildResponseHeader(header, NtStatus.SUCCESS, Smb2Command.IOCTL);

  const output = Buffer.alloc(24);
  output.writeUInt32LE(0, 0); // Capabilities
  randomBytes(16).copy(output, 4); // ServerGuid
  output.writeUInt16LE(1, 20); // SecurityMode
  output.writeUInt16LE(session.dialect || DIALECT_300, 22); // Dialect

  const outputOffset = 64 + 48;

  const response = Buffer.alloc(48);
  response.writeUInt16LE(49, 0); // StructureSize
  response.writeUInt16LE(0, 2); // Reserved
  response.writeUInt32LE(ctlCode, 4); // CtlCode
  fileId.copy(response, 8); // FileId
  response.writeUInt32LE(0, 24); // InputOffset
  response.writeUInt32LE(0, 28); // InputCount
  response.writeUInt32LE(outputOffset, 32); // OutputOffset
  response.writeUInt32LE(output.length, 36); // OutputCount
  response.writeUInt32LE(0, 40); // Flags
  response.writeUInt32LE(0, 44); // Reserved2

  return Buffer.concat([serializeHeader(responseHeader), response, output]);
}
