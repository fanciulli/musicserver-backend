/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Readable } from "node:stream";
import { Plugin } from "./plugin";
import { Song } from "../music/song";

export abstract class MusicSourcePlugin extends Plugin {
    abstract scan: () => Promise<void>;
    abstract browse: () => Promise<Array<Song>>;
    abstract stream: (id: string) => Promise<Readable>;
}