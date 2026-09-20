/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { MAX_READ_SIZE, NtStatus, SMB2_FLAGS_SERVER_TO_REDIR, Smb2Command } from "../constants.js";
import { serializeHeader, type Smb2Header } from "../header.js";
import type { ActiveStream, OpenHandle, SmbSession } from "../session.js";
import * as fileReader from "../../library/fileReader.js";

const RESPONSE_DATA_OFFSET = 80;

function buildResponseHeader(header: Smb2Header, status: number): Smb2Header {
  return {
    creditCharge: header.creditCharge,
    status,
    command: Smb2Command.READ,
    creditReqResp: 1,
    flags: header.flags | SMB2_FLAGS_SERVER_TO_REDIR,
    nextCommand: 0,
    messageId: header.messageId,
    treeId: header.treeId,
    sessionId: header.sessionId,
  };
}

function buildErrorResponse(header: Smb2Header, status: number): Buffer {
  const responseHeader = buildResponseHeader(header, status);
  const body = Buffer.from([9, 0, 0, 0]);
  return Buffer.concat([serializeHeader(responseHeader), body]);
}

function buildReadResponse(header: Smb2Header, status: number, data: Buffer): Buffer {
  const responseHeader = buildResponseHeader(header, status);

  const body = Buffer.alloc(16);
  body.writeUInt16LE(17, 0); // StructureSize
  body.writeUInt8(RESPONSE_DATA_OFFSET, 2); // DataOffset
  body.writeUInt8(0, 3); // Reserved
  body.writeUInt32LE(data.length, 4); // DataLength
  body.writeUInt32LE(0, 8); // DataRemaining
  body.writeUInt32LE(0, 12); // Reserved2

  return Buffer.concat([serializeHeader(responseHeader), body, data]);
}

/**
 * Pulls exactly `length` bytes starting at `state.nextOffset` from the
 * originator plugin's stream, reopening it first if the caller seeked (the
 * requested `offset` doesn't match where the stream left off). Bytes pulled
 * past `length` are kept in `state.pending` for the next call, since a
 * plugin's stream chunks rarely align with SMB2 READ boundaries.
 */
async function readFromPlugin(
  handle: OpenHandle,
  offset: number,
  length: number,
): Promise<Buffer> {
  let state = handle.activeStream as ActiveStream;

  if (offset !== state.nextOffset) {
    const [stream] = await handle.plugin!.stream(handle.id!, offset);
    // Audio streams never switch encoding, so chunks are always Buffer.
    const iterator = stream[Symbol.asyncIterator]() as AsyncIterator<Buffer>;
    state = { iterator, nextOffset: offset, pending: Buffer.alloc(0) };
    handle.activeStream = state;
  }

  let buffered = state.pending;
  while (buffered.length < length) {
    const { value, done } = await state.iterator.next();
    if (done) {
      break;
    }
    buffered = Buffer.concat([buffered, value]);
  }

  const data = buffered.subarray(0, length);
  state.pending = buffered.subarray(length);
  state.nextOffset = offset + data.length;

  return data;
}

/**
 * Handles an SMB2 READ request for an already-open song handle: reads the
 * requested byte range from the underlying file and returns it. Reading at
 * or past end-of-file yields an empty buffer with status END_OF_FILE, as
 * required by the SMB2 protocol.
 */
export async function handleRead(header: Smb2Header, body: Buffer, session: SmbSession): Promise<Buffer> {
  // Clamp to MAX_READ_SIZE (also advertised in NEGOTIATE): an unbounded or
  // maliciously oversized Length would otherwise trigger a huge allocation,
  // and any payload above 16 MiB would have its NetBIOS length prefix
  // truncated by frame()'s 24-bit mask, corrupting the stream.
  const length = Math.min(body.readUInt32LE(4), MAX_READ_SIZE);
  const offset = Number(body.readBigUInt64LE(8));
  const fileId = body.subarray(16, 32);

  const handle = session.handles.get(fileId.toString("hex"));
  if (handle === undefined) {
    return buildErrorResponse(header, NtStatus.INVALID_PARAMETER);
  }

  // Cover art (folder.jpg) is served from the bytes captured at open time.
  if (handle.kind === "cover" && handle.coverData !== undefined) {
    const slice = handle.coverData.subarray(offset, offset + length);
    if (slice.length === 0 && length > 0) {
      return buildReadResponse(header, NtStatus.END_OF_FILE, slice);
    }
    return buildReadResponse(header, NtStatus.SUCCESS, slice);
  }

  if (handle.kind !== "song") {
    return buildErrorResponse(header, NtStatus.INVALID_PARAMETER);
  }

  if (handle.activeStream !== undefined) {
    const data = await readFromPlugin(handle, offset, length);
    if (data.length === 0 && length > 0) {
      return buildReadResponse(header, NtStatus.END_OF_FILE, data);
    }
    return buildReadResponse(header, NtStatus.SUCCESS, data);
  }

  if (handle.filePath === undefined) {
    return buildErrorResponse(header, NtStatus.INVALID_PARAMETER);
  }

  const data = await fileReader.read(handle.filePath, offset, length);

  if (data.length === 0 && length > 0) {
    return buildReadResponse(header, NtStatus.END_OF_FILE, data);
  }

  return buildReadResponse(header, NtStatus.SUCCESS, data);
}
