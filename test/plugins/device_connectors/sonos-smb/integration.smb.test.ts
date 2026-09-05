/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { describe, it, expect, afterAll } from "vitest";
import SMB2 from "@marsaud/smb2";
import { writeFile, rm, mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { SmbServer } from "../../../../src/plugins/device_connectors/sonos-smb/smb/server.js";
import { ntHashHex } from "../../../../src/plugins/device_connectors/sonos-smb/smb/ntlmAuth.js";
import type { LibNode } from "../../../../src/plugins/device_connectors/sonos-smb/library/libraryTree.js";

// Minimal in-memory LibraryTree stub with the same shape as the real
// Mongo-backed LibraryTree: one artist -> one album -> one song backed by a
// temp file with known contents.
let songPath: string;

const fakeLibrary = {
  async listChildren(node: LibNode): Promise<LibNode[]> {
    if (node.kind === "root") {
      return [{ kind: "artist", name: "Beatles", id: "ar1" }];
    }
    if (node.kind === "artist") {
      return [{ kind: "album", name: "Abbey Road", id: "al1" }];
    }
    if (node.kind === "album") {
      return [
        {
          kind: "song",
          name: "01 - Come Together.flac",
          id: "s1",
          filePath: songPath,
        },
      ];
    }
    return [];
  },
  async resolve(segments: string[]): Promise<LibNode | null> {
    if (segments.length === 0) {
      return { kind: "root", name: "" };
    }
    if (segments.length === 1) {
      return { kind: "artist", name: segments[0] as string, id: "ar1" };
    }
    if (segments.length === 2) {
      return { kind: "album", name: segments[1] as string, id: "al1" };
    }
    if (segments.length === 3) {
      return {
        kind: "song",
        name: segments[2] as string,
        id: "s1",
        filePath: songPath,
      };
    }
    return null;
  },
} as any;

let server: SmbServer;
let smb2: any;

afterAll(async () => {
  smb2?.disconnect();
  await server?.close();
  if (songPath) {
    await rm(songPath, { force: true });
  }
});

describe("SMB integration (authenticated, read-only)", () => {
  it(
    "rejects a client that doesn't know the configured password",
    async () => {
      // @marsaud/smb2's `ntlm` dependency only speaks NTLMv1 (a classic
      // DES-based challenge-response), which this server no longer accepts
      // (see smb/ntlmAuth.ts: NTLMv2 only). It also sends no password here
      // at all ("guest"/""), which would fail credential matching in any
      // case. This demonstrates the anonymous/guest bypass is gone; a real
      // NTLMv2 login is covered at the handler level in
      // sessionSetup.test.ts, where the client-side response can be built
      // by hand.
      const tmpDir = await mkdtemp(path.join(os.tmpdir(), "sonos-int-"));
      songPath = path.join(tmpDir, "sonos-int.flac");
      await writeFile(songPath, Buffer.from("SONGDATA"));

      server = new SmbServer({
        library: fakeLibrary,
        getShareName: () => "Music",
        logger: console as any,
        getCredentials: () => ({
          username: "sonos",
          passwordNtHashHex: ntHashHex("correct horse battery staple"),
        }),
      });
      await server.listen(0); // ephemeral port
      const address = server.address();
      const port =
        typeof address === "object" && address !== null
          ? address.port
          : undefined;
      expect(port).toBeDefined();

      smb2 = new SMB2({
        share: "\\\\127.0.0.1\\Music",
        domain: "WORKGROUP",
        username: "guest",
        password: "",
        port,
      });

      await expect(smb2.readdir("")).rejects.toBeDefined();
    },
    20000,
  );
});

describe("SmbServer.close()", () => {
  it("resolves promptly even with a live connection still open", async () => {
    const emptyLibrary = {
      async listChildren(): Promise<LibNode[]> {
        return [];
      },
      async resolve(): Promise<LibNode | null> {
        return null;
      },
    } as any;

    const closeServer = new SmbServer({
      library: emptyLibrary,
      getShareName: () => "Music",
      logger: console as any,
      getCredentials: () => ({ username: "sonos", passwordNtHashHex: ntHashHex("secret") }),
    });
    await closeServer.listen(0);
    const address = closeServer.address();
    const port =
      typeof address === "object" && address !== null ? address.port : undefined;
    expect(port).toBeDefined();

    // Open a raw TCP connection and never end it, simulating an SMB client
    // (e.g. Sonos) that keeps its connection open indefinitely.
    const socket = net.connect({ port, host: "127.0.0.1" });
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", () => resolve());
      socket.once("error", reject);
    });

    const closePromise = closeServer.close();
    const timeout = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), 2000),
    );

    const result = await Promise.race([closePromise.then(() => "closed"), timeout]);
    expect(result).toBe("closed");

    socket.destroy();
  }, 5000);
});
