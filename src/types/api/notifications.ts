/*
 * Created on Sat Jun 13 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { NOTIFICATION_TYPE_VALUES } from "../db/notification.js";

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
  required: ["id", "title", "message", "type", "createdAt", "read"],
  properties: {
    id: { type: "string", format: "uuid" },
    title: { type: "string" },
    message: { type: "string" },
    type: { type: "string", enum: NOTIFICATION_TYPE_VALUES },
    createdAt: { type: "string", format: "date-time" },
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
      id: { type: "string", format: "uuid" },
    },
  },
};

export const NotificationDeleteSchema = {
  params: {
    type: "object",
    required: ["id"],
    properties: {
      id: { type: "string", format: "uuid" },
    },
  },
};
