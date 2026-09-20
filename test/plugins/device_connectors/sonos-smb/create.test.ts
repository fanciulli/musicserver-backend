/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import {
  handleCreate,
  type PluginResolver,
} from "../../../../src/plugins/device_connectors/sonos-smb/smb/handlers/create.js";
import { parseHeader } from "../../../../src/plugins/device_connectors/sonos-smb/smb/header.js";
import { SmbSession } from "../../../../src/plugins/device_connectors/sonos-smb/smb/session.js";
import { NtStatus } from "../../../../src/plugins/device_connectors/sonos-smb/smb/constants.js";
import type { LibraryTree } from "../../../../src/plugins/device_connectors/sonos-smb/library/libraryTree.js";
import type { LibNode } from "../../../../src/plugins/device_connectors/sonos-smb/library/libraryTree.js";

const noPlugin: PluginResolver = async () => undefined;

const HEADER_LENGTH = 64;

function createBody(options: {
  name?: string;
  desiredAccess?: number;
  createDisposition?: number;
}): Buffer {
  const name = options.name ?? "";
  const nameBuf = Buffer.from(name, "utf16le");
  const bufferOffset = 56;
  const nameOffset = name.length === 0 ? 0 : HEADER_LENGTH + bufferOffset;

  const body = Buffer.alloc(bufferOffset + nameBuf.length);
  body.writeUInt16LE(57, 0);
  body.writeUInt8(0, 2);
  body.writeUInt8(0, 3);
  body.writeUInt32LE(0, 4);
  body.writeBigUInt64LE(0n, 8);
  body.writeBigUInt64LE(0n, 16);
  body.writeUInt32LE(options.desiredAccess ?? 0x00000001, 24);
  body.writeUInt32LE(0, 28);
  body.writeUInt32LE(0, 32);
  body.writeUInt32LE(options.createDisposition ?? 1, 36);
  body.writeUInt32LE(0, 40);
  body.writeUInt16LE(nameOffset, 44);
  body.writeUInt16LE(nameBuf.length, 46);
  body.writeUInt32LE(0, 48);
  body.writeUInt32LE(0, 52);
  nameBuf.copy(body, bufferOffset);

  return body;
}

const hdr = {
  creditCharge: 1,
  status: 0,
  command: 5,
  creditReqResp: 1,
  flags: 0,
  nextCommand: 0,
  messageId: 3n,
  treeId: 1,
  sessionId: 1n,
} as any;

function stubLibrary(resolved: LibNode | null): LibraryTree {
  return {
    resolve: async () => resolved,
  } as unknown as LibraryTree;
}

describe("CREATE", () => {
  it("opens the share root and returns a directory", async () => {
    const library = stubLibrary({ kind: "root", name: "" });
    const r = await handleCreate(hdr, createBody({}), new SmbSession(), library, noPlugin);

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.SUCCESS);
    const body = r.subarray(HEADER_LENGTH);
    const fileAttributes = body.readUInt32LE(56);
    expect(fileAttributes & 0x10).toBe(0x10);
  });

  it("rejects a request with a write access bit set", async () => {
    const library = stubLibrary({ kind: "root", name: "" });
    const r = await handleCreate(
      hdr,
      createBody({ desiredAccess: 0x00000002 }),
      new SmbSession(),
      library,
      noPlugin,
    );

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.ACCESS_DENIED);
  });

  it("rejects a create disposition that requires write access", async () => {
    const library = stubLibrary({ kind: "root", name: "" });
    const r = await handleCreate(
      hdr,
      createBody({ createDisposition: 2 }),
      new SmbSession(),
      library,
      noPlugin,
    );

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.ACCESS_DENIED);
  });

  it("returns OBJECT_NAME_NOT_FOUND when the path does not resolve", async () => {
    const library = stubLibrary(null);
    const r = await handleCreate(
      hdr,
      createBody({ name: "Nope" }),
      new SmbSession(),
      library,
      noPlugin,
    );

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.OBJECT_NAME_NOT_FOUND);
  });

  it("opens a song via its originator plugin and captures the stream for READ", async () => {
    const library = stubLibrary({
      kind: "song",
      name: "song.flac",
      id: "s1",
      pluginId: "filesystem-music-source",
    });
    const streamData = Readable.from([Buffer.from("ABCDEFGH")]);
    const streamFn = async (id: string, from?: number) => {
      expect(id).toBe("s1");
      expect(from).toBeUndefined();
      return [streamData, 8] as [Readable, number];
    };
    const resolvePlugin: PluginResolver = async (pluginId) => {
      expect(pluginId).toBe("filesystem-music-source");
      return { stream: streamFn } as any;
    };
    const session = new SmbSession();

    const r = await handleCreate(
      hdr,
      createBody({ name: "song.flac" }),
      session,
      library,
      resolvePlugin,
    );

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.SUCCESS);
    const body = r.subarray(HEADER_LENGTH);
    expect(body.readBigUInt64LE(40)).toBe(8n); // EndOfFile

    const fileId = body.subarray(64, 80);
    const handle = session.handles.get(fileId.toString("hex"));
    expect(handle?.size).toBe(8);
    expect(handle?.activeStream?.nextOffset).toBe(0);
    expect(handle?.activeStream?.pending).toEqual(Buffer.alloc(0));
  });

  it("fails with NO_SUCH_FILE when the song's originator plugin cannot be resolved", async () => {
    const library = stubLibrary({
      kind: "song",
      name: "song.flac",
      id: "s1",
      pluginId: "missing-plugin",
    });
    const resolvePlugin: PluginResolver = async () => undefined;

    const r = await handleCreate(
      hdr,
      createBody({ name: "song.flac" }),
      new SmbSession(),
      library,
      resolvePlugin,
    );

    expect(parseHeader(r).status >>> 0).toBe(NtStatus.NO_SUCH_FILE);
  });

  it("registers an open handle keyed by the returned FileId", async () => {
    const library = stubLibrary({ kind: "artist", name: "Artist", id: "a1" });
    const session = new SmbSession();
    const r = await handleCreate(hdr, createBody({ name: "Artist" }), session, library, noPlugin);

    const body = r.subarray(HEADER_LENGTH);
    const fileId = body.subarray(64, 80);
    expect(session.handles.get(fileId.toString("hex"))).toEqual({
      path: "Artist",
      kind: "artist",
      id: "a1",
      filePath: undefined,
      size: 0,
    });
  });
});
