/*
 * Created on Wed Feb 04 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
export const StreamSchema = {
  query: {
    type: "object",
    properties: {
      id: { type: "string" },
    },
    required: ["id"],
  },
};
