/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { handleQueryDirectory } from "../../../../src/plugins/device_connectors/sonos-smb/smb/handlers/queryDirectory.js";
import { parseHeader } from "../../../../src/plugins/device_connectors/sonos-smb/smb/header.js";
import { SmbSession, type OpenHandle } from "../../../../src/plugins/device_connectors/sonos-smb/smb/session.js";
import { NtStatus } from "../../../../src/plugins/device_connectors/sonos-smb/smb/constants.js";
import type { LibraryTree, LibNode } from "../../../../src/plugins/device_connectors/sonos-smb/library/libraryTree.js";

const HEADER_LENGTH = 64;
const FILE_BOTH_DIRECTORY_INFORMATION = 0x03;

const SMB2_RESTART_SCANS = 0x01;

const SONG_CONTENTS = "fake flac contents";
let tmpDir: string;
let songFilePath: string;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sonos-smb-qd-"));
  songFilePath = path.join(tmpDir, "song.flac");
  fs.writeFileSync(songFilePath, SONG_CONTENTS);
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function createRequestBody(options: {
  fileId: Buffer;
  infoClass?: number;
  flags?: number;
  outputBufferLength?: number;
}): Buffer {
  const body = Buffer.alloc(32);
  body.writeUInt16LE(33, 0);
  body.writeUInt8(options.infoClass ?? FILE_BOTH_DIRECTORY_INFORMATION, 2);
  body.writeUInt8(options.flags ?? 0, 3);
  body.writeUInt32LE(0, 4); // FileIndex
  options.fileId.copy(body, 8);
  body.writeUInt16LE(0, 24); // FileNameOffset
  body.writeUInt16LE(0, 26); // FileNameLength
  body.writeUInt32LE(options.outputBufferLength ?? 64 * 1024, 28);
  return body;
}

const hdr = {
  creditCharge: 1,
  status: 0,
  command: 0x0e,
  creditReqResp: 1,
  flags: 0,
  nextCommand: 0,
  messageId: 4n,
  treeId: 1,
  sessionId: 1n,
} as any;

interface ParsedEntry {
  nextEntryOffset: number;
  fileAttributes: number;
  endOfFile: bigint;
  fileName: string;
}

function parseEntries(buf: Buffer, infoClass: number): ParsedEntry[] {
  const nameOffset = infoClass === 0x25 ? 104 : 94;
  const entries: ParsedEntry[] = [];
  let offset = 0;
  while (offset < buf.length) {
    const nextEntryOffset = buf.readUInt32LE(offset + 0);
    const fileAttributes = buf.readUInt32LE(offset + 56);
    const fileNameLength = buf.readUInt32LE(offset + 60);
    const endOfFile = buf.readBigUInt64LE(offset + 40);
    const fileName = buf
      .subarray(offset + nameOffset, offset + nameOffset + fileNameLength)
      .toString("utf16le");
    entries.push({ nextEntryOffset, fileAttributes, endOfFile, fileName });
    if (nextEntryOffset === 0) {
      break;
    }
    offset += nextEntryOffset;
  }
  return entries;
}

function stubLibrary(children: LibNode[]): LibraryTree {
  return {
    listChildren: async () => children,
  } as unknown as LibraryTree;
}

function fileId(n: number): Buffer {
  const buf = Buffer.alloc(16);
  buf.writeBigUInt64LE(BigInt(n), 0);
  buf.writeBigUInt64LE(BigInt(n), 8);
  return buf;
}

describe("QUERY_DIRECTORY", () => {
  // Built lazily (not at describe-collection time) so it captures the
  // `songFilePath` assigned by beforeAll rather than its initial undefined.
  function buildChildren(): LibNode[] {
    return [
      { kind: "album", name: "Abbey Road", id: "al1" },
      { kind: "song", name: "01 - Come Together.flac", id: "s1", filePath: songFilePath },
    ];
  }

  function setupSession(): { session: SmbSession; id: Buffer } {
    const session = new SmbSession();
    const id = fileId(1);
    const handle: OpenHandle = { path: "Artist", kind: "artist", id: "a1" };
    session.handles.set(id.toString("hex"), handle);
    return { session, id };
  }

  it("lists . .. and children on first call, then reports NO_MORE_FILES on the next", async () => {
    const library = stubLibrary(buildChildren());
    const { session, id } = setupSession();

    const first = await handleQueryDirectory(
      hdr,
      createRequestBody({ fileId: id, flags: SMB2_RESTART_SCANS }),
      session,
      library,
    );

    expect(parseHeader(first).status >>> 0).toBe(NtStatus.SUCCESS);
    const firstBody = first.subarray(HEADER_LENGTH);
    const outputBufferLength = firstBody.readUInt32LE(4);
    const entriesBuf = firstBody.subarray(8, 8 + outputBufferLength);
    const entries = parseEntries(entriesBuf, FILE_BOTH_DIRECTORY_INFORMATION);

    expect(entries.length).toBe(4);
    expect(entries[0].fileName).toBe(".");
    expect(entries[1].fileName).toBe("..");
    expect(entries[0].fileAttributes & 0x10).toBe(0x10);
    expect(entries[1].fileAttributes & 0x10).toBe(0x10);

    const albumEntry = entries.find((e) => e.fileName === "Abbey Road");
    expect(albumEntry).toBeDefined();
    expect(albumEntry!.fileAttributes & 0x10).toBe(0x10);

    const songEntry = entries.find((e) => e.fileName === "01 - Come Together.flac");
    expect(songEntry).toBeDefined();
    expect(songEntry!.fileAttributes & 0x20).toBe(0x20);
    expect(songEntry!.endOfFile).toBe(BigInt(SONG_CONTENTS.length));

    expect(entries[entries.length - 1].nextEntryOffset).toBe(0);

    const second = await handleQueryDirectory(
      hdr,
      createRequestBody({ fileId: id }),
      session,
      library,
    );

    expect(parseHeader(second).status >>> 0).toBe(NtStatus.NO_MORE_FILES);
  });

  it("returns INVALID_PARAMETER for an unknown FileId", async () => {
    const library = stubLibrary(buildChildren());
    const session = new SmbSession();

    const r = await handleQueryDirectory(
      hdr,
      createRequestBody({ fileId: fileId(99) }),
      session,
      library,
    );

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.INVALID_PARAMETER);
  });

  it("returns BUFFER_OVERFLOW with an empty body when the first entry does not fit", async () => {
    const library = stubLibrary(buildChildren());
    const { session, id } = setupSession();

    const r = await handleQueryDirectory(
      hdr,
      createRequestBody({ fileId: id, flags: SMB2_RESTART_SCANS, outputBufferLength: 10 }),
      session,
      library,
    );

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.BUFFER_OVERFLOW);
    const body = r.subarray(HEADER_LENGTH);
    const outputBufferLength = body.readUInt32LE(4);
    expect(outputBufferLength).toBe(0);
    expect(body.length - 8).toBe(0);
    expect(body.length - 8).toBeLessThanOrEqual(10);
  });

  it("returns INVALID_INFO_CLASS for an unsupported information class", async () => {
    const library = stubLibrary(buildChildren());
    const { session, id } = setupSession();

    const r = await handleQueryDirectory(
      hdr,
      createRequestBody({ fileId: id, infoClass: 0x0c }),
      session,
      library,
    );

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.INVALID_INFO_CLASS);
  });
});
