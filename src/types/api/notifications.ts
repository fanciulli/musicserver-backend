/*
 * Created on Sat Jun 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */

export type NotificationResponse = {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  read: boolean;
};

export const NotificationSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    message: { type: "string" },
    type: { type: "string" },
    createdAt: { type: "string" },
    read: { type: "boolean" },
  },
};

export const NotificationsListSchema = {
  response: {
    200: {
      type: "array",
      items: NotificationSchema,
    },
  },
};

export const NotificationReadSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
};

export const NotificationDeleteSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string" },
    },
  },
};
