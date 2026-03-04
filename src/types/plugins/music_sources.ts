/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Readable } from "node:stream";
import { Plugin } from "./plugin.js";
import { BrowseResponse } from "../api/browse.js";

export const MUSIC_SOURCE_PLUGIN_CATEGORY = "music_sources";

export abstract class MusicSourcePlugin extends Plugin {
  category: string = MUSIC_SOURCE_PLUGIN_CATEGORY;

  abstract scan(): Promise<void>;
  abstract browse(path: string): Promise<Array<BrowseResponse>>;
  abstract stream(id: string): Promise<Readable>;
}
