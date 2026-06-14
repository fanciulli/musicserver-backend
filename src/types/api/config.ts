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
        additionalProperties: { type: ["string", "boolean"] },
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
