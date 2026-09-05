/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { NtStatus, SMB2_FLAGS_SERVER_TO_REDIR, Smb2Command } from "../constants.js";
import { serializeHeader, buildErrorResponse, type Smb2Header } from "../header.js";
import type { SmbSession } from "../session.js";
import type { Logger } from "../logger.js";

const RESPONSE_STRUCTURE_SIZE = 16;
const SHARE_TYPE_DISK = 1;
const MAXIMAL_ACCESS = 0x001200a9;
const HEADER_LENGTH = 64;
const IPC_SHARE = "IPC$";
const TREE_ID = 1;

/** Returned by readPath when the request's PathOffset is malformed. */
const MALFORMED_PATH = Symbol("malformed-path");

function readPath(body: Buffer): string | typeof MALFORMED_PATH {
  const pathOffset = body.readUInt16LE(4);
  const pathLength = body.readUInt16LE(6);
  const start = pathOffset - HEADER_LENGTH;
  if (start < 0) {
    return MALFORMED_PATH;
  }
  return body.subarray(start, start + pathLength).toString("utf16le");
}

function shareFromPath(path: string): string {
  const segments = path.split("\\").filter((s) => s.length > 0);
  return segments[segments.length - 1] ?? "";
}

function buildResponse(header: Smb2Header, status: number, treeId: number): Buffer {
  const responseHeader: Smb2Header = {
    creditCharge: header.creditCharge,
    status,
    command: Smb2Command.TREE_CONNECT,
    creditReqResp: 1,
    flags: header.flags | SMB2_FLAGS_SERVER_TO_REDIR,
    nextCommand: 0,
    messageId: header.messageId,
    treeId,
    sessionId: header.sessionId,
  };

  const body = Buffer.alloc(16);
  body.writeUInt16LE(RESPONSE_STRUCTURE_SIZE, 0);
  body.writeUInt8(SHARE_TYPE_DISK, 2);
  body.writeUInt8(0, 3);
  body.writeUInt32LE(0, 4);
  body.writeUInt32LE(0, 8);
  body.writeUInt32LE(MAXIMAL_ACCESS, 12);

  return Buffer.concat([serializeHeader(responseHeader), body]);
}

/**
 * Handles an SMB2 TREE_CONNECT request: accepts a connection to the
 * configured music share or the well-known IPC$ share, and rejects
 * anything else with OBJECT_NAME_NOT_FOUND.
 */
export function handleTreeConnect(
  header: Smb2Header,
  body: Buffer,
  session: SmbSession,
  shareName: string,
  logger: Logger,
): Buffer {
  const path = readPath(body);
  if (path === MALFORMED_PATH) {
    return buildErrorResponse(header, NtStatus.INVALID_PARAMETER);
  }

  const requestedShare = shareFromPath(path);

  const isKnownShare =
    requestedShare.toLowerCase() === shareName.toLowerCase() ||
    requestedShare.toLowerCase() === IPC_SHARE.toLowerCase();

  if (!isKnownShare) {
    logger.warn?.(
      `sonos-smb: rejected TREE_CONNECT to "${requestedShare}": no such share ` +
        `(configured share is "${shareName}")`,
    );
    return buildErrorResponse(header, NtStatus.OBJECT_NAME_NOT_FOUND);
  }

  void session;
  return buildResponse(header, NtStatus.SUCCESS, TREE_ID);
}
