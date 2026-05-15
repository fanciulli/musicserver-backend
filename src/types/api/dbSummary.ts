/*
 * Created on Fri May 15 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */

export const DbSummarySchema = {
  response: {
    200: {
      type: "object",
      properties: {
        artists: { type: "number" },
        albums: { type: "number" },
        songs: { type: "number" },
      },
    },
  },
};

export const DbArtistsSchema = {
  response: {
    200: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          pluginId: { type: "string" },
        },
      },
    },
  },
};

export const DbAlbumsSchema = {
  params: {
    type: "object",
    required: ["artistId"],
    properties: {
      artistId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          pluginId: { type: "string" },
          artists: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    404: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
  },
};

export const DbSongsSchema = {
  params: {
    type: "object",
    required: ["albumId"],
    properties: {
      albumId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          pluginId: { type: "string" },
          albumId: { type: "string" },
          trackNumber: { type: "number" },
          duration: { type: "number" },
        },
      },
    },
    404: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
  },
};
