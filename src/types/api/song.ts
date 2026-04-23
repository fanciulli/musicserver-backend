/*
 * Created on Thu Mar 26 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { SongDbModel } from "../db/song.js";
import { Format } from "../../misc/constants.js";

export class Song {
  title: string = "";
  artist: string = "";
  artistsId: string[] = [];
  album: string = "";
  albumId: string = "";
  duration: number = 0; // duration in seconds
  trackNumber: number = 0;
  diskNumber: number = 0;
  format: Format = Format.UNKNOWN;
  sampleRate: number = 0;
  bitRate: number = 0;

  static fromDbModel(model: SongDbModel): Song {
    const song = new Song();
    song.title = model.name || "";
    song.trackNumber = model.trackNumber || 0;
    song.diskNumber = model.diskNumber || 0;
    song.album = model.album || "";
    song.albumId = model.albumId || "";
    song.artist = model.artist || "";
    song.artistsId = model.artistsId || [];

    return song;
  }
}
