/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { NtStatus, SMB2_FLAGS_SERVER_TO_REDIR, Smb2Command } from "../constants.js";
import { serializeHeader, type Smb2Header } from "../header.js";
import type { SmbSession, OpenHandle } from "../session.js";
import type { LibraryTree } from "../../library/libraryTree.js";
import * as fileReader from "../../library/fileReader.js";
import type { MusicSourcePlugin } from "../../../../../types/plugins/music_sources.js";

/** Resolves a MusicSourcePlugin by id, or undefined if not found/not started. */
export type PluginResolver = (
  pluginId: string,
) => Promise<MusicSourcePlugin | undefined>;

const HEADER_LENGTH = 64;
const RESPONSE_STRUCTURE_SIZE = 89;
const RESPONSE_BODY_LENGTH = 88;
const FILE_OPENED = 1;

const FILE_WRITE_DATA = 0x00000002;
const FILE_APPEND_DATA = 0x00000004;
const FILE_WRITE_EA = 0x00000010;
const FILE_WRITE_ATTRIBUTES = 0x00000100;
const DELETE = 0x00010000;
const GENERIC_WRITE = 0x40000000;
const WRITE_ACCESS_MASK =
  FILE_WRITE_DATA | FILE_APPEND_DATA | FILE_WRITE_EA | FILE_WRITE_ATTRIBUTES | DELETE | GENERIC_WRITE;

const CREATE_DISPOSITION_OPEN = 1;
const CREATE_DISPOSITION_OPEN_IF = 3;

const FILE_ATTRIBUTE_READONLY = 0x00000001;
const FILE_ATTRIBUTE_DIRECTORY = 0x00000010;
const FILE_ATTRIBUTE_ARCHIVE = 0x00000020;

/** Returned by readName when the request's NameOffset is malformed. */
const MALFORMED_NAME = Symbol("malformed-name");

function readName(body: Buffer): string | typeof MALFORMED_NAME {
  const nameOffset = body.readUInt16LE(44);
  const nameLength = body.readUInt16LE(46);
  if (nameLength === 0) {
    return "";
  }
  const start = nameOffset - HEADER_LENGTH;
  if (start < 0) {
    return MALFORMED_NAME;
  }
  return body.subarray(start, start + nameLength).toString("utf16le");
}

function buildResponseHeader(header: Smb2Header, status: number): Smb2Header {
  return {
    creditCharge: header.creditCharge,
    status,
    command: Smb2Command.CREATE,
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

function buildSuccessResponse(
  header: Smb2Header,
  fileId: Buffer,
  fileAttributes: number,
  size: number,
): Buffer {
  const responseHeader = buildResponseHeader(header, NtStatus.SUCCESS);

  const body = Buffer.alloc(RESPONSE_BODY_LENGTH);
  body.writeUInt16LE(RESPONSE_STRUCTURE_SIZE, 0);
  body.writeUInt8(0, 2);
  body.writeUInt8(0, 3);
  body.writeUInt32LE(FILE_OPENED, 4);

  const fileTime = (BigInt(Date.now()) + 11644473600000n) * 10000n;
  body.writeBigUInt64LE(fileTime, 8);
  body.writeBigUInt64LE(fileTime, 16);
  body.writeBigUInt64LE(fileTime, 24);
  body.writeBigUInt64LE(fileTime, 32);

  const sizeBig = BigInt(size);
  body.writeBigUInt64LE(sizeBig, 40);
  body.writeBigUInt64LE(sizeBig, 48);

  body.writeUInt32LE(fileAttributes, 56);
  body.writeUInt32LE(0, 60);
  fileId.copy(body, 64);
  body.writeUInt32LE(0, 80);
  body.writeUInt32LE(0, 84);

  return Buffer.concat([serializeHeader(responseHeader), body]);
}

/**
 * Handles an SMB2 CREATE request: opens a directory or file within the
 * read-only music library and registers an open handle for it. Any request
 * attempting to write, create, overwrite or delete is rejected with
 * ACCESS_DENIED.
 */
export async function handleCreate(
  header: Smb2Header,
  body: Buffer,
  session: SmbSession,
  library: LibraryTree,
  resolvePlugin: PluginResolver,
): Promise<Buffer> {
  const desiredAccess = body.readUInt32LE(24);
  const createDisposition = body.readUInt32LE(36);

  const hasWriteAccess = (desiredAccess & WRITE_ACCESS_MASK) !== 0;
  const hasWriteDisposition =
    createDisposition !== CREATE_DISPOSITION_OPEN && createDisposition !== CREATE_DISPOSITION_OPEN_IF;

  if (hasWriteAccess || hasWriteDisposition) {
    return buildErrorResponse(header, NtStatus.ACCESS_DENIED);
  }

  const name = readName(body);
  if (name === MALFORMED_NAME) {
    return buildErrorResponse(header, NtStatus.INVALID_PARAMETER);
  }
  const segments = name.split("\\").filter((segment) => segment.length > 0);

  const node = await library.resolve(segments);
  if (node === null) {
    return buildErrorResponse(header, NtStatus.OBJECT_NAME_NOT_FOUND);
  }

  const { volatile, persistent } = session.nextHandle();
  const fileId = Buffer.alloc(16);
  fileId.writeBigUInt64LE(volatile, 0);
  fileId.writeBigUInt64LE(persistent, 8);

  let size = 0;
  let fileAttributes: number;
  let coverData: Buffer | undefined;
  let activeStream: OpenHandle["activeStream"];
  let songPlugin: OpenHandle["plugin"];
  if (node.kind === "song" && node.pluginId !== undefined && node.id !== undefined) {
    // Prefer the song's originator plugin over reading the file directly,
    // so playback goes through the same path the plugin scanned it with.
    const plugin = await resolvePlugin(node.pluginId);
    if (plugin === undefined) {
      return buildErrorResponse(header, NtStatus.NO_SUCH_FILE);
    }
    const [stream, streamSize] = await plugin.stream(node.id);
    size = streamSize;
    songPlugin = plugin;
    activeStream = {
      iterator: stream[Symbol.asyncIterator](),
      nextOffset: 0,
      pending: Buffer.alloc(0),
    };
    fileAttributes = FILE_ATTRIBUTE_ARCHIVE | FILE_ATTRIBUTE_READONLY;
  } else if (node.kind === "song" && node.filePath !== undefined) {
    size = await fileReader.size(node.filePath);
    fileAttributes = FILE_ATTRIBUTE_ARCHIVE | FILE_ATTRIBUTE_READONLY;
  } else if (node.kind === "cover" && node.id !== undefined) {
    // Cover art (folder.jpg): the album's stored cover, or a placeholder
    // JPEG when it has none (getCover always returns bytes).
    coverData = await library.getCover(node.id);
    size = coverData.length;
    fileAttributes = FILE_ATTRIBUTE_ARCHIVE | FILE_ATTRIBUTE_READONLY;
  } else {
    fileAttributes = FILE_ATTRIBUTE_DIRECTORY;
  }

  const handle: OpenHandle = {
    path: segments.join("/"),
    kind: node.kind,
    id: node.id,
    filePath: node.filePath,
    size,
    coverData,
    plugin: songPlugin,
    activeStream,
  };
  session.handles.set(fileId.toString("hex"), handle);

  return buildSuccessResponse(header, fileId, fileAttributes, size);
}
