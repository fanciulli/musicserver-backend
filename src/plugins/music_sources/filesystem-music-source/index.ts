/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { createReadStream } from "fs";
import { Readable } from "stream";
import { readdir } from "node:fs/promises";
import { MusicSourcePlugin } from "../../../types/plugins/music_sources";
import { Song } from "../../../types/music/song";
import path from "path";
// @ts-expect-error moduleResolution:nodenext issue 54523
import { v4 as uuidv4 } from "uuid";
// @ts-expect-error moduleResolution:nodenext issue 54523
import { IAudioMetadata, parseFile } from "music-metadata";

const listFiles = async (parentFolder: string): Promise<string[]> => {
  const dirListing = await readdir(parentFolder, {
    withFileTypes: true,
    recursive: true,
  });

  const files = dirListing
    .filter((item) => {
      return item.isDirectory() == false;
    })
    .map((file) => {
      return path.join(file.parentPath, file.name);
    });
  return files;
};

class FilesystemMusicSong extends Song {
  filepath: string;
}

export default class FilesystemMusicSourcePlugin extends MusicSourcePlugin {
  id: string = "filesystem-music-source";
  name: string = "Filesystem Music Source";
  category: string = "music_source";

  #database: Map<string, Song> = new Map();

  scan = async (): Promise<void> => {
    this.#database.clear();
    const files = await listFiles(process.env.PLUGIN_FSS_FOLDER);
    let index = 1;
    for (let filePath of files) {
      try {
        console.log(filePath);
        const fileMetadata: IAudioMetadata = await parseFile(filePath);

        console.log(fileMetadata);
        const song = new FilesystemMusicSong();
        song.id = uuidv4();
        song.title = fileMetadata.common.title;
        song.artist = fileMetadata.common.albumartist;
        song.album = fileMetadata.common.album;
        song.trackNumber = fileMetadata.common.track?.no;
        song.diskNumber = fileMetadata.common.disk?.no;
        song.filepath = filePath;

        song.sampleRate = fileMetadata.format.sampleRate;
        song.bitRate = fileMetadata.format.bitrate;
        song.duration = fileMetadata.format.duration;
        this.#database.set(song.id, song);
      } catch {}
    }
  };
  browse = async (): Promise<Array<Song>> => {
    let response: Array<Song> = [];
    for (let song of this.#database.values()) {
      response.push(song);
    }
    return response;
  };

  stream = async (id: string): Promise<Readable> => {
    const song = this.#database.get(id) as FilesystemMusicSong;

    if (song) {
      const stream = createReadStream(song.filepath);
      return stream;
    } else {
      throw new Error("Song not found");
    }
  };
}
