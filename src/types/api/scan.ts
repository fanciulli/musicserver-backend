/*
 * Created on Wed Mar 04 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
export const ScanSchema = {
  body: {
    properties: {
      id: { type: "string" },
    },
    required: ["id"],
  },
};
