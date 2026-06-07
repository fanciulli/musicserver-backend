/*
 * Created on Thu May 22 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */

export type ApiKeyCreateRequest = {
  name: string;
  durationDays: number | null;
};

export type ApiKeyCreateResponse = {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  expiresAt: string;
};

export const ApiKeySchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    key: { type: "string" },
    createdAt: { type: "string" },
    expiresAt: { type: ["string", "null"] },
  },
};

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
    200: ApiKeySchema,
  },
};

export const ApiKeyListSchema = {
  response: {
    200: {
      type: "array",
      items: ApiKeySchema,
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
};
