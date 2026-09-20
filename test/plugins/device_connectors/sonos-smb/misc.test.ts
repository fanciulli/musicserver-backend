/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, it, expect } from "vitest";
import {
  handleClose,
  handleTreeDisconnect,
  handleLogoff,
  handleFlush,
  handleEcho,
  handleCancel,
  handleIoctl,
} from "../../../../src/plugins/device_connectors/sonos-smb/smb/handlers/misc.js";
import { parseHeader } from "../../../../src/plugins/device_connectors/sonos-smb/smb/header.js";
import { SmbSession, type OpenHandle } from "../../../../src/plugins/device_connectors/sonos-smb/smb/session.js";
import { NtStatus } from "../../../../src/plugins/device_connectors/sonos-smb/smb/constants.js";

const HEADER_LENGTH = 64;

const hdr = {
  creditCharge: 1,
  status: 0,
  command: 0,
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

function closeRequestBody(id: Buffer): Buffer {
  const body = Buffer.alloc(24);
  body.writeUInt16LE(24, 0); // StructureSize
  body.writeUInt16LE(0, 2); // Flags
  body.writeUInt32LE(0, 4); // Reserved
  id.copy(body, 8); // FileId
  return body;
}

function ioctlRequestBody(ctlCode: number, id: Buffer): Buffer {
  const body = Buffer.alloc(57);
  body.writeUInt16LE(57, 0); // StructureSize
  body.writeUInt16LE(0, 2); // Reserved
  body.writeUInt32LE(ctlCode, 4); // CtlCode
  id.copy(body, 8); // FileId
  body.writeUInt32LE(0, 24); // InputOffset
  body.writeUInt32LE(0, 28); // InputCount
  body.writeUInt32LE(0, 32); // MaxInputResponse
  body.writeUInt32LE(0, 36); // OutputOffset
  body.writeUInt32LE(0, 40); // OutputCount
  body.writeUInt32LE(4096, 44); // MaxOutputResponse
  body.writeUInt32LE(0, 48); // Flags
  body.writeUInt32LE(0, 52); // Reserved2
  return body;
}

describe("CLOSE", () => {
  it("removes the handle and returns SUCCESS with StructureSize=60", () => {
    const session = new SmbSession();
    const id = fileId(1);
    const handle: OpenHandle = { path: "Artist/Album/song.flac", kind: "song", id: "s1" };
    session.handles.set(id.toString("hex"), handle);

    const r = handleClose(hdr, closeRequestBody(id), session);

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.SUCCESS);
    expect(r.subarray(HEADER_LENGTH).readUInt16LE(0)).toBe(60);
    expect(session.handles.has(id.toString("hex"))).toBe(false);
  });

  it("destroys a plugin-backed stream when closing its handle", () => {
    const session = new SmbSession();
    const id = fileId(1);
    let destroyed = false;
    const handle: OpenHandle = {
      path: "Artist/Album/song.flac",
      kind: "song",
      id: "s1",
      activeStream: {
        iterator: {
          next: async () => ({ value: undefined, done: true }),
          return: async () => {
            destroyed = true;
            return { value: undefined, done: true };
          },
        } as any,
        nextOffset: 0,
        pending: Buffer.alloc(0),
      },
    };
    session.handles.set(id.toString("hex"), handle);

    handleClose(hdr, closeRequestBody(id), session);

    expect(destroyed).toBe(true);
  });
});

describe("TREE_DISCONNECT / LOGOFF / FLUSH / ECHO", () => {
  it.each([
    ["handleTreeDisconnect", handleTreeDisconnect],
    ["handleLogoff", handleLogoff],
    ["handleFlush", handleFlush],
    ["handleEcho", handleEcho],
  ] as const)("%s returns SUCCESS with StructureSize=4", (_name, handler) => {
    const r = handler(hdr);

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.SUCCESS);
    expect(r.subarray(HEADER_LENGTH).readUInt16LE(0)).toBe(4);
  });
});

describe("CANCEL", () => {
  it("returns no response", () => {
    expect(handleCancel()).toBeUndefined();
  });
});

describe("IOCTL", () => {
  it("answers FSCTL_VALIDATE_NEGOTIATE_INFO with SUCCESS and OutputCount=24", () => {
    const session = new SmbSession();
    session.dialect = 0x0300;
    const id = fileId(1);

    const r = handleIoctl(hdr, ioctlRequestBody(0x00140204, id), session);

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.SUCCESS);
    const body = r.subarray(HEADER_LENGTH);
    expect(body.readUInt32LE(36)).toBe(24);
    expect(body.readUInt32LE(32)).toBe(64 + 48);
  });

  it("returns NOT_SUPPORTED for an unknown CtlCode", () => {
    const session = new SmbSession();
    const id = fileId(1);

    const r = handleIoctl(hdr, ioctlRequestBody(0x00090000, id), session);

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.NOT_SUPPORTED);
  });
});
