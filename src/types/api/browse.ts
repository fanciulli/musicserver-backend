import { Song } from "./song.js";
import { Folder } from "./folder.js";

/*
 * Created on Wed Feb 04 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
export const BrowseSchema = {
  body: {
    type: "object",
    properties: {
      path: { type: "string" },
    },
    required: ["path"],
  },
  response: {
    200: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          type: { type: "string" },
          metadata: {
            type: "object",
            properties: {
              name: { type: "string" },
              title: { type: "string" },
              artist: { type: "string" },
              artistsId: { type: "array", items: { type: "string" } },
              album: { type: "string" },
              albumId: { type: "string" },
              duration: { type: "number" },
              format: { type: "object" },
              trackNumber: { type: "number" },
              diskNumber: { type: "number" },
              sampleRate: { type: "number" },
              bitRate: { type: "number" },
            },
          },
        },
      },
    },
  },
};

export enum BrowseType {
  FOLDER = "folder",
  SONG = "song",
}

export class BrowseResponse {
  id: string;
  type: BrowseType;
  metadata?: Folder | Song;

  constructor(id: string, type: BrowseType, metadata?: Folder | Song) {
    this.id = id;
    this.type = type;
    this.metadata = metadata;
  }
}
