/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { createReadStream } from 'fs';
import { Readable } from 'stream';
const { readdir, Dirent } = require('node:fs/promises');
import { MusicSourcePlugin } from '../../../types/plugins/music_sources';
import { Song } from '../../../types/music/song';

const listFiles = async (parentFolder: string): Promise<string[]> => {
    const dirListing = await readdir(parentFolder, { withFileTypes: true });

    const files = dirListing.filter(item => { return item.isDirectory() == false })
        .map(file => { return file.name });
    return files;
}

class FilesystemMusicSong extends Song {
    filepath: string;
}

export default class FilesystemMusicSourcePlugin extends MusicSourcePlugin {
    id: string = 'filesystem-music-source';
    category: string = 'music_source';

    #database: Map<string, Song> = new Map();

    scan = async (): Promise<void> => { 
        this.#database.clear();
        const files = await listFiles('.');
        let index = 1;
        for (let file of files) {
            const song = new FilesystemMusicSong();
            song.id = '' + index++;
            song.title = 'Song no. ' + index;
            song.artist = 'Unknown Artist';
            song.filepath = file
            this.#database.set(song.id, song);
        }
    };
    browse = async (): Promise<Array<Song>> => { 
        let response : Array<Song> = [];
        for (let song of this.#database.values()) {
            response.push(song);
        }
        return response;
    };

    stream = async (id: string): Promise<Readable> => {
        const song = this.#database.get(id) as FilesystemMusicSong;
        const stream = createReadStream(song.filepath);
        return stream;
    };
}