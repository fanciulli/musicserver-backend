/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { NtStatus, SMB2_FLAGS_SERVER_TO_REDIR, Smb2Command } from "../constants.js";
import { serializeHeader, type Smb2Header } from "../header.js";
import type { SmbSession } from "../session.js";
import type { LibraryTree, LibNode } from "../../library/libraryTree.js";
import * as fileReader from "../../library/fileReader.js";

const HEADER_LENGTH = 64;
const OUTPUT_BUFFER_OFFSET = 72;

const FILE_ATTRIBUTE_READONLY = 0x00000001;
const FILE_ATTRIBUTE_DIRECTORY = 0x00000010;
const FILE_ATTRIBUTE_ARCHIVE = 0x00000020;

const SMB2_RESTART_SCANS = 0x01;
const SMB2_RETURN_SINGLE_ENTRY = 0x02;

const FILE_FULL_DIRECTORY_INFORMATION = 0x02;
const FILE_BOTH_DIRECTORY_INFORMATION = 0x03;
const FILE_ID_BOTH_DIRECTORY_INFORMATION = 0x25;
const FILE_ID_FULL_DIRECTORY_INFORMATION = 0x26;

/**
 * Byte offset of the FileName within a directory-entry structure, per
 * information class (the fields before the name differ between classes).
 */
function nameOffsetForClass(infoClass: number): number {
  switch (infoClass) {
    case FILE_FULL_DIRECTORY_INFORMATION:
      return 68; // ...EaSize(4)@64, name@68
    case FILE_ID_FULL_DIRECTORY_INFORMATION:
      return 80; // ...EaSize(4)@64, Reserved(4)@68, FileId(8)@72, name@80
    case FILE_BOTH_DIRECTORY_INFORMATION:
      return 94; // ...EaSize(4)@64, ShortName fields@68..93, name@94
    case FILE_ID_BOTH_DIRECTORY_INFORMATION:
    default:
      return 104; // ...ShortName@70..93, Reserved2(2)@94, FileId(8)@96, name@104
  }
}

/** A single directory entry pending enumeration. */
interface DirEntry {
  name: string;
  isDirectory: boolean;
  filePath?: string;
  size?: number;
}

function buildResponseHeader(header: Smb2Header, status: number): Smb2Header {
  return {
    creditCharge: header.creditCharge,
    status,
    command: Smb2Command.QUERY_DIRECTORY,
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

function buildSuccessResponse(header: Smb2Header, status: number, entries: Buffer): Buffer {
  const responseHeader = buildResponseHeader(header, status);

  const body = Buffer.alloc(8);
  body.writeUInt16LE(9, 0);
  body.writeUInt16LE(OUTPUT_BUFFER_OFFSET, 2);
  body.writeUInt32LE(entries.length, 4);

  return Buffer.concat([serializeHeader(responseHeader), body, entries]);
}

/**
 * Serializes a single directory entry as FileBothDirectoryInformation (0x03)
 * or FileIdBothDirectoryInformation (0x25), 8-byte aligned. `nextEntryOffset`
 * is 0 for the last entry emitted, or the entry's own (padded) length
 * otherwise.
 */
function serializeEntry(entry: DirEntry, infoClass: number, nextEntryOffset: number): Buffer {
  const nameBuf = Buffer.from(entry.name, "utf16le");
  const nameOffset = nameOffsetForClass(infoClass);
  const baseLength = nameOffset + nameBuf.length;
  const paddedLength = Math.ceil(baseLength / 8) * 8;

  const buf = Buffer.alloc(paddedLength);
  buf.writeUInt32LE(nextEntryOffset, 0);
  buf.writeUInt32LE(0, 4); // FileIndex

  const fileTime = (BigInt(Date.now()) + 11644473600000n) * 10000n;
  buf.writeBigUInt64LE(fileTime, 8); // CreationTime
  buf.writeBigUInt64LE(fileTime, 16); // LastAccessTime
  buf.writeBigUInt64LE(fileTime, 24); // LastWriteTime
  buf.writeBigUInt64LE(fileTime, 32); // ChangeTime

  const size: bigint = entry.isDirectory ? 0n : BigInt(entry.size ?? 0);
  buf.writeBigUInt64LE(size, 40); // EndOfFile
  buf.writeBigUInt64LE(size, 48); // AllocationSize

  const fileAttributes = entry.isDirectory
    ? FILE_ATTRIBUTE_DIRECTORY
    : FILE_ATTRIBUTE_ARCHIVE | FILE_ATTRIBUTE_READONLY;
  buf.writeUInt32LE(fileAttributes, 56);
  buf.writeUInt32LE(nameBuf.length, 60); // FileNameLength (bytes)
  buf.writeUInt32LE(0, 64); // EaSize (common to all supported classes)

  // "Both" classes carry an 8.3 ShortName block (zeroed here); the FileId
  // variants add an 8-byte FileId (left 0 — not needed for browsing).
  if (
    infoClass === FILE_BOTH_DIRECTORY_INFORMATION ||
    infoClass === FILE_ID_BOTH_DIRECTORY_INFORMATION
  ) {
    buf.writeUInt8(0, 68); // ShortNameLength
    buf.writeUInt8(0, 69); // Reserved
    // ShortName(24) @70 stays zeroed.
    if (infoClass === FILE_ID_BOTH_DIRECTORY_INFORMATION) {
      buf.writeUInt16LE(0, 94); // Reserved2
      buf.writeBigUInt64LE(0n, 96); // FileId
    }
  } else if (infoClass === FILE_ID_FULL_DIRECTORY_INFORMATION) {
    buf.writeUInt32LE(0, 68); // Reserved
    buf.writeBigUInt64LE(0n, 72); // FileId
  }
  // FILE_FULL_DIRECTORY_INFORMATION: nothing between EaSize and the name.

  nameBuf.copy(buf, nameOffset);

  return buf;
}

async function toDirEntry(node: LibNode): Promise<DirEntry> {
  if (node.kind === "song") {
    const size = node.filePath !== undefined ? await fileReader.size(node.filePath) : 0;
    return { name: node.name, isDirectory: false, filePath: node.filePath, size };
  }
  return { name: node.name, isDirectory: true };
}

/**
 * Handles an SMB2 QUERY_DIRECTORY request: enumerates the children of an
 * already-open directory handle, paging results across successive calls via
 * a cursor stored on the handle.
 */
export async function handleQueryDirectory(
  header: Smb2Header,
  body: Buffer,
  session: SmbSession,
  library: LibraryTree,
): Promise<Buffer> {
  const infoClass = body.readUInt8(2);
  const flags = body.readUInt8(3);
  const fileId = body.subarray(8, 24);
  const outputBufferLength = body.readUInt32LE(28);

  if (
    infoClass !== FILE_FULL_DIRECTORY_INFORMATION &&
    infoClass !== FILE_BOTH_DIRECTORY_INFORMATION &&
    infoClass !== FILE_ID_BOTH_DIRECTORY_INFORMATION &&
    infoClass !== FILE_ID_FULL_DIRECTORY_INFORMATION
  ) {
    return buildErrorResponse(header, NtStatus.INVALID_INFO_CLASS);
  }

  const handle = session.handles.get(fileId.toString("hex"));
  if (handle === undefined) {
    return buildErrorResponse(header, NtStatus.INVALID_PARAMETER);
  }

  const restart = (flags & SMB2_RESTART_SCANS) !== 0 || handle.cursor === undefined;
  if (restart) {
    handle.cursor = 0;
  }

  const node: LibNode = {
    kind: handle.kind,
    name: "",
    id: handle.id,
    filePath: handle.filePath,
  };
  const children = await library.listChildren(node);

  const allEntries: DirEntry[] = [
    { name: ".", isDirectory: true },
    { name: "..", isDirectory: true },
    ...(await Promise.all(children.map((child) => toDirEntry(child)))),
  ];

  const cursor = handle.cursor ?? 0;
  if (cursor >= allEntries.length) {
    return buildSuccessResponse(header, NtStatus.NO_MORE_FILES, Buffer.alloc(0));
  }

  const singleEntry = (flags & SMB2_RETURN_SINGLE_ENTRY) !== 0;
  const buffers: Buffer[] = [];
  let totalLength = 0;
  let consumed = 0;
  let index = cursor;

  while (index < allEntries.length) {
    const serialized = serializeEntry(allEntries[index], infoClass, 0);
    if (totalLength + serialized.length > outputBufferLength) {
      if (buffers.length === 0) {
        // The very first candidate entry does not fit in the client's
        // requested buffer. We must not exceed OutputBufferLength, so
        // report BUFFER_OVERFLOW with an empty body and leave the cursor
        // untouched so a retry with a larger buffer can still see this entry.
        return buildSuccessResponse(header, NtStatus.BUFFER_OVERFLOW, Buffer.alloc(0));
      }
      break;
    }
    buffers.push(serialized);
    totalLength += serialized.length;
    consumed += 1;
    index += 1;
    if (singleEntry) {
      break;
    }
  }

  // Fix up NextEntryOffset: every entry but the last points to the next
  // entry's own (padded) length; the last emitted entry is 0.
  for (let i = 0; i < buffers.length - 1; i += 1) {
    buffers[i].writeUInt32LE(buffers[i].length, 0);
  }

  handle.cursor = cursor + consumed;

  return buildSuccessResponse(header, NtStatus.SUCCESS, Buffer.concat(buffers));
}
