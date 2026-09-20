/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, rm } from "node:fs/promises";
import { Readable } from "node:stream";
import * as os from "node:os";
import * as path from "node:path";
import { handleRead } from "../../../../src/plugins/device_connectors/sonos-smb/smb/handlers/read.js";
import { parseHeader } from "../../../../src/plugins/device_connectors/sonos-smb/smb/header.js";
import { SmbSession, type OpenHandle } from "../../../../src/plugins/device_connectors/sonos-smb/smb/session.js";
import { MAX_READ_SIZE, NtStatus } from "../../../../src/plugins/device_connectors/sonos-smb/smb/constants.js";

const HEADER_LENGTH = 64;

const hdr = {
  creditCharge: 1,
  status: 0,
  command: 0x08,
  creditReqResp: 1,
  flags: 0,
  nextCommand: 0,
  messageId: 9n,
  treeId: 1,
  sessionId: 1n,
} as any;

function fileId(n: number): Buffer {
  const buf = Buffer.alloc(16);
  buf.writeBigUInt64LE(BigInt(n), 0);
  buf.writeBigUInt64LE(BigInt(n), 8);
  return buf;
}

function createRequestBody(options: { fileId: Buffer; length: number; offset: number }): Buffer {
  const body = Buffer.alloc(49);
  body.writeUInt16LE(49, 0); // StructureSize
  body.writeUInt8(0, 2); // Padding
  body.writeUInt8(0, 3); // Flags
  body.writeUInt32LE(options.length, 4); // Length
  body.writeBigUInt64LE(BigInt(options.offset), 8); // Offset
  options.fileId.copy(body, 16); // FileId
  body.writeUInt32LE(0, 32); // MinimumCount
  body.writeUInt32LE(0, 36); // Channel
  body.writeUInt32LE(0, 40); // RemainingBytes
  body.writeUInt16LE(0, 44); // ReadChannelInfoOffset
  body.writeUInt16LE(0, 46); // ReadChannelInfoLength
  body.writeUInt8(0, 48); // Buffer
  return body;
}

describe("READ", () => {
  const tempFilePath = path.join(os.tmpdir(), "sonos-smb-read-test.bin");
  const id = fileId(1);

  beforeAll(async () => {
    await writeFile(tempFilePath, Buffer.from("ABCDEFGH"));
  });

  afterAll(async () => {
    await rm(tempFilePath, { force: true });
  });

  function setupSession(): SmbSession {
    const session = new SmbSession();
    const handle: OpenHandle = {
      path: "Artist/Album/song.flac",
      kind: "song",
      id: "s1",
      filePath: tempFilePath,
      size: 8,
    };
    session.handles.set(id.toString("hex"), handle);
    return session;
  }

  it("reads a byte range from the file", async () => {
    const session = setupSession();

    const r = await handleRead(hdr, createRequestBody({ fileId: id, length: 3, offset: 2 }), session);

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.SUCCESS);
    const body = r.subarray(HEADER_LENGTH);
    const dataLength = body.readUInt32LE(4);
    expect(dataLength).toBe(3);
    expect(body.subarray(16, 16 + dataLength).toString()).toBe("CDE");
  });

  it("returns END_OF_FILE with no data when reading at end of file", async () => {
    const session = setupSession();

    const r = await handleRead(hdr, createRequestBody({ fileId: id, length: 4, offset: 8 }), session);

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.END_OF_FILE);
    const body = r.subarray(HEADER_LENGTH);
    expect(body.readUInt32LE(4)).toBe(0);
  });

  it("returns INVALID_PARAMETER for an unknown FileId", async () => {
    const session = new SmbSession();

    const r = await handleRead(hdr, createRequestBody({ fileId: fileId(99), length: 1, offset: 0 }), session);

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.INVALID_PARAMETER);
  });

  it("clamps an oversized Length to MAX_READ_SIZE instead of allocating gigabytes", async () => {
    const session = setupSession();

    const r = await handleRead(
      hdr,
      createRequestBody({ fileId: id, length: 0xffffffff, offset: 0 }),
      session,
    );

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.SUCCESS);
    const body = r.subarray(HEADER_LENGTH);
    const dataLength = body.readUInt32LE(4);
    expect(dataLength).toBeLessThanOrEqual(MAX_READ_SIZE);
    // The backing file is only 8 bytes, so the actual data returned is
    // capped by its size, not by MAX_READ_SIZE.
    expect(dataLength).toBe(8);
    expect(body.subarray(16, 16 + dataLength).toString()).toBe("ABCDEFGH");
  });

  it("returns INVALID_PARAMETER for a non-song handle", async () => {
    const session = new SmbSession();
    const dirId = fileId(2);
    session.handles.set(dirId.toString("hex"), { path: "Artist/Album", kind: "album", id: "a1" });

    const r = await handleRead(hdr, createRequestBody({ fileId: dirId, length: 1, offset: 0 }), session);

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.INVALID_PARAMETER);
  });
});

describe("READ via originator plugin", () => {
  const id = fileId(3);

  function setupStreamingSession(plugin: { stream: (id: string, from?: number) => Promise<[Readable, number]> }): SmbSession {
    const session = new SmbSession();
    const handle: OpenHandle = {
      path: "Artist/Album/song.flac",
      kind: "song",
      id: "s1",
      size: 8,
      plugin,
      activeStream: {
        iterator: Readable.from([Buffer.from("AB"), Buffer.from("CD"), Buffer.from("EF"), Buffer.from("GH")])[
          Symbol.asyncIterator
        ](),
        nextOffset: 0,
        pending: Buffer.alloc(0),
      },
    };
    session.handles.set(id.toString("hex"), handle);
    return session;
  }

  it("reads sequential chunks from the plugin stream, carrying leftover bytes between calls", async () => {
    const session = setupStreamingSession({ stream: async () => { throw new Error("should not reopen"); } });

    const r1 = await handleRead(hdr, createRequestBody({ fileId: id, length: 3, offset: 0 }), session);
    expect(parseHeader(r1).status >>> 0).toBe(NtStatus.SUCCESS);
    expect(r1.subarray(HEADER_LENGTH + 16, HEADER_LENGTH + 16 + 3).toString()).toBe("ABC");

    const r2 = await handleRead(hdr, createRequestBody({ fileId: id, length: 3, offset: 3 }), session);
    expect(parseHeader(r2).status >>> 0).toBe(NtStatus.SUCCESS);
    expect(r2.subarray(HEADER_LENGTH + 16, HEADER_LENGTH + 16 + 3).toString()).toBe("DEF");

    const r3 = await handleRead(hdr, createRequestBody({ fileId: id, length: 2, offset: 6 }), session);
    expect(parseHeader(r3).status >>> 0).toBe(NtStatus.SUCCESS);
    expect(r3.subarray(HEADER_LENGTH + 16, HEADER_LENGTH + 16 + 2).toString()).toBe("GH");
  });

  it("reopens the plugin stream when the requested offset is not the next expected byte", async () => {
    let calledWith: number | undefined;
    const session = setupStreamingSession({
      stream: async (_songId, from) => {
        calledWith = from;
        return [Readable.from([Buffer.from("XY")]), 8];
      },
    });

    const r = await handleRead(hdr, createRequestBody({ fileId: id, length: 2, offset: 5 }), session);

    expect(calledWith).toBe(5);
    expect(parseHeader(r).status >>> 0).toBe(NtStatus.SUCCESS);
    expect(r.subarray(HEADER_LENGTH + 16, HEADER_LENGTH + 16 + 2).toString()).toBe("XY");
  });

  it("returns END_OF_FILE when the plugin stream is exhausted", async () => {
    const session = setupStreamingSession({ stream: async () => { throw new Error("should not reopen"); } });
    // Drain all 8 bytes first.
    await handleRead(hdr, createRequestBody({ fileId: id, length: 8, offset: 0 }), session);

    const r = await handleRead(hdr, createRequestBody({ fileId: id, length: 4, offset: 8 }), session);

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.END_OF_FILE);
    const body = r.subarray(HEADER_LENGTH);
    expect(body.readUInt32LE(4)).toBe(0);
  });
});
