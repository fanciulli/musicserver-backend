/*
 * Created on Mon Mar 16 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
export const AdminLogsSchema = {
  query: {
    type: "object",
    properties: {
      id: { type: "string", pattern: "^(main|fastify)$" },
    },
    required: ["id"],
    additionalProperties: false,
  },
};
