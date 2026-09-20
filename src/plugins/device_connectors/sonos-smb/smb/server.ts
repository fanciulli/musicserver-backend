/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import net from "node:net";
import type { AddressInfo } from "node:net";
import { Smb2Command, NtStatus, SMB2_FLAGS_RELATED } from "./constants.js";
import { parseHeader, buildErrorResponse, type Smb2Header } from "./header.js";
import { frame, MessageAssembler } from "./framing.js";
import { SmbSession } from "./session.js";
import {
  handleNegotiate,
  handleSmb1Negotiate,
  isSmb1Negotiate,
} from "./handlers/negotiate.js";
import { handleSessionSetup } from "./handlers/sessionSetup.js";
import { handleTreeConnect } from "./handlers/treeConnect.js";
import { handleCreate } from "./handlers/create.js";
import { handleQueryDirectory } from "./handlers/queryDirectory.js";
import { handleQueryInfo } from "./handlers/queryInfo.js";
import { handleRead } from "./handlers/read.js";
import {
  handleClose,
  handleTreeDisconnect,
  handleLogoff,
  handleFlush,
  handleEcho,
  handleCancel,
  handleIoctl,
} from "./handlers/misc.js";
import type { LibraryTree } from "../library/libraryTree.js";
import type { SonosSmbCredentials } from "./ntlmAuth.js";
import type { Logger } from "./logger.js";
import type { PluginResolver } from "./handlers/create.js";

const HEADER_LENGTH = 64;

/** Human-readable SMB2 command name for operation logging. */
function commandName(command: number): string {
  return Smb2Command[command] ?? `CMD_0x${command.toString(16)}`;
}

/**
 * Builds a short description of a request's parameters for operation logging.
 * Best-effort: never throws (logging must not disturb request handling).
 */
function operationParams(header: Smb2Header, body: Buffer): string {
  try {
    switch (header.command) {
      case Smb2Command.CREATE: {
        if (body.length < 48) return "";
        const nameOffset = body.readUInt16LE(44) - HEADER_LENGTH;
        const nameLength = body.readUInt16LE(46);
        const name =
          nameOffset >= 0 && nameLength > 0
            ? body.subarray(nameOffset, nameOffset + nameLength).toString("utf16le")
            : "(root)";
        return `name="${name}"`;
      }
      case Smb2Command.TREE_CONNECT: {
        if (body.length < 8) return "";
        const pathOffset = body.readUInt16LE(4) - HEADER_LENGTH;
        const pathLength = body.readUInt16LE(6);
        const path =
          pathOffset >= 0 && pathLength > 0
            ? body.subarray(pathOffset, pathOffset + pathLength).toString("utf16le")
            : "";
        return `share="${path}"`;
      }
      case Smb2Command.QUERY_DIRECTORY:
        return body.length >= 3 ? `dirClass=0x${body.readUInt8(2).toString(16)}` : "";
      case Smb2Command.QUERY_INFO:
        return body.length >= 4
          ? `infoType=0x${body.readUInt8(2).toString(16)}, infoClass=0x${body.readUInt8(3).toString(16)}`
          : "";
      case Smb2Command.READ:
        return body.length >= 16
          ? `off=${body.readBigUInt64LE(8)}, len=${body.readUInt32LE(4)}`
          : "";
      default:
        return "";
    }
  } catch {
    return "";
  }
}

/**
 * Byte offset of the 16-byte FileId within a request body, for the commands
 * that carry one. Used to substitute the wildcard FileId in related compounds.
 */
function fileIdOffsetForCommand(command: number): number | undefined {
  switch (command) {
    case Smb2Command.CLOSE:
    case Smb2Command.FLUSH:
    case Smb2Command.IOCTL:
    case Smb2Command.QUERY_DIRECTORY:
      return 8;
    case Smb2Command.READ:
    case Smb2Command.WRITE:
    case Smb2Command.SET_INFO:
      return 16;
    case Smb2Command.QUERY_INFO:
      return 24;
    default:
      return undefined;
  }
}

/** True when the 16 bytes at `offset` are the wildcard FileId (all 0xFF). */
function isWildcardFileId(body: Buffer, offset: number): boolean {
  for (let i = offset; i < offset + 16; i++) {
    if (body[i] !== 0xff) {
      return false;
    }
  }
  return true;
}

/**
 * Chains individual SMB2 responses into one compound response: every response
 * but the last is padded to an 8-byte boundary and its NextCommand (header
 * offset 20) is set to that padded length; the last has NextCommand 0.
 */
function chainResponses(responses: Buffer[]): Buffer {
  if (responses.length === 1) {
    responses[0].writeUInt32LE(0, 20);
    return responses[0];
  }
  const parts: Buffer[] = [];
  responses.forEach((response, index) => {
    if (index === responses.length - 1) {
      response.writeUInt32LE(0, 20);
      parts.push(response);
      return;
    }
    const paddedLength = Math.ceil(response.length / 8) * 8;
    response.writeUInt32LE(paddedLength, 20);
    const padded = Buffer.alloc(paddedLength);
    response.copy(padded);
    parts.push(padded);
  });
  return Buffer.concat(parts);
}

/**
 * Socket error codes that mean the client (e.g. Sonos) closed or reset the
 * connection abruptly. These are routine for SMB clients that open and drop
 * many short-lived connections, so they are logged at debug rather than error.
 */
const BENIGN_SOCKET_ERROR_CODES = new Set([
  "ECONNRESET",
  "EPIPE",
  "ECONNABORTED",
  "ETIMEDOUT",
]);

export interface SmbServerDeps {
  logger: Logger;
  library: LibraryTree;
  /** Called fresh on every TREE_CONNECT so a config change applies without restarting the server. */
  getShareName: () => string;
  /** Called fresh on every SESSION_SETUP so a config change applies without restarting the server. */
  getCredentials: () => SonosSmbCredentials;
  /** Resolves a song's originator MusicSourcePlugin, so CREATE can stream from it. */
  resolvePlugin: PluginResolver;
}

/**
 * Dispatches a single parsed SMB2 request to the appropriate handler and
 * returns the serialized response (header + body), ready to be framed.
 *
 * Some handlers (e.g. CREATE) are asynchronous because they hit the
 * library/database; this function is therefore always async, and any
 * handler that throws/rejects is converted into an SMB error response
 * (FAILED) rather than propagating and tearing down the connection.
 */
export async function dispatch(
  header: Smb2Header,
  body: Buffer,
  session: SmbSession,
  shareName: string,
  library: LibraryTree,
  credentials: SonosSmbCredentials,
  logger: Logger,
  resolvePlugin: PluginResolver,
): Promise<Buffer | undefined> {
  try {
    switch (header.command) {
      case Smb2Command.NEGOTIATE:
        return handleNegotiate(header, body, session);
      case Smb2Command.SESSION_SETUP: {
        const { response, assignSessionId } = handleSessionSetup(
          header,
          body,
          session,
          credentials,
          logger,
        );
        if (assignSessionId !== undefined) {
          response.writeBigUInt64LE(assignSessionId, 40);
        }
        return response;
      }
      case Smb2Command.TREE_CONNECT:
        return handleTreeConnect(header, body, session, shareName, logger);
      case Smb2Command.CREATE:
        return await handleCreate(header, body, session, library, resolvePlugin);
      case Smb2Command.QUERY_DIRECTORY:
        return await handleQueryDirectory(header, body, session, library);
      case Smb2Command.QUERY_INFO:
        return handleQueryInfo(header, body, session);
      case Smb2Command.READ:
        return await handleRead(header, body, session);
      case Smb2Command.CLOSE:
        return handleClose(header, body, session);
      case Smb2Command.TREE_DISCONNECT:
        return handleTreeDisconnect(header);
      case Smb2Command.LOGOFF:
        return handleLogoff(header);
      case Smb2Command.FLUSH:
        return handleFlush(header);
      case Smb2Command.ECHO:
        return handleEcho(header);
      case Smb2Command.IOCTL:
        return handleIoctl(header, body, session);
      case Smb2Command.CANCEL:
        return handleCancel();
      default:
        return buildErrorResponse(header, NtStatus.NOT_SUPPORTED);
    }
  } catch {
    // An unexpected handler failure (e.g. a DB error) must not tear down the
    // connection; report it to the client as a generic SMB error instead.
    return buildErrorResponse(header, NtStatus.INVALID_PARAMETER);
  }
}

/**
 * Minimal read-only SMB2/3 TCP server skeleton: frames/unframes NetBIOS
 * session messages, tracks per-connection session state and dispatches
 * parsed requests to command handlers.
 */
export class SmbServer {
  #deps: SmbServerDeps;
  #server: net.Server;
  #sockets: Set<net.Socket> = new Set();

  constructor(deps: SmbServerDeps) {
    this.#deps = deps;
    this.#server = net.createServer((socket) => this.#handleConnection(socket));
  }

  #handleConnection(socket: net.Socket): void {
    this.#sockets.add(socket);
    const peer = `${socket.remoteAddress ?? "?"}:${socket.remotePort ?? "?"}`;
    socket.once("close", () => this.#sockets.delete(socket));

    const assembler = new MessageAssembler();
    const session = new SmbSession();

    socket.on("data", (chunk: Buffer) => {
      let messages: Buffer[];
      try {
        messages = assembler.push(chunk);
      } catch (err) {
        this.#deps.logger.error({ err, peer }, "sonos-smb: failed to reassemble message");
        socket.destroy();
        return;
      }

      // Requests within a chunk are handled sequentially (awaiting each
      // dispatch) so responses are written back in the order they arrived,
      // even though some handlers (e.g. CREATE) are asynchronous.
      void (async () => {
        for (const payload of messages) {
          try {
            // Native clients (Windows, macOS Finder/smbutil, Sonos) open with
            // a legacy SMB1 multi-protocol NEGOTIATE before switching to SMB2.
            // Answer it with an SMB2 wildcard NEGOTIATE so they re-negotiate.
            if (isSmb1Negotiate(payload)) {
              this.#deps.logger.debug?.(
                `[sonos-smb] op=SMB1_NEGOTIATE params={} outcome=SMB2_WILDCARD peer=${peer}`,
              );
              socket.write(frame(handleSmb1Negotiate()));
              continue;
            }

            const response = await this.#handlePayload(payload, session, peer);
            if (response !== undefined) {
              socket.write(frame(response));
            }
          } catch (err) {
            this.#deps.logger.error({ err, peer }, "sonos-smb: failed to handle message");
            socket.destroy();
            return;
          }
        }
      })();
    });

    socket.on("error", (err: NodeJS.ErrnoException) => {
      const code = err.code ?? "UNKNOWN";
      if (BENIGN_SOCKET_ERROR_CODES.has(code)) {
        // Routine client disconnect — keep it out of the error stream.
        this.#deps.logger.debug?.(
          { code, peer },
          "sonos-smb: client connection closed abruptly",
        );
        return;
      }
      this.#deps.logger.error(
        { err, code, peer, message: err.message },
        `sonos-smb: socket error (${code}) from ${peer}`,
      );
    });
  }

  /**
   * Processes one NBSS payload, which may be a single SMB2 request or a
   * COMPOUND chain (headers linked via NextCommand). Native clients such as
   * Sonos and Windows send related compounds (e.g. CREATE + QUERY_DIRECTORY +
   * CLOSE) where later requests reference the FileId opened by the preceding
   * CREATE via the wildcard FileId 0xFFFF…FFFF. Each request is dispatched in
   * order and the individual responses are chained back into one compound
   * response. Returns undefined when nothing should be written (e.g. CANCEL).
   */
  async #handlePayload(
    payload: Buffer,
    session: SmbSession,
    peer: string,
  ): Promise<Buffer | undefined> {
    const responses: Buffer[] = [];
    let relatedFileId: Buffer | undefined; // FileId from the last CREATE in this chain
    let offset = 0;

    while (offset < payload.length) {
      const segment = payload.subarray(offset);
      const header = parseHeader(segment);
      const segmentLength = header.nextCommand !== 0 ? header.nextCommand : segment.length;
      // Copy the body so a related-op FileId substitution can mutate it safely.
      const body = Buffer.from(segment.subarray(HEADER_LENGTH, segmentLength));

      // Related compound: substitute the wildcard FileId with the one the
      // preceding CREATE returned, so the handler resolves the right handle.
      if (header.flags & SMB2_FLAGS_RELATED && relatedFileId) {
        const fidOffset = fileIdOffsetForCommand(header.command);
        if (
          fidOffset !== undefined &&
          body.length >= fidOffset + 16 &&
          isWildcardFileId(body, fidOffset)
        ) {
          relatedFileId.copy(body, fidOffset);
        }
      }

      const response = await dispatch(
        header,
        body,
        session,
        this.#deps.getShareName(),
        this.#deps.library,
        this.#deps.getCredentials(),
        this.#deps.logger,
        this.#deps.resolvePlugin,
      );

      const opName = commandName(header.command);
      const params = operationParams(header, body);

      if (response !== undefined) {
        const granted = Math.max(1, header.creditReqResp);
        response.writeUInt16LE(granted, 14); // CreditResponse (header offset 14)
        const status = response.readUInt32LE(8) >>> 0;
        // Capture the FileId of a successful CREATE for later related requests.
        if (header.command === Smb2Command.CREATE && status === 0) {
          relatedFileId = Buffer.from(response.subarray(128, 144)); // FileId in CREATE response body
        }
        responses.push(response);

        let outcome = `status=0x${status.toString(16)}`;
        try {
          if (header.command === Smb2Command.CREATE && status === 0) {
            const h = session.handles.get(response.subarray(128, 144).toString("hex"));
            if (h?.filePath) outcome += `, file="${h.filePath}"`;
            else if (h) outcome += `, kind=${h.kind}`;
          } else if (header.command === Smb2Command.READ) {
            const h = session.handles.get(body.subarray(16, 32).toString("hex"));
            if (response.length >= 72) outcome += `, dataLen=${response.readUInt32LE(68)}`;
            if (h?.filePath) outcome += `, file="${h.filePath}"`;
          } else if (header.command === Smb2Command.QUERY_DIRECTORY) {
            const h = session.handles.get(body.subarray(8, 24).toString("hex"));
            if (h) outcome += `, dir="/${h.path}"`;
            if (response.length >= 72) outcome += `, outLen=${response.readUInt32LE(68)}`;
          }
        } catch {
          // best-effort enrichment only
        }
        this.#deps.logger.debug?.(
          `[sonos-smb] op=${opName}${params ? ` params={${params}}` : ""} outcome=${outcome} peer=${peer}`,
        );
      } else {
        this.#deps.logger.debug?.(
          `[sonos-smb] op=${opName}${params ? ` params={${params}}` : ""} outcome=no-reply peer=${peer}`,
        );
      }

      if (header.nextCommand === 0) {
        break;
      }
      offset += header.nextCommand;
    }

    if (responses.length === 0) {
      return undefined;
    }
    return chainResponses(responses);
  }

  listen(port: number, host?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#server.once("error", reject);
      this.#server.listen(port, host, () => {
        this.#server.removeListener("error", reject);
        this.#deps.logger.info(
          `sonos-smb: listening on ${host ?? "0.0.0.0"}:${port} (share "${this.#deps.getShareName()}")`,
        );
        resolve();
      });
    });
  }

  /**
   * Stops accepting new connections and resolves once the underlying
   * net.Server has closed. SMB clients (e.g. Sonos) keep their TCP
   * connection open indefinitely, so net.Server.close()'s callback would
   * otherwise never fire; every still-open socket is therefore forcibly
   * destroyed right after close() is requested.
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#server.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });

      for (const socket of this.#sockets) {
        socket.destroy();
      }
    });
  }

  address(): AddressInfo | string | null {
    return this.#server.address();
  }
}
