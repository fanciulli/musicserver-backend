/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, it, expect } from "vitest";
import { handleQueryInfo } from "../../../../src/plugins/device_connectors/sonos-smb/smb/handlers/queryInfo.js";
import { parseHeader } from "../../../../src/plugins/device_connectors/sonos-smb/smb/header.js";
import { SmbSession, type OpenHandle } from "../../../../src/plugins/device_connectors/sonos-smb/smb/session.js";
import { NtStatus } from "../../../../src/plugins/device_connectors/sonos-smb/smb/constants.js";

const HEADER_LENGTH = 64;

const INFO_TYPE_FILE = 0x01;
const INFO_TYPE_FILESYSTEM = 0x02;

const FILE_BASIC_INFORMATION = 0x04;
const FILE_STANDARD_INFORMATION = 0x05;
const FILE_FS_ATTRIBUTE_INFORMATION = 0x05;

const FILE_READ_ONLY_VOLUME = 0x00080000;

const hdr = {
  creditCharge: 1,
  status: 0,
  command: 0x10,
  creditReqResp: 1,
  flags: 0,
  nextCommand: 0,
  messageId: 7n,
  treeId: 1,
  sessionId: 1n,
} as any;

function fileId(n: number): Buffer {
  const buf = Buffer.alloc(16);
  buf.writeBigUInt64LE(BigInt(n), 0);
  buf.writeBigUInt64LE(BigInt(n), 8);
  return buf;
}

function createRequestBody(options: {
  fileId: Buffer;
  infoType?: number;
  fileInfoClass?: number;
  outputBufferLength?: number;
}): Buffer {
  const body = Buffer.alloc(40);
  body.writeUInt16LE(41, 0); // StructureSize
  body.writeUInt8(options.infoType ?? INFO_TYPE_FILE, 2);
  body.writeUInt8(options.fileInfoClass ?? FILE_STANDARD_INFORMATION, 3);
  body.writeUInt32LE(options.outputBufferLength ?? 64 * 1024, 4); // OutputBufferLength
  body.writeUInt16LE(0, 8); // InputBufferOffset
  body.writeUInt16LE(0, 10); // Reserved
  body.writeUInt32LE(0, 12); // InputBufferLength
  body.writeUInt32LE(0, 16); // AdditionalInformation
  body.writeUInt32LE(0, 20); // Flags
  options.fileId.copy(body, 24);
  return body;
}

function setupSession(): { session: SmbSession; id: Buffer } {
  const session = new SmbSession();
  const id = fileId(1);
  const handle: OpenHandle = {
    path: "Artist/Album/song.flac",
    kind: "song",
    id: "s1",
    filePath: "/music/song.flac",
    size: 8,
  };
  session.handles.set(id.toString("hex"), handle);
  return { session, id };
}

describe("QUERY_INFO", () => {
  it("returns FileStandardInformation with EndOfFile and Directory=0 for a song", () => {
    const { session, id } = setupSession();

    const r = handleQueryInfo(
      hdr,
      createRequestBody({ fileId: id, infoType: INFO_TYPE_FILE, fileInfoClass: FILE_STANDARD_INFORMATION }),
      session,
    );

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.SUCCESS);
    const body = r.subarray(HEADER_LENGTH);
    const outputBufferLength = body.readUInt32LE(4);
    const blob = body.subarray(8, 8 + outputBufferLength);

    expect(blob.readBigUInt64LE(8)).toBe(8n); // EndOfFile
    expect(blob.readUInt8(21)).toBe(0); // Directory
  });

  it("returns FileBasicInformation with the song FileAttributes bit set", () => {
    const { session, id } = setupSession();

    const r = handleQueryInfo(
      hdr,
      createRequestBody({ fileId: id, infoType: INFO_TYPE_FILE, fileInfoClass: FILE_BASIC_INFORMATION }),
      session,
    );

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.SUCCESS);
    const body = r.subarray(HEADER_LENGTH);
    const outputBufferLength = body.readUInt32LE(4);
    const blob = body.subarray(8, 8 + outputBufferLength);

    const fileAttributes = blob.readUInt32LE(32);
    expect(fileAttributes & 0x20).toBe(0x20);
  });

  it("returns FileAllInformation (0x12) with the standard fields and name", () => {
    const { session, id } = setupSession();

    const r = handleQueryInfo(
      hdr,
      createRequestBody({ fileId: id, infoType: INFO_TYPE_FILE, fileInfoClass: 0x12 }),
      session,
    );

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.SUCCESS);
    const body = r.subarray(HEADER_LENGTH);
    const outputBufferLength = body.readUInt32LE(4);
    const blob = body.subarray(8, 8 + outputBufferLength);

    // Basic(40) + Standard(24) + Internal(8) + Ea(4) + Access(4) +
    // Position(8) + Mode(4) + Alignment(4) = 96, then FileNameInformation.
    expect(blob.length).toBeGreaterThanOrEqual(100);
    expect(blob.readUInt8(40 + 21)).toBe(0); // embedded StandardInformation Directory = 0 (song)
    const nameLen = blob.readUInt32LE(96);
    const name = blob.subarray(100, 100 + nameLen).toString("utf16le");
    expect(name).toBe("\\Artist\\Album\\song.flac");
  });

  it("returns FileFsAttributeInformation with FILE_READ_ONLY_VOLUME set", () => {
    const { session, id } = setupSession();

    const r = handleQueryInfo(
      hdr,
      createRequestBody({
        fileId: id,
        infoType: INFO_TYPE_FILESYSTEM,
        fileInfoClass: FILE_FS_ATTRIBUTE_INFORMATION,
      }),
      session,
    );

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.SUCCESS);
    const body = r.subarray(HEADER_LENGTH);
    const outputBufferLength = body.readUInt32LE(4);
    const blob = body.subarray(8, 8 + outputBufferLength);

    const fileSystemAttributes = blob.readUInt32LE(0);
    expect(fileSystemAttributes & FILE_READ_ONLY_VOLUME).toBe(FILE_READ_ONLY_VOLUME);
  });

  it("returns INVALID_INFO_CLASS for an unsupported FILE class", () => {
    const { session, id } = setupSession();

    const r = handleQueryInfo(
      hdr,
      createRequestBody({ fileId: id, infoType: INFO_TYPE_FILE, fileInfoClass: 0x99 }),
      session,
    );

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.INVALID_INFO_CLASS);
  });

  it("returns INVALID_PARAMETER for an unknown FileId", () => {
    const session = new SmbSession();

    const r = handleQueryInfo(
      hdr,
      createRequestBody({ fileId: fileId(99) }),
      session,
    );

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.INVALID_PARAMETER);
  });
});
