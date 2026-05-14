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
  year: number = 0;
  genre: string[] = [];
  bpm: number = 0;
  mood: string = "";
  releaseDate: string = "";

  static fromDbModel(model: SongDbModel): Song {
    const song = new Song();
    song.title = model.name || "";
    song.trackNumber = model.trackNumber || 0;
    song.diskNumber = model.diskNumber || 0;
    song.album = model.album || "";
    song.albumId = model.albumId || "";
    song.artist = model.artist || "";
    song.artistsId = model.artistsId || [];
    song.year = model.year || 0;
    song.genre = model.genre || [];
    song.bpm = model.bpm || 0;
    song.mood = model.mood || "";
    song.releaseDate = model.releaseDate || "";
    song.sampleRate = model.sampleRate || 0;
    song.bitRate = model.bitRate || 0;
    song.duration = model.duration || 0;
    song.format = (model.format?.toUpperCase() as Format) || Format.UNKNOWN;

    return song;
  }
}
