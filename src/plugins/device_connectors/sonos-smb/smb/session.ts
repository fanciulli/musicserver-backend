/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */

/**
 * State for a song handle currently being served from its originator
 * plugin's stream (`MusicSourcePlugin.stream()`) rather than read directly
 * off disk. `nextOffset` is the file offset the stream will yield next;
 * `pending` holds bytes already pulled from the stream but not yet
 * returned to the client (a READ may request fewer bytes than one chunk
 * produced).
 */
export interface ActiveStream {
  iterator: AsyncIterator<Buffer>;
  nextOffset: number;
  pending: Buffer;
}

/** Minimal shape read.ts needs to reopen a stream at a new offset (seek). */
export interface StreamingPlugin {
  stream(id: string, from?: number): Promise<[NodeJS.ReadableStream, number]>;
}

export interface OpenHandle {
  path: string;
  kind: "root" | "artist" | "album" | "song" | "cover";
  id?: string;
  filePath?: string;
  size?: number;
  cursor?: number;
  /** In-memory bytes for a cover-art (folder.jpg) handle. */
  coverData?: Buffer;
  /** Id of the MusicSourcePlugin that owns this song. */
  pluginId?: string;
  /** The resolved originator plugin, kept to reopen the stream on a seek. */
  plugin?: StreamingPlugin;
  /** Present when this song is being streamed via its originator plugin. */
  activeStream?: ActiveStream;
}

/**
 * Per-connection SMB2 session state: negotiated dialect, session id and
 * the table of currently open file/directory handles.
 */
export class SmbSession {
  dialect = 0;
  sessionId = 1n;
  /** Server challenge from the NTLMSSP CHALLENGE, pending the client's AUTHENTICATE. */
  ntlmServerChallenge?: Buffer;
  readonly handles = new Map<string, OpenHandle>();

  #nextHandleId = 1n;

  nextHandle(): { volatile: bigint; persistent: bigint } {
    const id = this.#nextHandleId;
    this.#nextHandleId += 1n;
    return { volatile: id, persistent: id };
  }
}
