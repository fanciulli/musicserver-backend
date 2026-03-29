/*
 * Created on Fri Jan 30 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Context } from "../context.js";

export type PluginConfigurationVariables = Array<Record<string, string>>;

export type PluginConfigurationValues = Record<string, unknown>;

export type PluginConfigurationSettings = {
  variables: PluginConfigurationVariables;
  values: PluginConfigurationValues;
};

export abstract class Plugin {
  abstract id: string;
  abstract name: string;
  abstract category: string;
  context: Context;

  constructor(context: Context) {
    this.context = context;
  }

  start: () => Promise<void> = async () => {
    this.context.logger.info(
      "Starting plugin " + this.category + "/" + this.id,
    );
  };
  stop: () => Promise<void> = async () => {
    this.context.logger.info(
      "Stopping plugin " + this.category + "/" + this.id,
    );
  };

  loadConfiguration: () => Promise<void> = async () => {
    this.context.logger.info(
      "Loading configuration for plugin " + this.category + "/" + this.id,
    );
  };

  getConfiguration: () => Promise<PluginConfigurationSettings> = async () => {
    return {
      variables: [],
      values: {},
    };
  };

  updateConfiguration: (settings: PluginConfigurationValues) => Promise<void> =
    async (_settings: PluginConfigurationValues) => {
      this.context.logger.info(
        "Updating configuration for plugin " + this.category + "/" + this.id,
      );
    };
}
