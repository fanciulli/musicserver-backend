/*
 * Created on Fri Mar 06 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */

import type { PluginStatus } from "../../types/db/plugin.js";

export class PluginListItem {
  id: string;
  name: string;
  category: string;
  status: PluginStatus;
}

export const PluginsSchema = {
  response: {
    200: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          category: { type: "string" },
          status: {
            type: "string",
            enum: ["loaded", "started", "error", "disabled", "unknown"],
          },
        },
      },
    },
  },
};

export const PluginStopSchema = {
  body: {
    type: "object",
    required: ["pluginId"],
    properties: {
      pluginId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        status: { type: "string" },
      },
    },
  },
};

export const PluginStartSchema = {
  body: {
    type: "object",
    required: ["pluginId"],
    properties: {
      pluginId: { type: "string" },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        status: { type: "string" },
      },
    },
  },
};
