import { Db } from "mongodb";
import { SongDbModel } from "../db/song.js";
import { Format } from "../../misc/constants.js";

export class Song {
  id: string;
  title: string;
  artist: string;
  artistsId: string[];
  album: string;
  albumId: string;
  duration: number; // duration in seconds
  trackNumber: number;
  diskNumber: number;
  format: Format;
  sampleRate: number;
  bitRate: number;

  static fromDbModel(model: SongDbModel): Song {
    const song = new Song();
    song.title = model.name;
    song.trackNumber = model.trackNumber;
    song.diskNumber = model.diskNumber;
    song.album = model.album;
    song.albumId = model.albumId;
    song.artist = model.artist;
    song.artistsId = model.artistsId;

    return song;
  }
}
