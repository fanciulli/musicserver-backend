/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import type { Context } from "../../../types/context.js";
import {
  DEVICE_CONNECTORS_PLUGIN_CATEGORY,
  Plugin,
} from "../../../types/plugins/plugin.js";
import type {
  PluginConfigurationSettings,
  PluginConfigurationValues,
} from "../../../types/plugins/plugin.js";
import {
  getConfiguration,
  loadConfiguration,
  updateConfiguration,
  DEFAULT_CONFIG,
  SMB_PORT,
  type SonosSmbConfig,
} from "./config.js";
import { SmbServer } from "./smb/server.js";
import { ntHashHex } from "./smb/ntlmAuth.js";
import { LibraryTree } from "./library/libraryTree.js";
import { getPluginById } from "../../../utils/musicSourcePluginResolver.js";

export default class SonosSmbPlugin extends Plugin {
  id: string = "sonos-smb-connector";
  name: string = "Sonos";
  category: string = DEVICE_CONNECTORS_PLUGIN_CATEGORY;
  #config: SonosSmbConfig;
  #server?: SmbServer;

  constructor(context: Context) {
    super(context);
    this.#config = { ...DEFAULT_CONFIG };
  }

  start = async (): Promise<void> => {
    this.context.logger.info(`Starting plugin ${this.category}/${this.id}`);

    const server = new SmbServer({
      library: new LibraryTree(this.context),
      logger: this.context.logger,
      getShareName: () => this.#config.shareName,
      getCredentials: () => ({
        username: this.#config.username,
        passwordNtHashHex: ntHashHex(this.#config.password),
      }),
      resolvePlugin: async (pluginId: string) => {
        const result = await getPluginById(pluginId, this.context);
        return result.plugin;
      },
    });

    try {
      await server.listen(SMB_PORT);
      this.#server = server;
    } catch (err) {
      this.context.logger.error(
        { err },
        `sonos-smb: failed to start SMB server on port ${SMB_PORT}`,
      );
    }
  };

  stop = async (): Promise<void> => {
    this.context.logger.info(`Stopping plugin ${this.category}/${this.id}`);

    if (this.#server !== undefined) {
      await this.#server.close();
      this.#server = undefined;
    }
  };

  loadConfiguration = async (): Promise<void> => {
    this.#config = await loadConfiguration(
      this.getDatabase(),
      this.category,
      this.id,
    );
  };

  getConfiguration = async (): Promise<PluginConfigurationSettings> => {
    return getConfiguration(this.#config);
  };

  updateConfiguration = async (
    settings: PluginConfigurationValues,
  ): Promise<void> => {
    this.#config = await updateConfiguration(
      this.getDatabase(),
      this.category,
      this.id,
      settings,
    );
  };
}
