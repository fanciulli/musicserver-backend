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
      level: { type: "string", pattern: "^(trace|debug|info|warn|error|fatal)$" },
      from: { type: "string" },
      to: { type: "string" },
      page: { type: "integer", minimum: 1 },
      limit: { type: "integer", minimum: 1, maximum: 200 },
    },
    required: ["id"],
    additionalProperties: false,
  },
};
