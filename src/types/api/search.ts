/*
 * Created on Tue Apr 07 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
export const SearchSchema = {
  body: {
    type: "object",
    properties: {
      query: { type: "string" },
      category: { type: "string", enum: ["album", "artist", "song"] },
      scheme: { type: "string" },
    },
    required: ["query", "category"],
  },
};

export type SearchRequestBody = {
  query: string;
  category: string;
  scheme?: string;
};
