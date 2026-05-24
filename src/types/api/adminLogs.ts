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
      level: { type: "string", pattern: "^(debug|info|error)$" },
      from: { type: "string", format: "date-time" },
      to: { type: "string", format: "date-time" },
      page: { type: "integer", minimum: 1 },
      limit: { type: "integer", minimum: 1, maximum: 200 },
    },
    required: ["id"],
    additionalProperties: false,
  },
};
