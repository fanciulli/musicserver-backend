/*
 * Created on Sun Jun 14 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
const configItemJsonSchema = {
  type: "object",
  properties: {
    key: { type: "string" },
    label: { type: "string" },
    type: { type: "string", enum: ["string", "boolean"] },
    value: { type: ["string", "boolean"] },
  },
};

export const ConfigGetSchema = {
  response: {
    200: {
      type: "array",
      items: configItemJsonSchema,
    },
  },
};

export const ConfigUpdateSchema = {
  body: {
    type: "object",
    required: ["values"],
    properties: {
      values: {
        type: "object",
        // Per-value types (string | boolean) are validated by the registry in
        // configService; an Ajv union here is ignored under strict mode anyway.
        additionalProperties: true,
      },
    },
  },
  response: {
    200: {
      type: "array",
      items: configItemJsonSchema,
    },
    400: {
      type: "object",
      properties: {
        error: { type: "string" },
      },
    },
  },
};
