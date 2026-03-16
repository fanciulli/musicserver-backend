/*
 * Created on Fri Mar 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
export const AlbumArtSchema = {
  query: {
    type: "object",
    properties: {
      id: { type: "string" },
    },
    required: ["id"],
  },
};
