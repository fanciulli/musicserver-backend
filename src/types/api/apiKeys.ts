/*
 * Created on Thu May 22 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */

export const ApiKeyCreateSchema = {
  body: {
    type: "object",
    required: ["name", "durationDays"],
    properties: {
      name: { type: "string", minLength: 1, maxLength: 64 },
      durationDays: { type: ["integer", "null"], minimum: 1 },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        key: { type: "string" },
        createdAt: { type: "string" },
        expiresAt: { type: ["string", "null"] },
      },
    },
  },
};

export const ApiKeyListSchema = {
  response: {
    200: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          keyPrefix: { type: "string" },
          createdAt: { type: "string" },
          expiresAt: { type: ["string", "null"] },
        },
      },
    },
  },
};

export const ApiKeyDeleteSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        status: { type: "string" },
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
