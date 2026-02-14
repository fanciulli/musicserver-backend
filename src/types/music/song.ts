import { Format } from "./format";

export class Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // duration in seconds
  trackNumber: number;
  diskNumber: number;
  format: Format;
  sampleRate: number;
  bitRate: number;
}
