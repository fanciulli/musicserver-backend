/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Readable } from "node:stream";
import { MUSIC_SOURCE_PLUGIN_CATEGORY, Plugin } from "./plugin.js";
import { BrowseResponse } from "../api/browse.js";

export abstract class MusicSourcePlugin extends Plugin {
  category: string = MUSIC_SOURCE_PLUGIN_CATEGORY;

  abstract scan(): Promise<void>;
  abstract browse(path: string): Promise<Array<BrowseResponse>>;
  abstract search(
    query: string,
    category: string,
  ): Promise<Array<BrowseResponse>>;
  /**
   * Opens the given song's audio bytes for reading, optionally starting at a
   * byte offset. Implementations MUST always resolve the total size of the
   * song alongside the stream (never `undefined`) — consumers (HTTP
   * `content-length`, SMB file size) depend on it being known upfront.
   */
  abstract stream(id: string, from?: number): Promise<[Readable, number]>;
  abstract getAlbumArt(uri: string): Promise<Uint8Array | undefined>;
}
