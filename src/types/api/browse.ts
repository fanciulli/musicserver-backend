/*
 * Created on Wed Feb 04 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
export const BrowseSchema = {
  request: {
    type: "object",
    properties: {
      path: { type: "string" },
    },
  },
  response: {
    200: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          artist: { type: "string" },
          album: { type: "string" },
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
};
