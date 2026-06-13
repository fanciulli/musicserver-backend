/*
 * Created on Fri Mar 06 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */

import { PluginStatus } from "../../types/db/plugin.js";
import type { PluginConfigurationSettings } from "../../types/plugins/plugin.js";

export class PluginListItem {
  id: string = "";
  name: string = "";
  category: string = "";
  status: PluginStatus = PluginStatus.UNKNOWN;
}

export class PluginConfiguration {
  pluginId: string = "";
  settings: PluginConfigurationSettings = {} as PluginConfigurationSettings;
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

export const PluginConfigGetSchema = {
  params: {
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
        pluginId: { type: "string" },
        settings: {
          type: "object",
          properties: {
            variables: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: {
                  type: "string",
                },
              },
            },
            labels: {
              type: "object",
              additionalProperties: {
                type: "string",
              },
            },
            values: {
              type: "object",
              additionalProperties: true,
            },
          },
        },
      },
    },
  },
};

export const PluginConfigUpdateSchema = {
  params: {
    type: "object",
    required: ["pluginId"],
    properties: {
      pluginId: { type: "string" },
    },
  },
  body: {
    type: "object",
    required: ["settings"],
    properties: {
      settings: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
  response: {
    200: {
      type: "object",
      properties: {
        pluginId: { type: "string" },
        settings: {
          type: "object",
          properties: {
            values: {
              type: "object",
              additionalProperties: true,
            },
          },
        },
      },
    },
  },
};
