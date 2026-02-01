import { Format } from "./format";

export class Song {
    id: string;
    title: string;
    artist: string;
    album: string;
    duration: number; // duration in seconds
    format: Format;
}